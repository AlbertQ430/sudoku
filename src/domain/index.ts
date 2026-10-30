/**
 * 领域层公共出口。
 *
 * 这里只放纯函数与类型：不依赖 React、不直接碰 Dexie，便于单测与复用。
 */

export type {
  Favorite,
  GameSession,
  Puzzle,
  PuzzleDifficulty,
  PuzzleSnapshot,
  PuzzleSource,
  SessionStatus,
  Settings,
  Stats,
  ThemePreference,
} from "./types";
export { createDefaultSettings, createDefaultStats } from "./types";

export {
  clearCell,
  clearPeerNotes,
  createBoardState,
  digitAt,
  digitsFromNotes,
  isGiven,
  peersOf,
  placeDigit,
  selectCell,
  setNotesMode,
  toggleNote,
} from "./boardState";
export type { BoardState, PlaceOptions } from "./boardState";

export { canRedo, canUndo, createUndoStack, depth, push, redo, undo } from "./undoStack";
export type { UndoEntry, UndoStack } from "./undoStack";

export { checkBoard, summarizeCheck } from "./checker";
export type { CheckResult, PlayMode } from "./checker";

export { canEdit, isTerminal, isTiming, transition, TransitionError } from "./sessionMachine";
export type { MachineStatus, SessionEvent } from "./sessionMachine";

export { createTimer, elapsedMs, formatDuration, pauseTimer, resetTimer, startTimer } from "./timer";
export type { TimerState } from "./timer";

export {
  applyStreak,
  countsTowardBestTime,
  countsTowardCompletion,
  recordOutcome,
  recordStart,
} from "./stats";
export type { StatsContext } from "./stats";
