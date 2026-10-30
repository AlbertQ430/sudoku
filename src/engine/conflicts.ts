/**
 * 行 / 列 / 宫冲突检测（SRS 3.7 第 1 层）。
 *
 * 只回答「同一单元内是否重复」，不涉及答案，也不修改棋盘。
 */

import { boxOf, colOf, rowOf } from "./bitset";
import { CELL_COUNT } from "./constants";
import type { CellIndex, ConflictReport, Grid81 } from "./types";

interface UnitScan {
  readonly conflictCells: readonly CellIndex[];
  readonly hasConflict: boolean;
}

/** 扫描一个单元（9 个索引），返回重复数字涉及的所有格。 */
function scanUnit(indices: readonly CellIndex[], grid: Grid81): UnitScan {
  const positions = new Map<string, CellIndex[]>();

  for (const index of indices) {
    const ch = grid.charAt(index);
    if (ch === "0" || ch === "") continue;
    const list = positions.get(ch);
    if (list) list.push(index);
    else positions.set(ch, [index]);
  }

  const conflictCells: CellIndex[] = [];
  for (const list of positions.values()) {
    if (list.length > 1) conflictCells.push(...list);
  }

  return { conflictCells, hasConflict: conflictCells.length > 0 };
}

/**
 * 找出所有冲突格。
 *
 * 一次落子可能同时破坏行、列、宫，因此三类单元都要扫；
 * 返回的 cells 去重后升序，便于 UI 直接遍历。
 */
export function findConflicts(grid: Grid81): ConflictReport {
  const rows = Array.from({ length: 9 }, () => false);
  const cols = Array.from({ length: 9 }, () => false);
  const boxes = Array.from({ length: 9 }, () => false);
  const cells = new Set<CellIndex>();

  for (let r = 0; r < 9; r++) {
    const indices = Array.from({ length: 9 }, (_, c) => r * 9 + c);
    const scan = scanUnit(indices, grid);
    rows[r] = scan.hasConflict;
    for (const cell of scan.conflictCells) cells.add(cell);
  }

  for (let c = 0; c < 9; c++) {
    const indices = Array.from({ length: 9 }, (_, r) => r * 9 + c);
    const scan = scanUnit(indices, grid);
    cols[c] = scan.hasConflict;
    for (const cell of scan.conflictCells) cells.add(cell);
  }

  for (let b = 0; b < 9; b++) {
    const indices: CellIndex[] = [];
    for (let i = 0; i < CELL_COUNT; i++) {
      if (boxOf(i) === b) indices.push(i);
    }
    const scan = scanUnit(indices, grid);
    boxes[b] = scan.hasConflict;
    for (const cell of scan.conflictCells) cells.add(cell);
  }

  return {
    cells: [...cells].sort((a, b) => a - b),
    rows,
    cols,
    boxes,
  };
}

/** 棋盘是否已填满且无冲突（SRS 3.2 合法终盘）。 */
export function isLegalComplete(grid: Grid81): boolean {
  if (grid.length !== CELL_COUNT) return false;
  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = grid.charAt(i);
    if (ch < "1" || ch > "9") return false;
  }
  return findConflicts(grid).cells.length === 0;
}

/** 已经填了多少格。 */
export function filledCount(grid: Grid81): number {
  let count = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = grid.charAt(i);
    if (ch >= "1" && ch <= "9") count++;
  }
  return count;
}

/** 某格是否属于给定索引所在的行 / 列 / 宫（含自身）。 */
export function sharesUnit(a: CellIndex, b: CellIndex): boolean {
  return rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b);
}
