/**
 * 自定义题目（SRS 4.7 / 8.3 / AC-07）。
 *
 * 校验顺序固定：格式 → 冲突 → 提示数下限 → 可解性 → 解数。
 * 多解题在 MVP 阻止开始（D7），P1 再做练习模式。
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createBoardState, placeDigit, clearCell, type BoardState } from "../domain/boardState";
import { MAX_IMPORT_BYTES, extractPuzzle, isImportableSize } from "../domain/puzzle-file";
import type { Puzzle } from "../domain/types";
import { parse81 } from "../engine/parser";
import type { ParseResult } from "../engine/types";
import { BoardGrid } from "../features/board/BoardGrid";
import { createEngineClient } from "../engine/worker/client";
import { useGameStore } from "../stores/appStore";
import { puzzleRepo } from "../storage/runtime";

const EMPTY = "0".repeat(81);

interface CheckStep {
  readonly label: string;
  readonly ok: boolean;
  readonly detail?: string;
}

function stepList(): CheckStep[] {
  return [
    { label: "格式：81 位，只含 0–9", ok: false },
    { label: "冲突：给定数之间无行列宫重复", ok: false },
    { label: "提示数：不少于 17 个", ok: false },
    { label: "可解性：至少存在一个解", ok: false },
    { label: "唯一解：恰好一个解", ok: false },
  ];
}

function markSteps(steps: CheckStep[], passed: number, detail?: string): CheckStep[] {
  return steps.map((step, index) => {
    if (index < passed) return { ...step, ok: true };
    if (index === passed) return { ...step, ok: false, detail };
    return step;
  });
}

export function CustomPage() {
  const navigate = useNavigate();
  const startPuzzle = useGameStore((state) => state.startPuzzle);

  const [mode, setMode] = useState<"paste" | "grid">("paste");
  const [text, setText] = useState("");
  const [board, setBoard] = useState<BoardState>(() => createBoardState(EMPTY));
  const [steps, setSteps] = useState<CheckStep[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playable, setPlayable] = useState<{ givens: string; solution: string } | null>(null);

  const currentGivens = mode === "paste" ? text : board.grid;
  const filledCount = useMemo(
    () => [...currentGivens].filter((ch) => ch >= "1" && ch <= "9").length,
    [currentGivens],
  );

  function resetValidation(): void {
    setSteps(null);
    setError(null);
    setPlayable(null);
  }

  /** 从 .txt / .json 读取题目，只提取 81 位字符串，校验仍走五步流程。 */
  async function handleFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;

    resetValidation();

    if (!isImportableSize(file.size)) {
      setError(`文件超过 ${MAX_IMPORT_BYTES / 1024 / 1024} MB，请换一个更小的文件。`);
      return;
    }

    try {
      const result = extractPuzzle(await file.text(), file.name);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMode("paste");
      setText(result.givens);
    } catch {
      setError("读取文件失败，请重试。");
    }
  }

  async function handleValidate(): Promise<void> {
    resetValidation();

    const parsed: ParseResult = parse81(currentGivens, { minClues: 17 });
    const steps = stepList();

    if (!parsed.ok) {
      if (parsed.code === "LENGTH") {
        setSteps(markSteps(steps, 0, "需要正好 81 个字符，可用 0、. 或 _ 表示空格"));
      } else if (parsed.code === "CHARACTER") {
        setSteps(markSteps(steps, 0, `第 ${parsed.cells.map((i) => i + 1).join("、")} 位不是数字`));
      } else if (parsed.code === "CONFLICT") {
        setSteps(markSteps(steps, 1, `第 ${parsed.cells.map((i) => i + 1).join("、")} 位存在冲突`));
      } else {
        setSteps(markSteps(steps, 2, `当前只有 ${filledCount} 个提示数`));
      }
      return;
    }

    setBusy(true);
    // 用完即弃：每个 Worker 都会加载一份 sudoku-core，不释放会累积到渲染进程崩溃
    const client = createEngineClient();
    try {
      const handle = client.solve(parsed.givens);
      const outcome = await handle.promise;

      if (outcome.status === "unique" && outcome.solution !== null) {
        setSteps(steps.map((step) => ({ ...step, ok: true })));
        setPlayable({ givens: parsed.givens, solution: outcome.solution });
        return;
      }

      if (outcome.status === "multiple") {
        setSteps(markSteps(steps, 4, "这道题有多个解，MVP 不支持按标准题开始"));
        return;
      }

      if (outcome.status === "none") {
        setSteps(markSteps(steps, 3, "给定数之间合法，但推导不出任何解"));
        return;
      }

      setSteps(markSteps(steps, 3, "求解超时，请缩小题目范围或重试"));
    } catch {
      setError("校验失败，请重试。");
    } finally {
      client.dispose();
      setBusy(false);
    }
  }

  async function handlePlay(): Promise<void> {
    if (playable === null) return;

    const now = new Date().toISOString();
    const puzzle: Puzzle = {
      id: crypto.randomUUID(),
      canonicalKey: playable.givens,
      givens: playable.givens,
      solution: playable.solution,
      difficulty: "custom",
      ratingVersion: "n/a",
      source: "custom",
      symmetry: "none",
      seed: null,
      title: "",
      tags: [],
      createdAt: now,
      updatedAt: now,
    };

    await puzzleRepo.save(puzzle);
    startPuzzle(puzzle);
    navigate("/play");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">自定义题目</h1>
        <p className="text-sm text-slate-600">粘贴或逐格录入，校验通过后开始。</p>
      </header>

      <div role="tablist" aria-label="录入方式" className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "paste"}
          onClick={() => {
            setMode("paste");
            resetValidation();
          }}
          className={`min-h-11 flex-1 rounded-lg px-3 font-medium ${
            mode === "paste" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900"
          }`}
        >
          粘贴题目
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "grid"}
          onClick={() => {
            setMode("grid");
            resetValidation();
          }}
          className={`min-h-11 flex-1 rounded-lg px-3 font-medium ${
            mode === "grid" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900"
          }`}
        >
          逐格录入
        </button>
      </div>

      {mode === "paste" ? (
        <div className="flex flex-col gap-2">
          <textarea
            aria-label="题目输入"
            rows={4}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              resetValidation();
            }}
            placeholder="粘贴 81 位题目，0、. 或 _ 表示空格"
            className="w-full rounded-lg border border-slate-300 p-3 font-mono text-sm"
          />

          <label className="min-h-11 cursor-pointer rounded-lg bg-slate-100 px-3 text-center text-sm leading-[2.75rem] text-slate-900">
            从文件导入（.txt / .json）
            <input
              type="file"
              accept=".txt,.json,text/plain,application/json"
              onChange={(event) => void handleFile(event)}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <BoardGrid
            grid={board.grid}
            givens={EMPTY}
            notes={board.notes}
            selected={board.selected}
            notesMode={false}
            onSelect={(index) => setBoard((prev) => ({ ...prev, selected: index }))}
            onPlace={(index, digit) => {
              setBoard((prev) => placeDigit(prev, EMPTY, index, digit, { autoRemoveNotes: false }));
              resetValidation();
            }}
            onClear={(index) => {
              setBoard((prev) => clearCell(prev, EMPTY, index));
              resetValidation();
            }}
            onToggleNote={() => undefined}
            onToggleNotesMode={() => undefined}
          />
          <button
            type="button"
            onClick={() => {
              setBoard(createBoardState(EMPTY));
              resetValidation();
            }}
            className="min-h-11 rounded-lg bg-slate-100 px-4 font-medium"
          >
            清空棋盘
          </button>
        </div>
      )}

      <p className="text-sm text-slate-600">当前提示数：{filledCount}（至少 17 个）</p>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleValidate()}
          className="min-h-11 flex-1 rounded-lg bg-blue-600 px-4 font-medium text-white disabled:opacity-50"
        >
          {busy ? "校验中…" : "校验题目"}
        </button>
        <button
          type="button"
          disabled={playable === null}
          onClick={() => void handlePlay()}
          className="min-h-11 flex-1 rounded-lg bg-green-600 px-4 font-medium text-white disabled:opacity-50"
        >
          开始游戏
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {steps ? (
        <ol aria-live="polite" className="flex flex-col gap-2 text-sm">
          {steps.map((step) => (
            <li key={step.label} className="flex items-start gap-2">
              <span aria-hidden="true" className={step.ok ? "text-green-700" : "text-red-700"}>
                {step.ok ? "✓" : "✗"}
              </span>
              <span>
                <span className={step.ok ? "text-slate-700" : "text-slate-900"}>{step.label}</span>
                <span className="sr-only">{step.ok ? "，通过" : "，未通过"}</span>
                {step.detail ? <span className="block text-red-700">{step.detail}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <Link to="/" className="min-h-11 text-center leading-[2.75rem] text-blue-700">
        返回首页
      </Link>
    </main>
  );
}
