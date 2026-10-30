import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type { Favorite, GameSession, Puzzle, Settings } from "../domain/types";
import { filledCount } from "../engine/conflicts";
import { BoardGrid } from "../features/board/BoardGrid";
import { NumberPad } from "../features/board/NumberPad";
import { PauseOverlay } from "../features/game/PauseOverlay";
import { ResultPanel, type FavoriteState } from "../features/game/ResultPanel";
import { StatusBar } from "../features/game/StatusBar";
import { useGameStore } from "../stores/appStore";
import { SCHEMA_VERSION, favoriteRepo, puzzleRepo, sessionRepo, settingsRepo } from "../storage/runtime";

/** 用对局自带的题目快照重建 Puzzle：即使 puzzles 表缺失也能恢复。 */
function puzzleFromSession(session: GameSession): Puzzle {
  const snapshot = session.puzzleSnapshot;
  return {
    id: session.puzzleId,
    canonicalKey: snapshot.givens,
    givens: snapshot.givens,
    solution: snapshot.solution,
    difficulty: snapshot.difficulty,
    ratingVersion: snapshot.ratingVersion,
    source: snapshot.difficulty === "custom" ? "custom" : "generated",
    symmetry: "none",
    seed: null,
    title: "",
    tags: [],
    createdAt: session.startedAt,
    updatedAt: session.updatedAt,
  };
}

export function GamePage() {
  const navigate = useNavigate();
  const state = useGameStore();

  const puzzle = state.puzzle;
  const puzzleId = puzzle?.id ?? null;
  const finished = state.status === "completed" || state.status === "solved";
  const paused = state.status === "paused";

  const [favoriteState, setFavoriteState] = useState<FavoriteState>("idle");
  const [settings, setSettings] = useState<Settings | null>(null);
  // 首帧就要决定「是不是在恢复」：刷新后 store 是空的，若此时 restoring=false，
  // 下面的 `puzzle === null` 会立刻把用户送回首页，异步恢复根本来不及跑。
  const [restoring, setRestoring] = useState(() => useGameStore.getState().puzzle === null);

  // 刷新后恢复进行中的对局（SRS FR-PLY / AC-09）。
  // 从首页正常进入时 store 已有 puzzle，这里什么都不做。
  useEffect(() => {
    if (useGameStore.getState().puzzle !== null) return;

    setRestoring(true);
    void (async () => {
      try {
        const session = await sessionRepo.findLatestOngoing();
        if (session !== undefined) {
          // puzzles 表可能缺失（写入被中断），但 session 自带题目快照，足够恢复
          const stored = await puzzleRepo.get(session.puzzleId);
          useGameStore.getState().restore(session, stored ?? puzzleFromSession(session));
          return;
        }
      } catch {
        // 读库失败就回首页，不让用户卡在「载入中」
      } finally {
        setRestoring(false);
      }

      window.location.replace("/");
    })();
  }, []);

  // 设置项：只影响展示与输入行为，不影响规则
  useEffect(() => {
    void settingsRepo.get(SCHEMA_VERSION).then((loaded) => {
      setSettings(loaded);
      useGameStore.getState().setAutoRemoveNotes(loaded.autoRemoveNotes);
      document.documentElement.classList.toggle("reduce-motion", loaded.reducedMotion);
    });
  }, []);

  // 计时器：store 只在 playing 时累计
  useEffect(() => {
    const timer = window.setInterval(() => {
      useGameStore.getState().tick();
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  // 已经收藏过的题目，进入结果区时直接显示「已收藏」
  useEffect(() => {
    if (!finished || puzzleId === null) return;

    let cancelled = false;
    void favoriteRepo.byPuzzle(puzzleId).then((existing) => {
      if (!cancelled && existing !== undefined) setFavoriteState("saved");
    });

    return () => {
      cancelled = true;
    };
  }, [finished, puzzleId]);

  if (restoring) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center p-6">
        <p className="text-sm text-slate-600">载入中…</p>
      </main>
    );
  }

  if (puzzle === null) {
    return <Navigate to="/" replace />;
  }

  async function handleFavorite(): Promise<void> {
    if (puzzle === null) return;
    setFavoriteState("pending");

    const now = new Date().toISOString();
    const favorite: Favorite = {
      id: crypto.randomUUID(),
      puzzleId: puzzle.id,
      puzzleSnapshot: {
        givens: puzzle.givens,
        solution: puzzle.solution,
        difficulty: puzzle.difficulty,
        ratingVersion: puzzle.ratingVersion,
      },
      title: "",
      tags: [],
      note: "",
      createdAt: now,
      lastOpenedAt: null,
      bestTimeMs: null,
      lastSessionId: state.sessionId,
    };

    try {
      await favoriteRepo.add(favorite);
      setFavoriteState("saved");
    } catch {
      setFavoriteState("error");
    }
  }

  function handleReset(): void {
    if (puzzle === null) return;
    useGameStore.getState().startPuzzle(puzzle);
    setFavoriteState("idle");
  }

  function handleAgain(): void {
    if (puzzle === null) return;
    navigate(puzzle.difficulty === "custom" ? "/" : `/?start=${puzzle.difficulty}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-4">
      <StatusBar
        difficulty={puzzle.difficulty}
        elapsedMs={state.elapsed}
        remaining={81 - filledCount(state.board.grid)}
        showTimer={settings?.showTimer ?? true}
        status={state.status}
        onPause={() => useGameStore.getState().pause()}
        onResume={() => useGameStore.getState().resume()}
      />

      <div className="relative">
        <BoardGrid
          grid={state.board.grid}
          givens={puzzle.givens}
          notes={state.board.notes}
          selected={state.board.selected}
          notesMode={state.board.notesMode}
          wrongCells={state.checkResult?.wrong}
          showConflicts={settings?.showConflicts ?? true}
          highlightPeers={settings?.highlightPeers ?? true}
          highlightSameNumber={settings?.highlightSameNumber ?? true}
          onSelect={(index) => useGameStore.getState().select(index)}
          onPlace={(index, digit) => useGameStore.getState().place(index, digit)}
          onClear={(index) => useGameStore.getState().clear(index)}
          onToggleNote={(index, digit) => useGameStore.getState().toggleNote(index, digit)}
          onToggleNotesMode={() => useGameStore.getState().setNotesMode(!state.board.notesMode)}
        />
        {paused && (settings?.hideBoardOnPause ?? true) ? (
          <PauseOverlay onResume={() => useGameStore.getState().resume()} />
        ) : null}
      </div>

      {/* 结束后收起键盘与操作栏，把结果区提到首屏可见的位置 */}
      {finished ? null : (
        <>
          <NumberPad
            notesMode={state.board.notesMode}
            onDigit={(digit) => {
              const selected = useGameStore.getState().board.selected;
              if (selected === null) return;
              if (state.board.notesMode) useGameStore.getState().toggleNote(selected, digit);
              else useGameStore.getState().place(selected, digit);
            }}
            onClear={() => {
              const selected = useGameStore.getState().board.selected;
              if (selected !== null) useGameStore.getState().clear(selected);
            }}
            onToggleNotes={() => useGameStore.getState().setNotesMode(!state.board.notesMode)}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => useGameStore.getState().undo()}
              className="min-h-11 flex-1 rounded-lg bg-slate-100 px-3 font-medium"
            >
              撤销
            </button>
            <button
              type="button"
              onClick={() => useGameStore.getState().redo()}
              className="min-h-11 flex-1 rounded-lg bg-slate-100 px-3 font-medium"
            >
              重做
            </button>
            <button
              type="button"
              disabled={state.status === "ready"}
              onClick={() => useGameStore.getState().solveCurrent()}
              className="min-h-11 flex-1 rounded-lg bg-slate-100 px-3 font-medium disabled:opacity-50"
            >
              求解本题
            </button>
          </div>
        </>
      )}

      {finished ? (
        <ResultPanel
          status={state.status}
          difficulty={puzzle.difficulty}
          elapsedMs={state.elapsed}
          favoriteState={favoriteState}
          onAgain={handleAgain}
          onReset={handleReset}
          onFavorite={() => void handleFavorite()}
          onHome={() => navigate("/")}
        />
      ) : null}

      <p id="board-help" className="text-xs text-slate-500">
        方向键移动，1–9 填数，N 切换候选，退格清除。
      </p>
    </main>
  );
}
