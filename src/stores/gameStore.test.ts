import { describe, expect, it, vi } from "vitest";
import type { GameSession, Puzzle } from "../domain";
import { createGameStore, type GameAdapter } from "./gameStore";

const GIVENS = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const EMPTY = "0".repeat(81);

function makePuzzle(overrides: Partial<Puzzle> = {}): Puzzle {
  return {
    id: "p1",
    canonicalKey: GIVENS,
    givens: GIVENS,
    solution: SOLUTION,
    difficulty: "easy",
    ratingVersion: "1.0.0",
    source: "generated",
    symmetry: "rotational",
    seed: "seed",
    title: "",
    tags: [],
    createdAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T00:00:00.000Z",
    ...overrides,
  };
}

function makeHarness() {
  const calls = {
    start: [] as GameSession[],
    update: [] as GameSession[],
    finish: [] as GameSession[],
    abandon: [] as GameSession[],
  };

  const adapter: GameAdapter = {
    onStart: vi.fn(async (session: GameSession) => {
      calls.start.push(session);
    }),
    onUpdate: vi.fn(async (session: GameSession) => {
      calls.update.push(session);
    }),
    onFinish: vi.fn(async (session: GameSession) => {
      calls.finish.push(session);
    }),
    onAbandon: vi.fn(async (session: GameSession) => {
      calls.abandon.push(session);
    }),
  };

  let clock = 0;
  const store = createGameStore(adapter, {
    now: () => clock,
    isoNow: () => "2026-10-29T00:00:00.000Z",
    newId: () => "session-1",
  });

  return {
    store,
    calls,
    advance(ms: number) {
      clock += ms;
      return this;
    },
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("gameStore 初始化", () => {
  it("开始一局后处于 ready 且棋盘为给定数", () => {
    const { store } = makeHarness();
    store.getState().startPuzzle(makePuzzle());

    const state = store.getState();
    expect(state.puzzle?.id).toBe("p1");
    expect(state.sessionId).toBe("session-1");
    expect(state.status).toBe("ready");
    expect(state.board.grid).toBe(GIVENS);
  });
});

describe("落子与撤销", () => {
  it("首次落子进入 playing 并记录开始时间", () => {
    const { store, advance } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    advance(1_000);
    store.getState().place(2, 4);

    const state = store.getState();
    expect(state.status).toBe("playing");
    expect(state.startedAtIso).not.toBeNull();
    expect(state.board.grid.charAt(2)).toBe("4");
  });

  it("给定数不可覆盖", () => {
    const { store } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    store.getState().place(0, 9);
    expect(store.getState().board.grid).toBe(GIVENS);
  });

  it("撤销与重做还原数字", () => {
    const { store, advance } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    advance(100);
    store.getState().place(2, 4);

    store.getState().undo();
    expect(store.getState().board.grid.charAt(2)).toBe("0");

    store.getState().redo();
    expect(store.getState().board.grid.charAt(2)).toBe("4");
  });

  it("撤销后新落子丢弃 redo 分支", () => {
    const { store, advance } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    advance(100);
    store.getState().place(2, 4);
    store.getState().undo();
    store.getState().place(3, 1);

    const stack = store.getState().history;
    expect(stack.entries).toHaveLength(1);
    expect(stack.cursor).toBe(1);
  });

  it("候选数可以切换并进入撤销栈", () => {
    const { store } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    store.getState().toggleNote(2, 7);
    expect(store.getState().board.notes[2]).toBe(1 << 6);

    store.getState().undo();
    expect(store.getState().board.notes[2]).toBe(0);
  });

  it("默认开启自动清理：填入后清除同伴候选", () => {
    const { store } = makeHarness();
    store.getState().startPuzzle(makePuzzle({ givens: EMPTY, solution: SOLUTION }));
    store.getState().toggleNote(1, 5);
    store.getState().place(0, 5);

    expect(store.getState().board.notes[1]).toBe(0);
  });

  it("关闭自动清理后保留同伴候选（设置项生效）", () => {
    const { store } = makeHarness();
    store.getState().startPuzzle(makePuzzle({ givens: EMPTY, solution: SOLUTION }));
    store.getState().setAutoRemoveNotes(false);
    store.getState().toggleNote(1, 5);
    store.getState().place(0, 5);

    expect(store.getState().board.notes[1]).toBe(1 << 4);
  });

  it("自动清理偏好跨对局保留", () => {
    const { store } = makeHarness();
    store.getState().setAutoRemoveNotes(false);
    store.getState().startPuzzle(makePuzzle());
    expect(store.getState().autoRemoveNotes).toBe(false);
  });
});

describe("计时与暂停", () => {
  it("暂停后 elapsed 停止增长", () => {
    const { store, advance } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    advance(1_000);
    store.getState().place(2, 4);

    advance(10_000);
    store.getState().tick();
    expect(store.getState().elapsed).toBe(10_000);

    store.getState().pause();
    advance(5_000);
    store.getState().tick();
    expect(store.getState().elapsed).toBe(10_000);

    store.getState().resume();
    advance(2_000);
    store.getState().tick();
    expect(store.getState().elapsed).toBe(12_000);
  });

  it("未开始时不能暂停", () => {
    const { store } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    store.getState().pause();
    expect(store.getState().status).toBe("ready");
  });
});

describe("检查答案", () => {
  it("未填满时检查不生效（SRS V1.2：只在填满时自动触发）", async () => {
    const { store, advance } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    advance(100);
    store.getState().place(2, 1); // 正确答案是 4
    store.getState().checkAnswers();
    await flush();

    const state = store.getState();
    expect(state.checkResult).toBeNull();
    expect(state.checkCount).toBe(0);
    expect(state.status).toBe("playing");
  });

  it("落满最后一格自动完成，且不计辅助", async () => {
    const { store, calls, advance } = makeHarness();
    const givens = `${SOLUTION.slice(0, 80)}0`;
    store.getState().startPuzzle(makePuzzle({ givens, solution: SOLUTION }));
    advance(100);
    store.getState().place(80, 9);
    await flush();

    const state = store.getState();
    expect(state.status).toBe("completed");
    expect(state.checkResult?.complete).toBe(true);
    expect(state.assisted).toBe(false);
    expect(calls.finish).toHaveLength(1);
    expect(calls.finish[0]?.assisted).toBe(false);
  });

  it("填满但填错时自动标错，不判完成", async () => {
    const { store, advance } = makeHarness();
    const givens = `${SOLUTION.slice(0, 80)}0`;
    store.getState().startPuzzle(makePuzzle({ givens, solution: SOLUTION }));
    advance(100);
    store.getState().place(80, 1); // 正确答案是 9
    await flush();

    const state = store.getState();
    expect(state.status).toBe("playing");
    expect(state.checkResult?.wrong).toEqual([80]);
    expect(state.checkResult?.complete).toBe(false);
    expect(state.assisted).toBe(false);
  });

  it("完整题面只给检查结果，不进入计时对局", async () => {
    const { store, calls, advance } = makeHarness();
    store.getState().startPuzzle(makePuzzle({ givens: SOLUTION, solution: SOLUTION }));
    advance(100);
    store.getState().checkAnswers();
    await flush();

    const state = store.getState();
    expect(state.checkResult?.complete).toBe(true);
    // ready 状态不迁移（SRS：已填满的题不产生对局记录）
    expect(state.status).toBe("ready");
    expect(calls.finish).toHaveLength(0);
  });

  it("对局中填满正确则完成", async () => {
    const { store, calls, advance } = makeHarness();
    store.getState().startPuzzle(makePuzzle({ givens: EMPTY, solution: SOLUTION }));
    advance(100);
    store.getState().place(0, 5);
    store.getState().solveCurrent();
    await flush();

    expect(store.getState().status).toBe("solved");
    expect(calls.finish).toHaveLength(1);
    expect(calls.finish[0]?.machineSolved).toBe(true);
  });
});

describe("求解与放弃", () => {
  it("求解本题进入 solved 并停表", async () => {
    const { store, calls, advance } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    advance(1_000);
    store.getState().place(2, 4);
    advance(5_000);
    store.getState().solveCurrent();
    await flush();

    const state = store.getState();
    expect(state.status).toBe("solved");
    expect(state.machineSolved).toBe(true);
    expect(state.board.grid).toBe(SOLUTION);
    expect(calls.finish[0]?.status).toBe("solved");
  });

  it("ready 状态不能求解", () => {
    const { store } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    store.getState().solveCurrent();
    expect(store.getState().status).toBe("ready");
  });

  it("放弃进入 abandoned", async () => {
    const { store, calls, advance } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    advance(100);
    store.getState().place(2, 4);
    store.getState().abandon();
    await flush();

    expect(store.getState().status).toBe("abandoned");
    expect(calls.abandon).toHaveLength(1);
  });

  it("终态不能再编辑", () => {
    const { store, advance } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    advance(100);
    store.getState().place(2, 4);
    store.getState().abandon();
    const grid = store.getState().board.grid;

    store.getState().place(3, 1);
    expect(store.getState().board.grid).toBe(grid);
  });
});

describe("持久化适配器", () => {
  it("落子会触发 onUpdate", async () => {
    const { store, calls, advance } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    advance(100);
    store.getState().place(2, 4);
    await flush();

    expect(calls.update.length).toBeGreaterThan(0);
    expect(calls.update.at(-1)?.currentGrid.charAt(2)).toBe("4");
  });

  it("ready 状态不产生对局记录", async () => {
    const { store, calls } = makeHarness();
    store.getState().startPuzzle(makePuzzle());
    await flush();

    expect(calls.update).toHaveLength(0);
    expect(calls.start).toHaveLength(0);
  });
});

describe("恢复对局（AC-09）", () => {
  function restoredSession(currentGrid: string, status: GameSession["status"]): GameSession {
    return {
      id: "session-restored",
      puzzleId: "p1",
      puzzleSnapshot: { givens: GIVENS, solution: SOLUTION, difficulty: "easy", ratingVersion: "1.0.0" },
      currentGrid,
      notes: Array.from({ length: 81 }, () => 0),
      status,
      isPractice: false,
      elapsedMs: 12_000,
      assisted: false,
      machineSolved: false,
      hintCount: 0,
      checkCount: 0,
      startedAt: "2026-10-29T10:00:00.000Z",
      updatedAt: "2026-10-29T10:05:00.000Z",
      completedAt: null,
    };
  }

  it("棋盘、用时与状态都被恢复", () => {
    const { store, advance } = makeHarness();
    const grid = GIVENS.split("");
    grid[2] = "4";

    advance(50_000);
    store.getState().restore(restoredSession(grid.join(""), "playing"), makePuzzle());

    const state = store.getState();
    expect(state.puzzle?.id).toBe("p1");
    expect(state.sessionId).toBe("session-restored");
    expect(state.board.grid.charAt(2)).toBe("4");
    expect(state.elapsed).toBe(12_000);
    expect(state.status).toBe("playing");
    expect(state.startedAtIso).toBe("2026-10-29T10:00:00.000Z");
  });

  it("暂停中的对局恢复后计时不再走表", () => {
    const { store, advance } = makeHarness();
    advance(50_000);
    store.getState().restore(restoredSession(GIVENS, "paused"), makePuzzle());

    expect(store.getState().status).toBe("paused");
    expect(store.getState().elapsed).toBe(12_000);
    store.getState().tick();
    expect(store.getState().elapsed).toBe(12_000);
  });

  it("恢复后可以继续落子", () => {
    const { store, advance } = makeHarness();
    advance(100);
    store.getState().restore(restoredSession(GIVENS, "playing"), makePuzzle());

    store.getState().place(2, 4);
    expect(store.getState().board.grid.charAt(2)).toBe("4");
  });
});
