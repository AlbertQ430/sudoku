import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Difficulty } from "../engine/types";
import { puzzleFromGenerated } from "../domain/puzzleFactory";
import { useGenerate } from "../features/generation/useGenerate";
import { markStarted, useGameStore } from "../stores/appStore";
import { puzzleRepo, sessionRepo } from "../storage/runtime";

const OPTIONS: ReadonlyArray<{ value: Difficulty; label: string; hint: string }> = [
  { value: "beginner", label: "入门", hint: "唯一余数、基础排除" },
  { value: "easy", label: "简单", hint: "区块排除、显性/隐性数对" },
  { value: "medium", label: "中等", hint: "三数集、X-Wing、XY-Wing" },
  { value: "hard", label: "困难", hint: "唯一矩形、剑鱼、简单链" },
  { value: "expert", label: "专家", hint: "高级链、强制链，可能需试错" },
];

export function HomePage() {
  const navigate = useNavigate();
  const startPuzzle = useGameStore((state) => state.startPuzzle);
  const { busy, error, generate } = useGenerate();
  const [starting, setStarting] = useState<Difficulty | null>(null);
  const [hasOngoing, setHasOngoing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const autoStartedRef = useRef(false);

  // 有没有可以继续的对局（SRS 首页：继续对局入口）
  useEffect(() => {
    let cancelled = false;
    void sessionRepo.findLatestOngoing().then((session) => {
      if (!cancelled) setHasOngoing(session !== undefined);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStart = useCallback(
    async (difficulty: Difficulty): Promise<void> => {
      setStarting(difficulty);
      const generated = await generate(difficulty);
      setStarting(null);
      if (generated === null) return;

      const puzzle = puzzleFromGenerated(generated, crypto.randomUUID(), new Date().toISOString());
      await puzzleRepo.save(puzzle);
      await markStarted();

      startPuzzle(puzzle);
      navigate("/play");
    },
    [generate, navigate, startPuzzle],
  );

  // 「再来一局」通过 /?start=<难度> 回到首页自动开局
  useEffect(() => {
    if (autoStartedRef.current) return;

    const option = OPTIONS.find((item) => item.value === searchParams.get("start"));
    if (option === undefined) return;

    autoStartedRef.current = true;
    setSearchParams({}, { replace: true });
    void handleStart(option.value);
  }, [searchParams, setSearchParams, handleStart]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900">数独</h1>
        <p className="text-slate-600">选择难度开始。打开即玩，无需注册，进度保存在本机。</p>
      </header>

      {hasOngoing && !busy ? (
        <button
          type="button"
          onClick={() => navigate("/play")}
          className="min-h-14 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-left"
        >
          <span className="text-lg font-medium text-blue-900">继续上一局</span>
          <span className="block text-sm text-blue-700">进度已自动保存</span>
        </button>
      ) : null}

      <div role="group" aria-label="选择难度" className="grid gap-3">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={busy}
            onClick={() => void handleStart(option.value)}
            className="flex min-h-14 flex-col items-start rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50"
          >
            <span className="text-lg font-medium text-slate-900">{option.label}</span>
            <span className="text-sm text-slate-500">{option.hint}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Link
          to="/custom"
          className="min-h-11 rounded-lg bg-slate-100 text-center font-medium leading-[2.75rem] text-slate-900"
        >
          自定义题目
        </Link>
        <Link
          to="/solver"
          className="min-h-11 rounded-lg bg-slate-100 text-center font-medium leading-[2.75rem] text-slate-900"
        >
          独立求解器
        </Link>
        <Link
          to="/favorites"
          className="min-h-11 rounded-lg bg-slate-100 text-center font-medium leading-[2.75rem] text-slate-900"
        >
          收藏
        </Link>
        <Link
          to="/settings"
          className="min-h-11 rounded-lg bg-slate-100 text-center font-medium leading-[2.75rem] text-slate-900"
        >
          设置
        </Link>
        <Link
          to="/stats"
          className="col-span-2 min-h-11 rounded-lg bg-slate-100 text-center font-medium leading-[2.75rem] text-slate-900"
        >
          统计
        </Link>
      </div>

      {busy ? (
        <div role="status" aria-live="polite" className="rounded-lg bg-blue-50 px-4 py-3 text-blue-900">
          正在准备{starting ? `「${OPTIONS.find((o) => o.value === starting)?.label}」` : ""}题目…
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      ) : null}

      <footer className="mt-auto text-xs text-slate-500">
        <p>数据只保存在这台设备上，不会上传。</p>
      </footer>
    </main>
  );
}
