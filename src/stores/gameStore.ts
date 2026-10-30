/**
 * 对局状态（Zustand）。
 *
 * 设计约束：
 * - store 只编排领域函数，不实现规则（规则全在 `domain/*`）；
 * - 持久化通过注入的 `GameAdapter`，store 不直接碰 Dexie；
 * - 时间源与 id 生成可注入，测试不依赖真实时钟。
 */

import { create } from "zustand";
import { filledCount } from "../engine/conflicts";
import {
  canEdit,
  checkBoard,
  clearCell as clearBoardCell,
  createBoardState,
  createTimer,
  createUndoStack,
  digitAt,
  elapsedMs as timerElapsed,
  isTerminal,
  pauseTimer,
  placeDigit as placeOnBoard,
  push,
  redo as redoStack,
  selectCell as selectBoardCell,
  setNotesMode as setBoardNotesMode,
  startTimer,
  toggleNote as toggleBoardNote,
  transition,
  undo as undoStack,
  type BoardState,
  type CheckResult,
  type GameSession,
  type MachineStatus,
  type Puzzle,
  type TimerState,
  type UndoEntry,
  type UndoStack,
} from "../domain";

export interface GameAdapter {
  onStart(session: GameSession): Promise<void>;
  onUpdate(session: GameSession): Promise<void>;
  onFinish(session: GameSession): Promise<void>;
  onAbandon(session: GameSession): Promise<void>;
}

export interface GameStoreOptions {
  readonly now?: () => number;
  readonly isoNow?: () => string;
  readonly newId?: () => string;
}

export interface GameState {
  readonly puzzle: Puzzle | null;
  readonly sessionId: string | null;
  readonly board: BoardState;
  readonly history: UndoStack;
  readonly status: MachineStatus;
  readonly timer: TimerState;
  readonly elapsed: number;
  readonly startedAtIso: string | null;
  readonly assisted: boolean;
  readonly machineSolved: boolean;
  readonly hintCount: number;
  readonly checkCount: number;
  readonly checkResult: CheckResult | null;
  readonly error: string | null;
  /** 填入数字后是否清除同行列宫的候选（来自设置，跨对局保留）。 */
  readonly autoRemoveNotes: boolean;

  startPuzzle(puzzle: Puzzle): void;
  /** 从持久化的对局恢复（SRS FR-PLY：刷新后可继续）。 */
  restore(session: GameSession, puzzle: Puzzle): void;
  place(index: number, digit: number): void;
  clear(index: number): void;
  toggleNote(index: number, digit: number): void;
  select(index: number | null): void;
  setNotesMode(on: boolean): void;
  setAutoRemoveNotes(on: boolean): void;
  undo(): void;
  redo(): void;
  pause(): void;
  resume(): void;
  checkAnswers(): void;
  solveCurrent(): void;
  abandon(): void;
  tick(): void;
  reset(): void;
}

const EMPTY_BOARD = createBoardState("0".repeat(81));

export function createGameStore(adapter: GameAdapter, options: GameStoreOptions = {}) {
  const now = options.now ?? (() => performance.now());
  const isoNow = options.isoNow ?? (() => new Date().toISOString());
  const newId = options.newId ?? (() => crypto.randomUUID());

  return create<GameState>()((set, get) => {
    function snapshot(): GameSession | null {
      const state = get();
      const { puzzle, sessionId, board, status } = state;
      if (puzzle === null || sessionId === null) return null;
      if (status === "ready") return null;

      return {
        id: sessionId,
        puzzleId: puzzle.id,
        puzzleSnapshot: {
          givens: puzzle.givens,
          solution: puzzle.solution,
          difficulty: puzzle.difficulty,
          ratingVersion: puzzle.ratingVersion,
        },
        currentGrid: board.grid,
        notes: [...board.notes],
        status,
        isPractice: false,
        elapsedMs: Math.round(timerElapsed(state.timer, now())),
        assisted: state.assisted,
        machineSolved: state.machineSolved,
        hintCount: state.hintCount,
        checkCount: state.checkCount,
        startedAt: state.startedAtIso ?? isoNow(),
        updatedAt: isoNow(),
        completedAt: isTerminal(status) ? isoNow() : null,
      };
    }

    async function persistUpdate(): Promise<void> {
      const session = snapshot();
      if (session !== null) await adapter.onUpdate(session);
    }

    async function persistFinish(): Promise<void> {
      const session = snapshot();
      if (session !== null) await adapter.onFinish(session);
    }

    async function persistAbandon(): Promise<void> {
      const session = snapshot();
      if (session !== null) await adapter.onAbandon(session);
    }

    /** 首次落子：ready → playing，并开始计时。 */
    function beginPlay(): { status: MachineStatus; timer: TimerState; startedAtIso: string } {
      const state = get();
      return {
        status: transition(state.status, { type: "FIRST_MOVE" }),
        timer: startTimer(state.timer, now()),
        startedAtIso: state.startedAtIso ?? isoNow(),
      };
    }

    function recordEntry(
      before: BoardState,
      after: BoardState,
      index: number,
      prevValue: number,
      nextValue: number,
    ): UndoEntry {
      return {
        index,
        prevValue,
        nextValue,
        prevNotes: before.notes[index] ?? 0,
        nextNotes: after.notes[index] ?? 0,
        at: now(),
      };
    }

    return {
      puzzle: null,
      sessionId: null,
      board: EMPTY_BOARD,
      history: createUndoStack(),
      status: "ready",
      timer: createTimer(),
      elapsed: 0,
      startedAtIso: null,
      assisted: false,
      machineSolved: false,
      hintCount: 0,
      checkCount: 0,
      checkResult: null,
      error: null,
      autoRemoveNotes: true,

      startPuzzle(puzzle: Puzzle): void {
        set({
          puzzle,
          sessionId: newId(),
          board: createBoardState(puzzle.givens),
          history: createUndoStack(),
          status: "ready",
          timer: createTimer(),
          elapsed: 0,
          startedAtIso: null,
          assisted: false,
          machineSolved: false,
          hintCount: 0,
          checkCount: 0,
          checkResult: null,
          error: null,
        });
      },

      restore(session: GameSession, puzzle: Puzzle): void {
        // 撤销历史不持久化：恢复后从干净的栈开始，避免回退到刷新前的操作
        const running = session.status === "playing";

        set({
          puzzle,
          sessionId: session.id,
          board: {
            grid: session.currentGrid,
            notes: session.notes,
            selected: null,
            notesMode: false,
          },
          history: createUndoStack(),
          status: session.status,
          timer: {
            accumulatedMs: session.elapsedMs,
            startedAt: running ? now() : null,
          },
          elapsed: session.elapsedMs,
          startedAtIso: session.startedAt,
          assisted: session.assisted,
          machineSolved: session.machineSolved,
          hintCount: session.hintCount,
          checkCount: session.checkCount,
          checkResult: null,
          error: null,
        });
      },

      place(index: number, digit: number): void {
        const state = get();
        if (state.puzzle === null || !canEdit(state.status)) return;

        const nextBoard = placeOnBoard(state.board, state.puzzle.givens, index, digit, {
          autoRemoveNotes: state.autoRemoveNotes,
        });
        if (nextBoard === state.board) return;

        const entered = state.status === "ready" ? beginPlay() : null;

        set({
          board: nextBoard,
          history: push(
            state.history,
            recordEntry(state.board, nextBoard, index, digitAt(state.board.grid, index), digit),
          ),
          status: entered?.status ?? state.status,
          timer: entered?.timer ?? state.timer,
          startedAtIso: entered?.startedAtIso ?? state.startedAtIso,
          checkResult: null,
        });

        void persistUpdate();

        // 落满最后一格：自动完成判定（SRS 3.7 的「填满时自动」）。
        // 这一步不计辅助，只是把「还差几格」换成「哪几格错了」。
        if (filledCount(nextBoard.grid) === 81) {
          get().checkAnswers();
        }
      },

      clear(index: number): void {
        const state = get();
        if (state.puzzle === null || !canEdit(state.status)) return;

        const nextBoard = clearBoardCell(state.board, state.puzzle.givens, index);
        if (nextBoard === state.board) return;

        set({
          board: nextBoard,
          history: push(
            state.history,
            recordEntry(state.board, nextBoard, index, digitAt(state.board.grid, index), 0),
          ),
          checkResult: null,
        });

        void persistUpdate();
      },

      toggleNote(index: number, digit: number): void {
        const state = get();
        if (state.puzzle === null || !canEdit(state.status)) return;

        const nextBoard = toggleBoardNote(state.board, state.puzzle.givens, index, digit);
        if (nextBoard === state.board) return;

        const value = digitAt(state.board.grid, index);
        set({
          board: nextBoard,
          history: push(state.history, recordEntry(state.board, nextBoard, index, value, value)),
        });

        void persistUpdate();
      },

      select(index: number | null): void {
        set({ board: selectBoardCell(get().board, index) });
      },

      setNotesMode(on: boolean): void {
        set({ board: setBoardNotesMode(get().board, on) });
      },

      setAutoRemoveNotes(on: boolean): void {
        set({ autoRemoveNotes: on });
      },

      undo(): void {
        const state = get();
        if (!canEdit(state.status)) return;

        const result = undoStack(state.history);
        if (result.entry === null) return;

        const cells = state.board.grid.split("");
        cells[result.entry.index] = String(result.entry.prevValue);
        const notes = state.board.notes.slice();
        notes[result.entry.index] = result.entry.prevNotes;

        set({
          history: result.stack,
          board: { ...state.board, grid: cells.join(""), notes },
          checkResult: null,
        });

        void persistUpdate();
      },

      redo(): void {
        const state = get();
        if (!canEdit(state.status)) return;

        const result = redoStack(state.history);
        if (result.entry === null) return;

        const cells = state.board.grid.split("");
        cells[result.entry.index] = String(result.entry.nextValue);
        const notes = state.board.notes.slice();
        notes[result.entry.index] = result.entry.nextNotes;

        set({
          history: result.stack,
          board: { ...state.board, grid: cells.join(""), notes },
          checkResult: null,
        });

        void persistUpdate();
      },

      pause(): void {
        const state = get();
        if (state.status !== "playing") return;

        set({
          status: transition(state.status, { type: "PAUSE", reason: "manual" }),
          timer: pauseTimer(state.timer, now()),
        });

        void persistUpdate();
      },

      resume(): void {
        const state = get();
        if (state.status !== "paused") return;

        set({
          status: transition(state.status, { type: "RESUME" }),
          timer: startTimer(state.timer, now()),
        });
      },

      checkAnswers(): void {
        const state = get();
        if (state.puzzle === null || isTerminal(state.status)) return;

        const result = checkBoard(state.board.grid, state.puzzle.givens, state.puzzle.solution);

        // 尚未落子（包括「81 个给定数的完整题面」）：只给检查结果，不迁移状态
        if (state.status === "ready") {
          set({ checkResult: result });
          return;
        }

        // 未填满不检查（SRS V1.2）：检查只在填满时自动触发
        if (result.empty > 0) return;

        const completing = result.complete;

        // 检查答案不计辅助（SRS V1.2 / D6 修订）：它只在填满时自动触发，
        // 属于完成判定的一部分，不是用户主动求助。
        set({
          checkResult: result,
          checkCount: state.checkCount + 1,
          status: completing ? transition(state.status, { type: "COMPLETE" }) : state.status,
          timer: completing ? pauseTimer(state.timer, now()) : state.timer,
          elapsed: completing ? timerElapsed(state.timer, now()) : state.elapsed,
        });

        void (completing ? persistFinish() : persistUpdate());
      },

      solveCurrent(): void {
        const state = get();
        if (state.puzzle === null || isTerminal(state.status)) return;
        // 没有开始对局就没有「求解本题」的语义
        if (state.status === "ready" || state.status === "abandoned") return;

        set({
          board: { ...state.board, grid: state.puzzle.solution },
          status: transition(state.status, { type: "SOLVE" }),
          timer: pauseTimer(state.timer, now()),
          elapsed: timerElapsed(state.timer, now()),
          machineSolved: true,
          assisted: true,
          checkResult: null,
        });

        void persistFinish();
      },

      abandon(): void {
        const state = get();
        if (state.status === "ready") return;
        if (isTerminal(state.status) || state.status === "abandoned") return;

        set({
          status: transition(state.status, { type: "ABANDON" }),
          timer: pauseTimer(state.timer, now()),
        });

        void persistAbandon();
      },

      tick(): void {
        const state = get();
        if (state.status !== "playing") return;
        set({ elapsed: timerElapsed(state.timer, now()) });
      },

      reset(): void {
        set({
          puzzle: null,
          sessionId: null,
          board: EMPTY_BOARD,
          history: createUndoStack(),
          status: "ready",
          timer: createTimer(),
          elapsed: 0,
          startedAtIso: null,
          assisted: false,
          machineSolved: false,
          hintCount: 0,
          checkCount: 0,
          checkResult: null,
          error: null,
        });
      },
    };
  });
}

export type GameStore = ReturnType<typeof createGameStore>;
