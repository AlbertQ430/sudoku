/**
 * 计时器（SRS 4.4）。
 *
 * 用 `performance.now()` 累计，且时间源可注入，便于测试。
 * 只在 `playing` 状态走表；暂停与页面隐藏都调用 `pauseTimer`。
 */

export interface TimerState {
  /** 已累计的毫秒数（不含当前运行区间）。 */
  readonly accumulatedMs: number;
  /** 当前区间的起点；null 表示已暂停。 */
  readonly startedAt: number | null;
}

export function createTimer(): TimerState {
  return { accumulatedMs: 0, startedAt: null };
}

export function startTimer(timer: TimerState, now: number): TimerState {
  if (timer.startedAt !== null) return timer;
  return { ...timer, startedAt: now };
}

export function pauseTimer(timer: TimerState, now: number): TimerState {
  if (timer.startedAt === null) return timer;
  return {
    accumulatedMs: timer.accumulatedMs + Math.max(0, now - timer.startedAt),
    startedAt: null,
  };
}

export function elapsedMs(timer: TimerState, now: number): number {
  const running = timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt);
  return timer.accumulatedMs + running;
}

export function resetTimer(timer: TimerState, now: number): TimerState {
  return { accumulatedMs: 0, startedAt: timer.startedAt === null ? null : now };
}

/** 毫秒 → `mm:ss` / `h:mm:ss`。 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
