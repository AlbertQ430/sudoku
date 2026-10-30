/**
 * 题目求解的四种判定结果（SRS 3.4）。
 *
 * 明确的取舍：
 * - `timeout` 是一个独立结果，永远不折叠成 `none` 或 `unique`；
 * - `multiple` 会带回「找到的第一个解」，但调用方必须看 `status`，
 *   不能把它当成标准题的唯一解（AC-06 要求展示一个解并警告）；
 * - `invalid` 与 `none` 分开，前者是输入格式/冲突问题，后者是合法但无解。
 */

import { searchSolutions } from "./counter";
import type { Grid81 } from "./types";

const DEFAULT_DEADLINE_MS = 5_000;

export type SolveStatus = "unique" | "none" | "multiple" | "timeout" | "invalid";

export interface SolveOutcome {
  readonly status: SolveStatus;
  /** `unique` 时是唯一解；`multiple` 时是找到的第一个解（仅供展示）。 */
  readonly solution: Grid81 | null;
  /** 已确认的解数：0、1，或 2（表示「至少两个」）。 */
  readonly count: number;
  readonly elapsedMs: number;
}

export interface SolveOptions {
  readonly deadlineMs?: number;
}

/**
 * 求解一道题，并判定解的个数。
 *
 * 找到 2 个解即停（SRS 3.4 第 5 条），因此多解题的代价与唯一解题相当。
 */
export function solvePuzzle(givens: Grid81, options: SolveOptions = {}): SolveOutcome {
  const startedAt = performance.now();

  const result = searchSolutions(givens, {
    limit: 2,
    deadlineMs: options.deadlineMs ?? DEFAULT_DEADLINE_MS,
    captureFirst: true,
  });

  const elapsedMs = Math.round(performance.now() - startedAt);

  if (result.invalid) return { status: "invalid", solution: null, count: 0, elapsedMs };
  if (result.timedOut) return { status: "timeout", solution: null, count: 0, elapsedMs };
  if (result.count === 0) return { status: "none", solution: null, count: 0, elapsedMs };
  if (result.count > 1) {
    return { status: "multiple", solution: result.firstSolution, count: 2, elapsedMs };
  }

  return { status: "unique", solution: result.firstSolution, count: 1, elapsedMs };
}

/** 唯一的便捷判断：标准题是否可以开始。 */
export function isStandardPlayable(givens: Grid81, deadlineMs?: number): boolean {
  return solvePuzzle(givens, { deadlineMs }).status === "unique";
}
