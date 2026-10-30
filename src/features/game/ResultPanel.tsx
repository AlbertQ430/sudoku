/**
 * 对局结束后的结果区。
 *
 * 刻意做成页面流里的卡片而不是模态对话框：
 * - 求解后用户要看完整答案，模态会挡住棋盘；
 * - 不锁焦点、不锁滚动，移动端也能往下滚；
 * - `role="status"` 让屏幕阅读器读一遍结果，不需要焦点陷阱。
 */

import { formatDuration } from "../../domain/timer";
import type { MachineStatus } from "../../domain/sessionMachine";
import type { PuzzleDifficulty } from "../../domain/types";

const DIFFICULTY_LABEL: Readonly<Record<PuzzleDifficulty, string>> = {
  beginner: "入门",
  easy: "简单",
  medium: "中等",
  hard: "困难",
  expert: "专家",
  custom: "自定义",
};

export type FavoriteState = "idle" | "pending" | "saved" | "error";

export interface ResultPanelProps {
  readonly status: MachineStatus;
  readonly difficulty: PuzzleDifficulty;
  readonly elapsedMs: number;
  readonly favoriteState: FavoriteState;
  readonly onAgain: () => void;
  readonly onReset: () => void;
  readonly onFavorite: () => void;
  readonly onHome: () => void;
}

const FAVORITE_LABEL: Readonly<Record<FavoriteState, string>> = {
  idle: "收藏本题",
  pending: "收藏中…",
  saved: "已收藏",
  error: "收藏失败，重试",
};

export function ResultPanel(props: ResultPanelProps) {
  const solved = props.status === "solved";

  return (
    <section
      aria-labelledby="result-title"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 id="result-title" className="text-lg font-bold text-slate-900">
        {solved ? "已显示答案" : "完成"}
      </h2>

      <p role="status" className="mt-1 text-sm text-slate-600">
        {solved ? "机器求解不计入完成率与最佳时间。" : `用时 ${formatDuration(props.elapsedMs)}。`}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-700">
        <dt>难度</dt>
        <dd>{DIFFICULTY_LABEL[props.difficulty]}</dd>
        <dt>用时</dt>
        <dd className="font-mono tabular-nums">{formatDuration(props.elapsedMs)}</dd>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={props.onAgain}
          className="min-h-11 flex-1 rounded-lg bg-blue-600 px-4 font-medium text-white"
        >
          再来一局
        </button>
        <button
          type="button"
          onClick={props.onReset}
          className="min-h-11 flex-1 rounded-lg bg-slate-100 px-4 font-medium text-slate-900"
        >
          重置本题
        </button>
        <button
          type="button"
          onClick={props.onFavorite}
          disabled={props.favoriteState === "pending" || props.favoriteState === "saved"}
          className="min-h-11 flex-1 rounded-lg bg-slate-100 px-4 font-medium text-slate-900 disabled:opacity-60"
        >
          {FAVORITE_LABEL[props.favoriteState]}
        </button>
        <button
          type="button"
          onClick={props.onHome}
          className="min-h-11 flex-1 rounded-lg bg-slate-100 px-4 font-medium text-slate-900"
        >
          返回首页
        </button>
      </div>
    </section>
  );
}
