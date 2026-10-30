/**
 * 统计页（SRS 4.10 / FR-STA-001~004）。
 *
 * 数据来自 `statsRepo`（单例聚合），不接受页面自己从 sessions 现算——
 * 口径必须与 `domain/stats.ts` 保持一致。
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Difficulty } from "../engine/types";
import type { Stats } from "../domain/types";
import { statsRepo } from "../storage/runtime";

const DIFFICULTIES: readonly Difficulty[] = ["beginner", "easy", "medium", "hard", "expert"];

const LABELS: Readonly<Record<Difficulty, string>> = {
  beginner: "入门",
  easy: "简单",
  medium: "中等",
  hard: "困难",
  expert: "专家",
};

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function StatCard(props: { readonly label: string; readonly value: string; readonly hint?: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-slate-200 bg-white px-3 py-2">
      <span className="text-xs text-slate-500">{props.label}</span>
      <span className="text-xl font-semibold text-slate-900">{props.value}</span>
      {props.hint === undefined ? null : <span className="text-xs text-slate-500">{props.hint}</span>}
    </div>
  );
}

export function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void statsRepo.get(new Date().toISOString()).then(setStats);
  }, []);

  async function handleReset(): Promise<void> {
    const confirmed = window.confirm("会清零所有统计数字，收藏和对局进度不受影响。确定吗？");
    if (!confirmed) return;

    try {
      setStats(await statsRepo.reset(new Date().toISOString()));
    } catch {
      setError("重置失败，请重试。");
    }
  }

  const completionRate =
    stats === null || stats.totalStarted === 0
      ? "—"
      : `${Math.round((stats.totalCompleted / stats.totalStarted) * 100)}%`;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">统计</h1>
        <p className="text-sm text-slate-600">只统计标准对局，机器求解单独计数。</p>
      </header>

      {error !== null ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {stats === null ? (
        <p className="text-sm text-slate-600">读取中…</p>
      ) : (
        <>
          <section aria-label="总览" className="grid grid-cols-2 gap-2">
            <StatCard label="开始" value={String(stats.totalStarted)} />
            <StatCard label="完成" value={String(stats.totalCompleted)} hint={`完成率 ${completionRate}`} />
            <StatCard label="放弃" value={String(stats.totalAbandoned)} />
            <StatCard label="机器求解" value={String(stats.machineSolved)} hint="不计入完成率" />
          </section>

          <section aria-label="连续完成" className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-medium text-slate-900">连续完成</h2>
            <div className="mt-2 flex gap-6 text-sm text-slate-600">
              <span>
                当前 <strong className="text-lg text-slate-900">{stats.currentStreak}</strong> 天
              </span>
              <span>
                最长 <strong className="text-lg text-slate-900">{stats.longestStreak}</strong> 天
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              最近完成：{stats.lastCompletedDate ?? "还没有完成过"}
            </p>
          </section>

          <section aria-label="按难度" className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-medium text-slate-900">按难度</h2>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th scope="col" className="py-1 font-normal">
                    难度
                  </th>
                  <th scope="col" className="py-1 font-normal">
                    完成
                  </th>
                  <th scope="col" className="py-1 font-normal">
                    最佳
                  </th>
                  <th scope="col" className="py-1 font-normal">
                    平均
                  </th>
                </tr>
              </thead>
              <tbody>
                {DIFFICULTIES.map((difficulty) => {
                  const completed = stats.completedByDifficulty[difficulty] ?? 0;
                  const best = stats.bestTimeByDifficulty[difficulty];
                  const total = stats.totalTimeByDifficulty[difficulty] ?? 0;

                  return (
                    <tr key={difficulty} className="border-t border-slate-100 text-slate-900">
                      <th scope="row" className="py-1 text-left font-normal">
                        {LABELS[difficulty]}
                      </th>
                      <td className="py-1">{completed}</td>
                      <td className="py-1">{best === undefined ? "—" : formatDuration(best)}</td>
                      <td className="py-1">{completed === 0 ? "—" : formatDuration(total / completed)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              「最佳」只统计无辅助、非机器求解的完成；「平均」包含使用提示的完成。
            </p>
          </section>

          <button
            type="button"
            onClick={() => void handleReset()}
            className="min-h-11 rounded-lg bg-slate-100 px-4 font-medium text-slate-900"
          >
            重置统计
          </button>
        </>
      )}

      <footer className="mt-auto flex gap-4 text-xs text-slate-500">
        <Link to="/" className="text-blue-700 underline">
          返回首页
        </Link>
        <Link to="/settings" className="text-blue-700 underline">
          设置
        </Link>
      </footer>
    </main>
  );
}
