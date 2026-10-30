/**
 * 领域实体类型（对齐 SRS 6.2 数据字典）。
 *
 * 这里只描述「落库的形状」，不包含业务规则；规则在 `domain/*.ts` 的纯函数里。
 */

import type { Difficulty, Symmetry } from "../engine/types";

/** 题目来源。 */
export type PuzzleSource = "generated" | "custom" | "imported";

/** 题目难度：五档 + 自定义题（自定义题不评级）。 */
export type PuzzleDifficulty = Difficulty | "custom";

export interface Puzzle {
  readonly id: string;
  /** 81 位，`0` 表示空；唯一索引，用于去重。 */
  readonly canonicalKey: string;
  readonly givens: string;
  readonly solution: string;
  readonly difficulty: PuzzleDifficulty;
  readonly ratingVersion: string;
  readonly source: PuzzleSource;
  readonly symmetry: Symmetry;
  readonly seed: string | null;
  readonly title: string;
  readonly tags: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 对局状态（SRS 8.1）。 */
export type SessionStatus = "playing" | "paused" | "completed" | "solved" | "abandoned";

/** 题目快照：保证原题删除后仍可恢复。 */
export interface PuzzleSnapshot {
  readonly givens: string;
  readonly solution: string;
  readonly difficulty: PuzzleDifficulty;
  readonly ratingVersion: string;
}

export interface GameSession {
  readonly id: string;
  readonly puzzleId: string;
  readonly puzzleSnapshot: PuzzleSnapshot;
  /** 当前棋盘，含给定数与用户填写，`0` 表示空。 */
  readonly currentGrid: string;
  /** 81 个位掩码（bit0–bit8 对应 1–9），比 `number[][]` 小 5–8 倍。 */
  readonly notes: readonly number[];
  readonly status: SessionStatus;
  readonly isPractice: boolean;
  readonly elapsedMs: number;
  readonly assisted: boolean;
  readonly machineSolved: boolean;
  readonly hintCount: number;
  readonly checkCount: number;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface Favorite {
  readonly id: string;
  readonly puzzleId: string;
  readonly puzzleSnapshot: PuzzleSnapshot;
  readonly title: string;
  readonly tags: readonly string[];
  readonly note: string;
  readonly createdAt: string;
  readonly lastOpenedAt: string | null;
  readonly bestTimeMs: number | null;
  readonly lastSessionId: string | null;
}

export type ThemePreference = "system" | "light" | "dark";

export interface Settings {
  readonly theme: ThemePreference;
  readonly locale: string;
  readonly autoRemoveNotes: boolean;
  readonly highlightSameNumber: boolean;
  readonly highlightPeers: boolean;
  readonly showConflicts: boolean;
  readonly showTimer: boolean;
  readonly hideBoardOnPause: boolean;
  readonly soundEnabled: boolean;
  readonly hapticsEnabled: boolean;
  readonly reducedMotion: boolean;
  readonly onboardingDone: boolean;
  readonly schemaVersion: number;
}

export interface Stats {
  readonly totalStarted: number;
  readonly totalCompleted: number;
  readonly totalAbandoned: number;
  readonly assistedCompleted: number;
  readonly machineSolved: number;
  readonly bestTimeByDifficulty: Partial<Record<Difficulty, number>>;
  /** 各难度的完成局数（口径同完成率，不含机器求解）。 */
  readonly completedByDifficulty: Partial<Record<Difficulty, number>>;
  /** 各难度累计用时（毫秒），与完成数一起算平均。 */
  readonly totalTimeByDifficulty: Partial<Record<Difficulty, number>>;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly lastCompletedDate: string | null;
  readonly updatedAt: string;
}

/** SRS 6.2.4 的默认设置。 */
export function createDefaultSettings(schemaVersion: number): Settings {
  return {
    theme: "system",
    locale: "zh-CN",
    autoRemoveNotes: true,
    highlightSameNumber: true,
    highlightPeers: true,
    showConflicts: true,
    showTimer: true,
    hideBoardOnPause: true,
    soundEnabled: false,
    hapticsEnabled: false,
    reducedMotion: false,
    onboardingDone: false,
    schemaVersion,
  };
}

/** SRS 6.2.5 的默认统计。 */
export function createDefaultStats(now: string): Stats {
  return {
    totalStarted: 0,
    totalCompleted: 0,
    totalAbandoned: 0,
    assistedCompleted: 0,
    machineSolved: 0,
    bestTimeByDifficulty: {},
    completedByDifficulty: {},
    totalTimeByDifficulty: {},
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedDate: null,
    updatedAt: now,
  };
}
