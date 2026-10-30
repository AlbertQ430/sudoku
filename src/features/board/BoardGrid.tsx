/**
 * 棋盘容器：网格语义 + roving tabindex（NFR-A11Y-002/003）。
 *
 * 键盘模型：
 * - 方向键移动焦点（选中格即焦点格）；
 * - 1–9 填数（候选模式下切换候选）；
 * - Backspace/Delete 清除；
 * - N 切换候选模式；
 * - Escape 取消选中。
 */

import { useEffect, useMemo, useRef } from "react";
import { colOf, rowOf } from "../../engine/bitset";
import { findConflicts } from "../../engine/conflicts";
import { peersOf } from "../../domain/boardState";
import { Cell } from "./Cell";

export interface BoardGridProps {
  readonly grid: string;
  readonly givens: string;
  readonly notes: readonly number[];
  readonly selected: number | null;
  readonly notesMode: boolean;
  readonly wrongCells?: readonly number[];
  /** 关掉后不标冲突（设置项 showConflicts）。 */
  readonly showConflicts?: boolean;
  /** 关掉后不高亮同行列宫（设置项 highlightPeers）。 */
  readonly highlightPeers?: boolean;
  /** 关掉后不高亮相同数字（设置项 highlightSameNumber）。 */
  readonly highlightSameNumber?: boolean;
  readonly onSelect: (index: number | null) => void;
  readonly onPlace: (index: number, digit: number) => void;
  readonly onClear: (index: number) => void;
  readonly onToggleNote: (index: number, digit: number) => void;
  readonly onToggleNotesMode: () => void;
}

const INDICES = Array.from({ length: 81 }, (_, i) => i);

export function BoardGrid(props: BoardGridProps) {
  const { grid, givens, notes, selected, notesMode, wrongCells } = props;
  const showConflicts = props.showConflicts ?? true;
  const highlightPeers = props.highlightPeers ?? true;
  const highlightSameNumber = props.highlightSameNumber ?? true;
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  const conflictCells = useMemo(
    () => (showConflicts ? new Set(findConflicts(grid).cells) : new Set<number>()),
    [grid, showConflicts],
  );
  const wrong = useMemo(() => new Set(wrongCells ?? []), [wrongCells]);
  const peerCells = useMemo(
    () => (selected === null || !highlightPeers ? new Set<number>() : new Set(peersOf(selected))),
    [selected, highlightPeers],
  );

  const selectedDigit = selected === null ? 0 : Number(grid.charAt(selected)) || 0;

  useEffect(() => {
    if (selected !== null) refs.current[selected]?.focus();
  }, [selected]);

  const focusIndex = selected ?? 0;

  function move(row: number, col: number): void {
    const nextRow = Math.min(8, Math.max(0, row));
    const nextCol = Math.min(8, Math.max(0, col));
    props.onSelect(nextRow * 9 + nextCol);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const current = selected ?? 0;
    const row = rowOf(current);
    const col = colOf(current);

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        move(row - 1, col);
        return;
      case "ArrowDown":
        event.preventDefault();
        move(row + 1, col);
        return;
      case "ArrowLeft":
        event.preventDefault();
        move(row, col - 1);
        return;
      case "ArrowRight":
        event.preventDefault();
        move(row, col + 1);
        return;
      case "Backspace":
      case "Delete":
        event.preventDefault();
        props.onClear(current);
        return;
      case "Escape":
        event.preventDefault();
        props.onSelect(null);
        return;
      case "n":
      case "N":
        event.preventDefault();
        props.onToggleNotesMode();
        return;
      default:
        break;
    }

    if (event.key >= "1" && event.key <= "9") {
      event.preventDefault();
      const digit = Number(event.key);
      if (notesMode) props.onToggleNote(current, digit);
      else props.onPlace(current, digit);
    }
  }

  return (
    <div
      role="grid"
      aria-label="数独棋盘"
      aria-rowcount={9}
      aria-colcount={9}
      onKeyDown={handleKeyDown}
      className="grid aspect-square w-full grid-cols-9 gap-px border-2 border-slate-700 bg-slate-700"
    >
      {Array.from({ length: 9 }, (_, row) => (
        <div role="row" key={row} className="contents">
          {INDICES.slice(row * 9, row * 9 + 9).map((index) => (
            <Cell
              key={index}
              index={index}
              digit={Number(grid.charAt(index)) || 0}
              notes={notesFor(index, notes)}
              given={givens.charAt(index) !== "0"}
              selected={selected === index}
              conflict={conflictCells.has(index)}
              wrong={wrong.has(index)}
              peer={peerCells.has(index)}
              sameNumber={
                highlightSameNumber && selectedDigit > 0 && Number(grid.charAt(index)) === selectedDigit
              }
              tabStop={index === focusIndex}
              onSelect={props.onSelect}
              registerRef={(i, element) => {
                refs.current[i] = element;
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 把位掩码展开成数字数组，供展示与朗读使用。 */
function notesFor(index: number, notes: readonly number[]): number[] {
  const mask = notes[index] ?? 0;
  if (mask === 0) return [];

  const result: number[] = [];
  for (let digit = 1; digit <= 9; digit++) {
    if ((mask & (1 << (digit - 1))) !== 0) result.push(digit);
  }
  return result;
}
