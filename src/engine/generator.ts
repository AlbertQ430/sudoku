/**
 * 题目生成：完整终盘 → 对称挖空 → 唯一解校验 → 单次评级。
 *
 * **定位（V1.4 起）**：不再被运行时调用。用户开局走 `pool.ts`（题库取题），
 * 这个模块现在只服务两处：
 * - `scripts/build-pool.ts`（扩充题库，实际在用的是 `sudoku-core.generate`，本模块是备选）；
 * - `generator.test.ts` / `property-generator.test.ts`（挖空逻辑的回归测试）。
 *
 * 与 sudoku-core `generate()` 的区别：
 * - 可控的 180° 对称挖空（SRS 3.6）；
 * - 返回前用自研计数器再做一次唯一解校验（SRS FR-GEN-003）；
 * - 自带 deadline / 取消。
 *
 * 重要的性能取舍：**每轮只调用一次 `analyze`**。
 * 早期版本为了「精确命中难度」会在挖空过程中反复评级，几百次调用会把浏览器
 * 渲染进程拖垮（实测 Page crashed）。现在改成「挖到目标深度 → 评一次 → 不匹配就
 * 换终盘重来」：单轮成本低、评级次数可控，命中率靠多轮重试堆出来。
 */

import { boxOf, colOf, rowOf } from "./bitset";
import { ALL_DIGITS_MASK, CELL_COUNT } from "./constants";
import { countSolutions } from "./counter";
import { cluesOf } from "./parser";
import { RATING_VERSION, ratePuzzle, type Rating } from "./rater";
import { groupsFor } from "./symmetry";
import type { Difficulty, Grid81, Symmetry } from "./types";

const MAX_ATTEMPTS = 60;
/** 单次生成允许的评级次数上限：每次评级都可能分配较多内存，必须封顶。 */
const MAX_RATING_CALLS = 60;
const DIG_VERIFY_DEADLINE_MS = 200;
const FINAL_VERIFY_DEADLINE_MS = 500;
const PROGRESS_EVERY = 8;

interface ClueTarget {
  readonly min: number;
  readonly max: number;
  /** 实际挖到的深度：bench 显示各档评级在这个提示数附近最容易命中。 */
  readonly target: number;
}

/** 提示数区间，来自 SRS 3.5 的参考区间；`target` 是实测的最优挖空深度。 */
const CLUE_TARGET: Readonly<Record<Difficulty, ClueTarget>> = {
  beginner: { min: 36, max: 45, target: 41 },
  easy: { min: 32, max: 40, target: 37 },
  medium: { min: 28, max: 34, target: 30 },
  hard: { min: 24, max: 30, target: 28 },
  expert: { min: 22, max: 28, target: 26 },
};

const DEFAULT_DEADLINE_MS: Readonly<Record<Difficulty, number>> = {
  beginner: 1_500,
  easy: 1_500,
  medium: 3_000,
  hard: 3_000,
  expert: 8_000,
};

export interface GenerateProgress {
  readonly phase: "filling" | "digging" | "rating";
  readonly clues?: number;
}

export interface GenerateOptions {
  readonly difficulty: Difficulty;
  readonly symmetry?: Symmetry;
  readonly deadlineMs?: number;
  /** 相同 seed + 相同版本 + 相同参数应生成相同题目（SRS FR-GEN-008）。 */
  readonly seed?: string;
  readonly onProgress?: (progress: GenerateProgress) => void;
  readonly shouldCancel?: () => boolean;
}

export interface GeneratedPuzzle {
  readonly givens: Grid81;
  readonly solution: Grid81;
  /** 实际评级，可能低于请求档。 */
  readonly difficulty: Difficulty;
  readonly requestedDifficulty: Difficulty;
  readonly ratingVersion: string;
  readonly symmetry: Symmetry;
  readonly seed: string;
  readonly clues: number;
  readonly elapsedMs: number;
}

export type GenerateFailureReason = "timeout" | "cancelled";

export type GenerateResult =
  | { readonly ok: true; readonly puzzle: GeneratedPuzzle }
  | { readonly ok: false; readonly reason: GenerateFailureReason; readonly elapsedMs: number };

/** 字符串种子 → 确定性随机源（mulberry32）。 */
export function createRng(seed: string): () => number {
  let hash = 2_166_136_261;
  for (const ch of seed) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  let state = hash >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffleInPlace<T>(items: T[], rng: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
}

/** 随机顺序回溯填出一个合法终盘。 */
function fillCompleteGrid(rng: () => number): Uint8Array {
  const values = new Uint8Array(CELL_COUNT);
  const rowMask = new Uint16Array(9);
  const colMask = new Uint16Array(9);
  const boxMask = new Uint16Array(9);

  function fill(index: number): boolean {
    if (index === CELL_COUNT) return true;

    const r = rowOf(index);
    const c = colOf(index);
    const b = boxOf(index);

    let mask = ALL_DIGITS_MASK & ~(rowMask[r]! | colMask[c]! | boxMask[b]!);
    if (mask === 0) return false;

    const candidates: number[] = [];
    while (mask !== 0) {
      const bit = mask & -mask;
      mask ^= bit;
      candidates.push(32 - Math.clz32(bit));
    }
    shuffleInPlace(candidates, rng);

    for (const digit of candidates) {
      const bit = 1 << (digit - 1);
      values[index] = digit;
      rowMask[r] = rowMask[r]! | bit;
      colMask[c] = colMask[c]! | bit;
      boxMask[b] = boxMask[b]! | bit;

      if (fill(index + 1)) return true;

      rowMask[r] = rowMask[r]! & ~bit;
      colMask[c] = colMask[c]! & ~bit;
      boxMask[b] = boxMask[b]! & ~bit;
      values[index] = 0;
    }

    return false;
  }

  if (!fill(0)) throw new Error("无法生成完整终盘");
  return values;
}

function gridToString(values: Uint8Array): Grid81 {
  const cells: string[] = [];
  for (let i = 0; i < CELL_COUNT; i++) cells.push(String(values[i]));
  return cells.join("");
}

type Removed = Array<[number, number]>;

/**
 * 生成一道题。
 *
 * 失败不抛异常：超时或取消都返回 `ok: false`，由调用方决定提示重试还是放弃。
 */
export function generatePuzzle(options: GenerateOptions): GenerateResult {
  const requested = options.difficulty;
  const symmetry: Symmetry = options.symmetry ?? "rotational";
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS[requested];
  const seed = options.seed ?? Math.random().toString(36).slice(2, 10);
  const rng = createRng(seed);
  const startedAt = performance.now();

  const outOfTime = () => performance.now() - startedAt >= deadlineMs;
  const cancelled = () => options.shouldCancel?.() === true;

  const range = CLUE_TARGET[requested];
  const baseGroups = groupsFor(symmetry);

  let ratingCalls = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (outOfTime() || cancelled() || ratingCalls >= MAX_RATING_CALLS) break;

    options.onProgress?.({ phase: "filling" });

    const solution = fillCompleteGrid(rng);
    const solutionString = gridToString(solution);
    const grid = solution.slice();
    const order = baseGroups.slice();
    shuffleInPlace(order, rng);

    // 单深度 + 多次重试：实测双深度并不提升命中率（轮次减半抵消了收益）。
    // 命中率低（easy/medium 单轮约 1%）时，由客户端多试几次兜底。
    const depths = [range.target];

    let pointer = 0;
    let stepped = 0;

    for (const depth of depths) {
      if (outOfTime() || cancelled()) break;

      while (pointer < order.length && cluesOf(gridToString(grid)) > depth) {
        if (outOfTime() || cancelled()) break;

        const group = order[pointer++]!;
        const removed: Removed = [];

        for (const index of group) {
          const value = grid[index] ?? 0;
          if (value !== 0) {
            removed.push([index, value]);
            grid[index] = 0;
          }
        }
        if (removed.length === 0) continue;

        const check = countSolutions(gridToString(grid), {
          limit: 2,
          deadlineMs: DIG_VERIFY_DEADLINE_MS,
        });

        if (check.invalid || check.timedOut || check.count !== 1) {
          for (const [index, value] of removed) grid[index] = value;
          continue;
        }

        stepped += 1;
        if (stepped % PROGRESS_EVERY === 0) {
          options.onProgress?.({ phase: "digging", clues: cluesOf(gridToString(grid)) });
        }
      }

      const givens = gridToString(grid);
      const clues = cluesOf(givens);

      if (clues < range.min) break;

      options.onProgress?.({ phase: "rating", clues });

      ratingCalls += 1;
      const rating = ratingCalls > MAX_RATING_CALLS ? null : ratePuzzle(givens);

      if (rating === null || !rating.hasUniqueSolution || rating.difficulty !== requested) {
        continue;
      }

      const verified = verify(givens, rating, {
        requested,
        symmetry,
        seed,
        solution: solutionString,
        startedAt,
      });
      if (verified) return verified;
    }
  }

  return {
    ok: false,
    reason: cancelled() ? "cancelled" : "timeout",
    elapsedMs: Math.round(performance.now() - startedAt),
  };
}

interface VerifyContext {
  readonly requested: Difficulty;
  readonly symmetry: Symmetry;
  readonly seed: string;
  readonly solution: Grid81;
  readonly startedAt: number;
}

/** 返回前必须再确认一次唯一解（SRS FR-GEN-003），失败返回 null。 */
function verify(givens: Grid81, knownRating: Rating, context: VerifyContext): GenerateResult | null {
  const check = countSolutions(givens, {
    limit: 2,
    deadlineMs: FINAL_VERIFY_DEADLINE_MS,
  });

  if (check.invalid || check.timedOut || check.count !== 1) return null;

  return {
    ok: true,
    puzzle: {
      givens,
      solution: context.solution,
      difficulty: knownRating.difficulty,
      requestedDifficulty: context.requested,
      ratingVersion: RATING_VERSION,
      symmetry: context.symmetry,
      seed: context.seed,
      clues: cluesOf(givens),
      elapsedMs: Math.round(performance.now() - context.startedAt),
    },
  };
}
