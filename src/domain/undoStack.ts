/**
 * 撤销 / 重做（SRS 5.1：至少 100 步；本实现 200 步）。
 *
 * 存差量而不是整盘快照：一步只记录一格的四个值，200 步约 20 kB，
 * 满足 NFR-PERF-007 的「30 局后内存 ≤ 150 MB」。
 *
 * 语义：`entries[0 .. cursor-1]` 是已经应用的操作。
 */

export interface UndoEntry {
  readonly index: number;
  /** 操作前的数字，0 表示空。 */
  readonly prevValue: number;
  readonly nextValue: number;
  readonly prevNotes: number;
  readonly nextNotes: number;
  /** 毫秒时间戳，用于调试与合并相邻操作。 */
  readonly at: number;
}

export interface UndoStack {
  readonly entries: readonly UndoEntry[];
  readonly cursor: number;
  readonly capacity: number;
}

export const DEFAULT_UNDO_CAPACITY = 200;

export function createUndoStack(capacity: number = DEFAULT_UNDO_CAPACITY): UndoStack {
  return { entries: [], cursor: 0, capacity };
}

/** 追加一步；处在撤销历史中间时，新操作会丢弃 redo 分支。 */
export function push(stack: UndoStack, entry: UndoEntry): UndoStack {
  const kept = stack.entries.slice(0, stack.cursor);
  kept.push(entry);

  const overflow = Math.max(0, kept.length - stack.capacity);
  const entries = overflow > 0 ? kept.slice(overflow) : kept;

  return { ...stack, entries, cursor: entries.length };
}

export function undo(stack: UndoStack): { readonly stack: UndoStack; readonly entry: UndoEntry | null } {
  if (stack.cursor === 0) return { stack, entry: null };

  const cursor = stack.cursor - 1;
  return { stack: { ...stack, cursor }, entry: stack.entries[cursor] ?? null };
}

export function redo(stack: UndoStack): { readonly stack: UndoStack; readonly entry: UndoEntry | null } {
  if (stack.cursor >= stack.entries.length) return { stack, entry: null };

  const entry = stack.entries[stack.cursor] ?? null;
  return { stack: { ...stack, cursor: stack.cursor + 1 }, entry };
}

export function canUndo(stack: UndoStack): boolean {
  return stack.cursor > 0;
}

export function canRedo(stack: UndoStack): boolean {
  return stack.cursor < stack.entries.length;
}

/** 当前历史深度（用于「已撤销 N 步」这类提示）。 */
export function depth(stack: UndoStack): number {
  return stack.entries.length;
}
