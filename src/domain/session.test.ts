import { describe, expect, it } from "vitest";
import {
  canEdit,
  isTerminal,
  isTiming,
  transition,
  TransitionError,
  type MachineStatus,
  type SessionEvent,
} from "./sessionMachine";
import { countsTowardBestTime, countsTowardCompletion, recordOutcome, recordStart } from "./stats";
import { createTimer, elapsedMs, formatDuration, pauseTimer, resetTimer, startTimer } from "./timer";
import { createDefaultStats, type GameSession, type SessionStatus, type Stats } from "./types";

const GIVENS = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function event(type: SessionEvent["type"]): SessionEvent {
  return type === "PAUSE" ? { type, reason: "manual" } : ({ type } as SessionEvent);
}

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: "s1",
    puzzleId: "p1",
    puzzleSnapshot: { givens: GIVENS, solution: SOLUTION, difficulty: "easy", ratingVersion: "1.0.0" },
    currentGrid: SOLUTION,
    notes: Array.from({ length: 81 }, () => 0),
    status: "completed",
    isPractice: false,
    elapsedMs: 60_000,
    assisted: false,
    machineSolved: false,
    hintCount: 0,
    checkCount: 0,
    startedAt: "2026-10-28T10:00:00.000Z",
    updatedAt: "2026-10-28T10:10:00.000Z",
    completedAt: "2026-10-28T10:10:00.000Z",
    ...overrides,
  };
}

function stats(overrides: Partial<Stats> = {}): Stats {
  return { ...createDefaultStats("2026-10-28T00:00:00.000Z"), ...overrides };
}

describe("sessionMachine", () => {
  it("正常路径：ready → playing → paused → playing → completed", () => {
    let status: MachineStatus = "ready";
    status = transition(status, event("FIRST_MOVE"));
    expect(status).toBe("playing");
    status = transition(status, event("PAUSE"));
    expect(status).toBe("paused");
    status = transition(status, event("RESUME"));
    expect(status).toBe("playing");
    status = transition(status, event("COMPLETE"));
    expect(status).toBe("completed");
  });

  it("机器求解进入 solved", () => {
    expect(transition("playing", event("SOLVE"))).toBe("solved");
  });

  it("放弃后仍可恢复", () => {
    const abandoned = transition("playing", event("ABANDON"));
    expect(abandoned).toBe("abandoned");
    expect(transition(abandoned, event("RESUME"))).toBe("playing");
  });

  it("终态不能迁移", () => {
    expect(() => transition("completed", event("PAUSE"))).toThrow(TransitionError);
    expect(() => transition("completed", event("FIRST_MOVE"))).toThrow(TransitionError);
    expect(() => transition("solved", event("RESUME"))).toThrow(TransitionError);
  });

  it("ready 不能直接完成", () => {
    expect(() => transition("ready", event("COMPLETE"))).toThrow(TransitionError);
  });

  it("状态判断", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("solved")).toBe(true);
    expect(isTerminal("playing")).toBe(false);

    expect(canEdit("playing")).toBe(true);
    expect(canEdit("ready")).toBe(true);
    expect(canEdit("paused")).toBe(false);
    expect(canEdit("completed")).toBe(false);

    expect(isTiming("playing")).toBe(true);
    expect(isTiming("paused")).toBe(false);
  });
});

describe("timer", () => {
  it("累计运行区间", () => {
    let timer = createTimer();
    timer = startTimer(timer, 1_000);
    expect(elapsedMs(timer, 3_500)).toBe(2_500);

    timer = pauseTimer(timer, 3_500);
    expect(elapsedMs(timer, 9_000)).toBe(2_500);

    timer = startTimer(timer, 9_000);
    expect(elapsedMs(timer, 9_500)).toBe(3_000);
  });

  it("重复 start 不重置起点", () => {
    const started = startTimer(createTimer(), 1_000);
    expect(startTimer(started, 2_000)).toBe(started);
  });

  it("重复 pause 不重复累加", () => {
    const started = startTimer(createTimer(), 0);
    const paused = pauseTimer(started, 1_000);
    expect(pauseTimer(paused, 2_000)).toBe(paused);
  });

  it("reset 清零但保留运行状态", () => {
    const running = startTimer(createTimer(), 1_000);
    const reset = resetTimer(running, 5_000);
    expect(elapsedMs(reset, 6_000)).toBe(1_000);
  });

  it("格式化时长", () => {
    expect(formatDuration(0)).toBe("00:00");
    expect(formatDuration(65_000)).toBe("01:05");
    expect(formatDuration(3_725_000)).toBe("1:02:05");
  });
});

describe("stats 口径", () => {
  it("完成的判定条件", () => {
    expect(countsTowardCompletion(makeSession())).toBe(true);
    expect(countsTowardCompletion(makeSession({ isPractice: true }))).toBe(false);
    expect(countsTowardCompletion(makeSession({ machineSolved: true }))).toBe(false);
    expect(countsTowardCompletion(makeSession({ status: "playing" }))).toBe(false);
  });

  it("最佳时间要求无辅助", () => {
    expect(countsTowardBestTime(makeSession())).toBe(true);
    expect(countsTowardBestTime(makeSession({ assisted: true }))).toBe(false);
    expect(countsTowardBestTime(makeSession({ checkCount: 1, assisted: true }))).toBe(false);
  });

  it("无辅助完成：计入完成率与最佳时间", () => {
    const next = recordOutcome(stats(), makeSession({ elapsedMs: 90_000 }), {
      now: "2026-10-28T10:10:00.000Z",
      today: "2026-10-28",
    });

    expect(next.totalCompleted).toBe(1);
    expect(next.assistedCompleted).toBe(0);
    expect(next.bestTimeByDifficulty.easy).toBe(90_000);
    expect(next.currentStreak).toBe(1);
  });

  it("使用辅助完成：计入完成率但不计最佳时间", () => {
    const next = recordOutcome(stats(), makeSession({ assisted: true, elapsedMs: 90_000 }), {
      now: "2026-10-28T10:10:00.000Z",
      today: "2026-10-28",
    });

    expect(next.totalCompleted).toBe(1);
    expect(next.assistedCompleted).toBe(1);
    expect(next.bestTimeByDifficulty.easy).toBeUndefined();
  });

  it("只有更快的成绩才更新最佳时间", () => {
    const prev = stats({ bestTimeByDifficulty: { easy: 60_000 } });
    const next = recordOutcome(prev, makeSession({ elapsedMs: 90_000 }), {
      now: "2026-10-28T10:10:00.000Z",
      today: "2026-10-28",
    });
    expect(next.bestTimeByDifficulty.easy).toBe(60_000);
  });

  it("机器求解：只计 machineSolved", () => {
    const next = recordOutcome(
      stats(),
      makeSession({ status: "solved", machineSolved: true, elapsedMs: 10_000 }),
      { now: "2026-10-28T10:10:00.000Z", today: "2026-10-28" },
    );

    expect(next.machineSolved).toBe(1);
    expect(next.totalCompleted).toBe(0);
    expect(next.bestTimeByDifficulty.easy).toBeUndefined();
    expect(next.lastCompletedDate).toBeNull();
  });

  it("放弃：只计 totalAbandoned", () => {
    const next = recordOutcome(stats(), makeSession({ status: "abandoned" }), {
      now: "2026-10-28T10:10:00.000Z",
      today: "2026-10-28",
    });
    expect(next.totalAbandoned).toBe(1);
    expect(next.totalCompleted).toBe(0);
  });

  it("练习模式完成：不计完成率也不计最佳时间", () => {
    const next = recordOutcome(stats(), makeSession({ isPractice: true }), {
      now: "2026-10-28T10:10:00.000Z",
      today: "2026-10-28",
    });
    expect(next.totalCompleted).toBe(0);
    expect(next.bestTimeByDifficulty.easy).toBeUndefined();
  });

  it("进行中的对局不改变统计", () => {
    const prev = stats({ totalCompleted: 3 });
    expect(recordOutcome(prev, makeSession({ status: "playing" as SessionStatus }), {
      now: "2026-10-28T10:10:00.000Z",
      today: "2026-10-28",
    })).toBe(prev);
  });

  it("连续天数：同日不重复、连续 +1、断档重置", () => {
    let current = stats();

    current = recordOutcome(current, makeSession(), { now: "2026-10-27T10:00:00.000Z", today: "2026-10-27" });
    expect(current.currentStreak).toBe(1);

    current = recordOutcome(current, makeSession(), { now: "2026-10-27T20:00:00.000Z", today: "2026-10-27" });
    expect(current.currentStreak).toBe(1);

    current = recordOutcome(current, makeSession(), { now: "2026-10-28T10:00:00.000Z", today: "2026-10-28" });
    expect(current.currentStreak).toBe(2);

    current = recordOutcome(current, makeSession(), { now: "2026-10-31T10:00:00.000Z", today: "2026-10-31" });
    expect(current.currentStreak).toBe(1);
    expect(current.longestStreak).toBe(2);
  });

  it("recordStart 只增加开始数", () => {
    const next = recordStart(stats(), { now: "2026-10-28T10:00:00.000Z" });
    expect(next.totalStarted).toBe(1);
    expect(next.totalCompleted).toBe(0);
  });
});
