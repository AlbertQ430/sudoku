/**
 * 统计口径（SRS 3.9）。
 *
 * 这里是「哪些对局计入完成率 / 最佳时间」的唯一实现，UI 不得各算各的。
 * 一句话规则：
 * - completed 且非练习 → 计完成率；
 * - completed 且非练习且未用检查/提示 → 计最佳时间；
 * - solved（机器求解）→ 只计 machineSolved，其它一律不计。
 */

import type { GameSession, Stats } from "./types";

export interface StatsContext {
  /** ISO 8601 时间戳。 */
  readonly now: string;
  /** 本地日期 `YYYY-MM-DD`，用于连续天数。 */
  readonly today: string;
}

function localDateMs(day: string): number {
  // 无 Z 后缀 → 按本地时区解析，避免跨时区把「昨天」算错
  return new Date(`${day}T00:00:00`).getTime();
}

function daysBetween(later: string, earlier: string): number {
  return Math.round((localDateMs(later) - localDateMs(earlier)) / 86_400_000);
}

/** 是否计入完成率。 */
export function countsTowardCompletion(session: GameSession): boolean {
  return session.status === "completed" && !session.machineSolved && !session.isPractice;
}

/** 是否计入「无辅助最佳时间」。 */
export function countsTowardBestTime(session: GameSession): boolean {
  return countsTowardCompletion(session) && !session.assisted;
}

export function recordStart(prev: Stats, context: Pick<StatsContext, "now">): Stats {
  return { ...prev, totalStarted: prev.totalStarted + 1, updatedAt: context.now };
}

/** 对局结束时的聚合。练习模式与进行中的对局不改变统计。 */
export function recordOutcome(prev: Stats, session: GameSession, context: StatsContext): Stats {
  if (session.status === "solved" || session.machineSolved) {
    return { ...prev, machineSolved: prev.machineSolved + 1, updatedAt: context.now };
  }

  if (session.status === "abandoned") {
    return { ...prev, totalAbandoned: prev.totalAbandoned + 1, updatedAt: context.now };
  }

  if (session.status !== "completed") return prev;

  let next: Stats = { ...prev, updatedAt: context.now };

  if (countsTowardCompletion(session)) {
    next = { ...next, totalCompleted: next.totalCompleted + 1 };
    if (session.assisted) {
      next = { ...next, assistedCompleted: next.assistedCompleted + 1 };
    }

    const difficulty = session.puzzleSnapshot.difficulty;
    if (difficulty !== "custom") {
      next = {
        ...next,
        completedByDifficulty: {
          ...next.completedByDifficulty,
          [difficulty]: (next.completedByDifficulty[difficulty] ?? 0) + 1,
        },
        totalTimeByDifficulty: {
          ...next.totalTimeByDifficulty,
          [difficulty]: (next.totalTimeByDifficulty[difficulty] ?? 0) + session.elapsedMs,
        },
      };
    }
  }

  if (countsTowardBestTime(session)) {
    const difficulty = session.puzzleSnapshot.difficulty;
    if (difficulty !== "custom") {
      const best = next.bestTimeByDifficulty[difficulty];
      if (best === undefined || session.elapsedMs < best) {
        next = {
          ...next,
          bestTimeByDifficulty: { ...next.bestTimeByDifficulty, [difficulty]: session.elapsedMs },
        };
      }
    }
  }

  if (!session.isPractice) {
    next = applyStreak(next, context.today);
  }

  return next;
}

/** 连续天数：同日完成不重复计；断档一天以上重新从 1 开始。 */
export function applyStreak(stats: Stats, today: string): Stats {
  if (stats.lastCompletedDate === today) return stats;

  const gap = stats.lastCompletedDate === null ? null : daysBetween(today, stats.lastCompletedDate);
  const currentStreak = gap === 1 ? stats.currentStreak + 1 : 1;

  return {
    ...stats,
    currentStreak,
    longestStreak: Math.max(stats.longestStreak, currentStreak),
    lastCompletedDate: today,
  };
}
