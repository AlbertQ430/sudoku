/**
 * 解数统计：MRV（最少候选优先）+ 位掩码增量回溯。
 *
 * 为什么不用 sudoku-core 的 `isUniqueSolution`：它是同步的、无法中断，
 * 而 SRS 3.4 要求「超时不得误报为唯一解或无解」，NFR-PERF-003 要求上限 5 秒。
 * 因此这里自带 deadline，并保证超时时 `timedOut=true`、`count` 只代表已确认的部分。
 *
 * 约定：
 * - 输入非法（长度、字符、给定数冲突）返回 `invalid=true`，不抛异常；
 * - 找到 `limit` 个解立即停止，不枚举全部；
 * - 超时绝不当作无解。
 */

import { ALL_DIGITS_MASK, CELL_COUNT } from "./constants";
import type { Grid81 } from "./types";

const DEFAULT_DEADLINE_MS = 5_000;
const TIME_CHECK_INTERVAL = 1024;

/** 预先算好的格位换算表，避免搜索热路径里反复调用函数。 */
const ROW_OF = Uint8Array.from({ length: CELL_COUNT }, (_, i) => Math.floor(i / 9));
const COL_OF = Uint8Array.from({ length: CELL_COUNT }, (_, i) => i % 9);
const BOX_OF = Uint8Array.from({ length: CELL_COUNT }, (_, i) => {
  const row = Math.floor(i / 9);
  const col = i % 9;
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
});

export interface SearchOptions {
  /** 最多找几个解，默认 2（判断唯一性够用）。 */
  readonly limit?: number;
  /** 墙钟预算，默认 5000ms。 */
  readonly deadlineMs?: number;
  /** 是否记录第一个找到的解。 */
  readonly captureFirst?: boolean;
}

export interface SearchResult {
  readonly count: number;
  readonly timedOut: boolean;
  readonly invalid: boolean;
  readonly firstSolution: Grid81 | null;
}

export interface CountResult {
  readonly count: number;
  readonly timedOut: boolean;
  readonly invalid: boolean;
}

/** 位 -> 数字：bit0 对应 1，bit8 对应 9。 */
function digitFromBit(bit: number): number {
  return 32 - Math.clz32(bit);
}

function invalidResult(): SearchResult {
  return { count: 0, timedOut: false, invalid: true, firstSolution: null };
}

/**
 * 统计解的数量。
 *
 * @returns `count` 已找到的解个数；`timedOut` 表示搜索被预算打断；
 *          `invalid` 表示输入本身不合法。
 */
export function searchSolutions(givens: Grid81, options: SearchOptions = {}): SearchResult {
  const limit = Math.max(1, options.limit ?? 2);
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const captureFirst = options.captureFirst ?? false;

  if (givens.length !== CELL_COUNT) return invalidResult();

  const startedAt = performance.now();
  const values = new Int8Array(CELL_COUNT);
  const rowMask = new Uint16Array(9);
  const colMask = new Uint16Array(9);
  const boxMask = new Uint16Array(9);

  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = givens.charAt(i);
    if (ch === "0") continue;
    if (ch < "1" || ch > "9") return invalidResult();

    const digit = ch.charCodeAt(0) - 48;
    const bit = 1 << (digit - 1);
    const r = ROW_OF[i]!;
    const c = COL_OF[i]!;
    const b = BOX_OF[i]!;

    if ((rowMask[r]! & bit) !== 0) return invalidResult();
    if ((colMask[c]! & bit) !== 0) return invalidResult();
    if ((boxMask[b]! & bit) !== 0) return invalidResult();

    values[i] = digit;
    rowMask[r] = rowMask[r]! | bit;
    colMask[c] = colMask[c]! | bit;
    boxMask[b] = boxMask[b]! | bit;
  }

  let count = 0;
  let nodes = 0;
  let timedOut = false;
  let firstSolution: Grid81 | null = null;

  function search(): void {
    if (count >= limit || timedOut) return;

    nodes++;
    if (nodes === 1 || nodes % TIME_CHECK_INTERVAL === 0) {
      if (performance.now() - startedAt >= deadlineMs) {
        timedOut = true;
        return;
      }
    }

    // 1. 选候选最少的空格（MRV）
    let bestIndex = -1;
    let bestMask = 0;
    let bestCount = 10;

    for (let i = 0; i < CELL_COUNT; i++) {
      if (values[i] !== 0) continue;

      const r = ROW_OF[i]!;
      const c = COL_OF[i]!;
      const b = BOX_OF[i]!;
      const mask =
        ALL_DIGITS_MASK & ~(rowMask[r]! | colMask[c]! | boxMask[b]!);

      let options_ = 0;
      let m = mask;
      while (m !== 0) {
        m &= m - 1;
        options_++;
      }

      // 有空格无候选：当前分支已经死了
      if (options_ === 0) return;

      if (options_ < bestCount) {
        bestCount = options_;
        bestIndex = i;
        bestMask = mask;
        if (options_ === 1) break;
      }
    }

    // 2. 没有空格：找到一个解
    if (bestIndex === -1) {
      count++;
      if (captureFirst && firstSolution === null) {
        const cells: string[] = [];
        for (let i = 0; i < CELL_COUNT; i++) cells.push(String(values[i]));
        firstSolution = cells.join("");
      }
      return;
    }

    // 3. 逐个候选递归
    const r = ROW_OF[bestIndex]!;
    const c = COL_OF[bestIndex]!;
    const b = BOX_OF[bestIndex]!;

    let mask = bestMask;
    while (mask !== 0) {
      const bit = mask & -mask;
      mask ^= bit;
      const digit = digitFromBit(bit);

      values[bestIndex] = digit;
      rowMask[r] = rowMask[r]! | bit;
      colMask[c] = colMask[c]! | bit;
      boxMask[b] = boxMask[b]! | bit;

      search();

      rowMask[r] = rowMask[r]! & ~bit;
      colMask[c] = colMask[c]! & ~bit;
      boxMask[b] = boxMask[b]! & ~bit;
      values[bestIndex] = 0;

      if (count >= limit || timedOut) return;
    }
  }

  search();

  return { count, timedOut, invalid: false, firstSolution };
}

/** 只要数量的简化入口。 */
export function countSolutions(givens: Grid81, options: SearchOptions = {}): CountResult {
  const { count, timedOut, invalid } = searchSolutions(givens, options);
  return { count, timedOut, invalid };
}
