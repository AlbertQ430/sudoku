/**
 * 81 位题目的解析、归一化与格式化（SRS 6.5 / 附录 A）。
 *
 * 归一化规则：
 * - 全角数字 ０–９ 转半角；
 * - `.`、`_` 视作空格；
 * - 空白与常见分隔符（`| + - , / \`）忽略；
 * - 其余字符原样保留，交给字符合法性检查。
 */

import { CELL_COUNT } from "./constants";
import { findConflicts } from "./conflicts";
import type { CellIndex, Grid81, ParseResult } from "./types";

const FULLWIDTH_DIGIT_START = 0xff10;
const FULLWIDTH_DIGIT_END = 0xff19;
const ASCII_ZERO = 0x30;

const IGNORED_SEPARATORS = new Set([
  " ",
  "\t",
  "\n",
  "\r",
  "\u00a0",
  "\u3000",
  "|",
  "+",
  "-",
  ",",
  "/",
  "\\",
]);

/** 只做全角数字到半角的转换。 */
export function toHalfWidthDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= FULLWIDTH_DIGIT_START && code <= FULLWIDTH_DIGIT_END) {
      out += String.fromCharCode(code - FULLWIDTH_DIGIT_START + ASCII_ZERO);
    } else {
      out += ch;
    }
  }
  return out;
}

/** 归一化成「只含 0–9」的字符串，长度未校验。 */
export function normalize(input: string): string {
  const halfWidth = toHalfWidthDigits(input);
  let out = "";
  for (const ch of halfWidth) {
    if (ch === "." || ch === "_") {
      out += "0";
    } else if (IGNORED_SEPARATORS.has(ch)) {
      continue;
    } else {
      out += ch;
    }
  }
  return out;
}

/** 统计给定数个数（非 `0` 的字符数）。 */
export function cluesOf(grid: Grid81): number {
  let count = 0;
  for (let i = 0; i < grid.length; i++) {
    const ch = grid.charAt(i);
    if (ch >= "1" && ch <= "9") count++;
  }
  return count;
}

/**
 * 解析用户输入。
 *
 * 校验顺序严格按 SRS 6.5 的前 4 步：数量 → 字符 → 冲突 → 提示数下限。
 * 可解性与解数统计依赖求解器，由上层组合，不在这里做。
 */
export function parse81(input: string, options: { minClues?: number } = {}): ParseResult {
  const givens = normalize(input);

  if (givens.length !== CELL_COUNT) {
    return { ok: false, code: "LENGTH", cells: [] };
  }

  const invalid: CellIndex[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = givens.charAt(i);
    if (ch < "0" || ch > "9") invalid.push(i);
  }
  if (invalid.length > 0) {
    return { ok: false, code: "CHARACTER", cells: invalid };
  }

  const conflicts = findConflicts(givens);
  if (conflicts.cells.length > 0) {
    return { ok: false, code: "CONFLICT", cells: conflicts.cells };
  }

  const minClues = options.minClues ?? 17;
  const clues = cluesOf(givens);
  if (clues < minClues) {
    return { ok: false, code: "TOO_FEW_CLUES", cells: [] };
  }

  return { ok: true, givens, clues };
}

/**
 * 规范化键（SRS 3.10）：81 位、只含 0–9。
 *
 * 只对已通过 `parse81` 的数据调用；非法入参属于编程错误，直接抛错暴露。
 */
export function canonicalKey(input: string): Grid81 {
  const givens = normalize(input);
  if (givens.length !== CELL_COUNT || /[^0-9]/.test(givens)) {
    throw new RangeError(`canonicalKey 收到非法题目：长度为 ${givens.length}`);
  }
  return givens;
}

/**
 * 按 3×3 分块格式化成 9 行，便于日志与题目预览。
 */
export function format81(grid: Grid81, emptyChar = "0"): string {
  const rows: string[] = [];
  for (let r = 0; r < 9; r++) {
    const row = grid.slice(r * 9, r * 9 + 9).replaceAll("0", emptyChar);
    rows.push(`${row.slice(0, 3)} ${row.slice(3, 6)} ${row.slice(6, 9)}`);
  }
  return rows.join("\n");
}
