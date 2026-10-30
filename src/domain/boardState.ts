/**
 * 棋盘状态（SRS 3.1）。
 *
 * 不可变：所有操作返回新对象，撤销栈和 React 的 memo 都依赖这一点。
 * 给定数只读；候选数在填入数字后「隐藏但保留」，删掉数字即恢复显示。
 */

import { boxOf, colOf, rowOf } from "../engine/bitset";
import type { Grid81 } from "../engine/types";

export interface BoardState {
  /** 81 位，含给定数与用户填写，`0` 表示空。 */
  readonly grid: Grid81;
  /** 81 个位掩码，bit0–bit8 对应 1–9。 */
  readonly notes: readonly number[];
  /** 当前聚焦的格；null 表示未选中。 */
  readonly selected: number | null;
  /** 是否处于候选数输入模式。 */
  readonly notesMode: boolean;
}

export interface PlaceOptions {
  /** 填入后是否清除同行、同列、同宫里的该数字候选（SRS 3.1）。 */
  readonly autoRemoveNotes: boolean;
}

export const EMPTY_NOTES: readonly number[] = Array.from({ length: 81 }, () => 0);

export function createBoardState(givens: Grid81): BoardState {
  return { grid: givens, notes: EMPTY_NOTES, selected: null, notesMode: false };
}

/** 该格是否为题目给定数。 */
export function isGiven(givens: Grid81, index: number): boolean {
  return givens.charAt(index) !== "0";
}

export function digitAt(grid: Grid81, index: number): number {
  const ch = grid.charAt(index);
  return ch >= "1" && ch <= "9" ? ch.charCodeAt(0) - 48 : 0;
}

/** 同行、同列、同宫的其它格（不含自身）。 */
export function peersOf(index: number): number[] {
  const peers = new Set<number>();
  const row = rowOf(index);
  const col = colOf(index);
  const box = boxOf(index);

  for (let i = 0; i < 81; i++) {
    if (i === index) continue;
    if (rowOf(i) === row || colOf(i) === col || boxOf(i) === box) peers.add(i);
  }

  return [...peers];
}

export function selectCell(state: BoardState, index: number | null): BoardState {
  return state.selected === index ? state : { ...state, selected: index };
}

export function setNotesMode(state: BoardState, on: boolean): BoardState {
  return state.notesMode === on ? state : { ...state, notesMode: on };
}

/** 填入数字；对给定数或非法数字原样返回。 */
export function placeDigit(
  state: BoardState,
  givens: Grid81,
  index: number,
  digit: number,
  options: PlaceOptions,
): BoardState {
  if (digit < 1 || digit > 9) return state;
  if (isGiven(givens, index)) return state;
  if (digitAt(state.grid, index) === digit) return state;

  const cells = state.grid.split("");
  cells[index] = String(digit);

  const notes = options.autoRemoveNotes ? clearPeerNotes(state.notes, index, digit) : state.notes;

  return { ...state, grid: cells.join(""), notes };
}

/** 清除某格数字；给定数不可清除。候选数保留，因此删数后会重新显示。 */
export function clearCell(state: BoardState, givens: Grid81, index: number): BoardState {
  if (isGiven(givens, index)) return state;
  if (digitAt(state.grid, index) === 0) return state;

  const cells = state.grid.split("");
  cells[index] = "0";
  return { ...state, grid: cells.join("") };
}

/** 切换某格的候选数字；已填数字的格不可编辑候选。 */
export function toggleNote(state: BoardState, givens: Grid81, index: number, digit: number): BoardState {
  if (digit < 1 || digit > 9) return state;
  if (isGiven(givens, index)) return state;
  if (digitAt(state.grid, index) !== 0) return state;

  const notes = state.notes.slice();
  const bit = 1 << (digit - 1);
  notes[index] = (notes[index] ?? 0) ^ bit;

  return { ...state, notes };
}

/** 清除同行、同列、同宫里指定数字的候选。 */
export function clearPeerNotes(notes: readonly number[], index: number, digit: number): number[] {
  const clearMask = ~(1 << (digit - 1));
  const next = notes.slice();

  for (const peer of peersOf(index)) {
    next[peer] = (next[peer] ?? 0) & clearMask;
  }
  // 本格候选保留（隐藏），删数字后恢复
  return next;
}

/** 候选数展开成数字数组。 */
export function digitsFromNotes(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if ((mask & (1 << (d - 1))) !== 0) out.push(d);
  }
  return out;
}
