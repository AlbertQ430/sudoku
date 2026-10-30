/**
 * 三层正确性判定（SRS 3.7）。
 *
 * 1. 冲突：棋盘内部的行/列/宫重复，实时可用；
 * 2. 检查答案：与唯一解逐格比对，只标出用户填错的格；
 * 3. 完成：填满 + 合法，标准模式还要求与唯一解一致。
 *
 * 检查不修改棋盘，也不返回正确数字——只给格位。
 */

import { findConflicts, filledCount, isLegalComplete } from "../engine/conflicts";
import type { Grid81 } from "../engine/types";

export type PlayMode = "standard" | "practice";

export interface CheckResult {
  readonly empty: number;
  readonly filled: number;
  /** 用户填写但与解不一致的格。 */
  readonly wrong: readonly number[];
  /** 参与行列宫冲突的格。 */
  readonly conflict: readonly number[];
  readonly complete: boolean;
  /** 未填满、但当前填写全部正确且无冲突。 */
  readonly allCorrectSoFar: boolean;
}

/**
 * @param currentGrid 棋盘现状（含给定数）
 * @param givens 初始给定数，用于区分「用户填写」与「题目给定」
 * @param solution 唯一解；练习模式下可传空串，此时不做对答案
 */
export function checkBoard(
  currentGrid: Grid81,
  givens: Grid81,
  solution: Grid81,
  mode: PlayMode = "standard",
): CheckResult {
  const filled = filledCount(currentGrid);
  const empty = 81 - filled;
  const conflict = findConflicts(currentGrid).cells;

  const wrong: number[] = [];
  if (mode === "standard" && solution.length === 81) {
    for (let i = 0; i < 81; i++) {
      const ch = currentGrid.charAt(i);
      if (ch === "0") continue;
      if (givens.charAt(i) !== "0") continue; // 给定数永远不算用户填错
      if (ch !== solution.charAt(i)) wrong.push(i);
    }
  }

  const filledBoard = filled === 81 && conflict.length === 0;
  const complete =
    filledBoard && (mode === "practice" ? isLegalComplete(currentGrid) : currentGrid === solution);

  return {
    filled,
    empty,
    wrong,
    conflict,
    complete,
    allCorrectSoFar: filled < 81 && wrong.length === 0 && conflict.length === 0,
  };
}

/** 给 UI 的一句话摘要（SRS 3.7 第 5 条：未填满只能提示还差几格）。 */
export function summarizeCheck(result: CheckResult): string {
  if (result.complete) return "已完成";
  if (result.wrong.length > 0) return `有 ${result.wrong.length} 格与答案不一致`;
  if (result.conflict.length > 0) return `有 ${result.conflict.length} 格存在冲突`;
  if (result.empty > 0) return `目前填写均正确，还差 ${result.empty} 格`;
  return "棋盘已填满";
}
