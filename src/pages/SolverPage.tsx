/**
 * 独立求解器（SRS 4.6 / AC-06）。
 *
 * 与「当前题求解」不同：这里可以输入任意题目，明确区分唯一解 / 多解 / 无解 / 冲突。
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import type { ParseResult } from "../engine/types";
import { parse81 } from "../engine/parser";
import type { SolveOutcome } from "../engine/solver";
import { createEngineClient } from "../engine/worker/client";
import { SolutionGrid } from "../features/solver/SolutionGrid";

function parseErrorMessage(result: Extract<ParseResult, { ok: false }>): string {
  switch (result.code) {
    case "LENGTH":
      return "题目长度不对：需要 81 个数字（0 或 . 表示空格）。";
    case "CHARACTER":
      return `第 ${result.cells.map((i) => i + 1).join("、")} 位包含无法识别的字符。`;
    case "CONFLICT":
      return `第 ${result.cells.map((i) => i + 1).join("、")} 位存在行/列/宫冲突。`;
    case "TOO_FEW_CLUES":
      return "提示数太少，无法求解。";
    default:
      return "题目无法解析。";
  }
}

function outcomeText(outcome: SolveOutcome): string {
  switch (outcome.status) {
    case "unique":
      return `唯一解，用时 ${outcome.elapsedMs}ms。`;
    case "multiple":
      return "这题有多个解（至少 2 个），下面只展示其中一个。";
    case "none":
      return "这题无解。";
    case "timeout":
      return "求解超时，请重试。";
    default:
      return "题目不合法。";
  }
}

export function SolverPage() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SolveOutcome | null>(null);
  const [givens, setGivens] = useState<string | null>(null);

  async function handleSolve(): Promise<void> {
    setError(null);
    setOutcome(null);
    setGivens(null);

    const parsed = parse81(text, { minClues: 0 });
    if (!parsed.ok) {
      setError(parseErrorMessage(parsed));
      return;
    }

    setBusy(true);
    // 用完即弃：每个 Worker 都会加载一份 sudoku-core，不释放会累积到渲染进程崩溃
    const client = createEngineClient();
    try {
      const handle = client.solve(parsed.givens);
      const result = await handle.promise;
      setOutcome(result);
      setGivens(parsed.givens);
    } catch {
      setError("求解失败，请重试。");
    } finally {
      client.dispose();
      setBusy(false);
    }
  }

  function handleClear(): void {
    setText("");
    setError(null);
    setOutcome(null);
    setGivens(null);
  }

  const showGrid =
    outcome !== null &&
    givens !== null &&
    outcome.solution !== null &&
    (outcome.status === "unique" || outcome.status === "multiple");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">独立求解器</h1>
        <p className="text-sm text-slate-600">粘贴题目，判断唯一解、多解或无解。</p>
      </header>

      <label className="flex flex-col gap-1 text-sm text-slate-700">
        <span>题目</span>
        <textarea
          aria-label="题目输入"
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="粘贴 81 位题目，0、. 或 _ 表示空格"
          className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || text.trim() === ""}
          onClick={() => void handleSolve()}
          className="min-h-11 flex-1 rounded-lg bg-blue-600 px-4 font-medium text-white disabled:opacity-50"
        >
          {busy ? "求解中…" : "求解"}
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="min-h-11 rounded-lg bg-slate-100 px-4 font-medium text-slate-900"
        >
          清空
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {outcome ? (
        <section aria-live="polite" className="flex flex-col gap-3">
          <p className={outcome.status === "unique" ? "text-green-800" : "text-amber-800"}>
            {outcomeText(outcome)}
          </p>
          {showGrid && givens !== null && outcome.solution !== null ? (
            <SolutionGrid solution={outcome.solution} givens={givens} />
          ) : null}
        </section>
      ) : null}

      <Link to="/" className="mt-auto min-h-11 rounded-lg text-center leading-[2.75rem] text-blue-700">
        返回首页
      </Link>
    </main>
  );
}
