/**
 * 收藏列表（SRS 4.8 / AC-08、FR-FAV-006~008）。
 *
 * 列表支持按标题/标签搜索、按难度与完成状态筛选、四种排序；卡片可展开编辑标题、标签与备注。
 * 删除后 5 秒内可撤销：先把记录从列表移除，撤销时用原快照重新写入。
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DEFAULT_QUERY,
  NOTE_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  parseTags,
  queryFavorites,
  type FavoriteQuery,
  type FavoriteSort,
  type FavoriteStatusFilter,
} from "../domain/favorites";
import type { Favorite, Puzzle, PuzzleDifficulty } from "../domain/types";
import { useGameStore } from "../stores/appStore";
import { favoriteRepo } from "../storage/runtime";

const DIFFICULTY_LABEL: Readonly<Record<string, string>> = {
  beginner: "入门",
  easy: "简单",
  medium: "中等",
  hard: "困难",
  expert: "专家",
  custom: "自定义",
};

const DIFFICULTIES: readonly PuzzleDifficulty[] = ["beginner", "easy", "medium", "hard", "expert", "custom"];

const SORT_LABEL: Readonly<Record<FavoriteSort, string>> = {
  createdAt: "收藏时间",
  lastOpened: "最近游玩",
  difficulty: "难度",
  bestTime: "最佳用时",
};

const STATUS_LABEL: Readonly<Record<FavoriteStatusFilter, string>> = {
  all: "全部",
  completed: "已完成",
  unfinished: "未完成",
};

const UNDO_WINDOW_MS = 5_000;

function favoriteToPuzzle(favorite: Favorite): Puzzle {
  const now = new Date().toISOString();
  return {
    id: favorite.puzzleId,
    canonicalKey: favorite.puzzleSnapshot.givens,
    givens: favorite.puzzleSnapshot.givens,
    solution: favorite.puzzleSnapshot.solution,
    difficulty: favorite.puzzleSnapshot.difficulty,
    ratingVersion: favorite.puzzleSnapshot.ratingVersion,
    source: favorite.puzzleSnapshot.difficulty === "custom" ? "custom" : "generated",
    symmetry: "none",
    seed: null,
    title: favorite.title,
    tags: favorite.tags,
    createdAt: favorite.createdAt,
    updatedAt: now,
  };
}

function formatTime(ms: number | null): string {
  if (ms === null) return "未完成";
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function FavoritesPage() {
  const navigate = useNavigate();
  const startPuzzle = useGameStore((state) => state.startPuzzle);

  const [items, setItems] = useState<Favorite[] | null>(null);
  const [undoItem, setUndoItem] = useState<Favorite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<FavoriteQuery>(DEFAULT_QUERY);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [draftNote, setDraftNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    void favoriteRepo
      .list()
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setError("收藏读取失败。");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (undoItem === null) return;
    const timer = window.setTimeout(() => setUndoItem(null), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [undoItem]);

  const visible = useMemo(() => queryFavorites(items ?? [], query), [items, query]);

  async function handleRemove(favorite: Favorite): Promise<void> {
    try {
      await favoriteRepo.remove(favorite.id);
      setItems((prev) => (prev === null ? null : prev.filter((item) => item.id !== favorite.id)));
      setUndoItem(favorite);
      if (editingId === favorite.id) setEditingId(null);
    } catch {
      setError("删除失败，请重试。");
    }
  }

  async function handleUndo(): Promise<void> {
    if (undoItem === null) return;
    try {
      await favoriteRepo.add(undoItem);
      setItems(await favoriteRepo.list());
      setUndoItem(null);
    } catch {
      setError("撤销失败，请重试。");
    }
  }

  function handleOpen(favorite: Favorite): void {
    startPuzzle(favoriteToPuzzle(favorite));
    // 记录最近游玩，供「最近游玩」排序使用（FR-FAV-007）
    void favoriteRepo.markOpened(
      favorite.id,
      new Date().toISOString(),
      useGameStore.getState().sessionId,
    );
    navigate("/play");
  }

  function startEditing(favorite: Favorite): void {
    setEditingId(favorite.id);
    setDraftTitle(favorite.title);
    setDraftTags(favorite.tags.join("，"));
    setDraftNote(favorite.note);
  }

  async function saveEditing(id: string): Promise<void> {
    try {
      const updated = await favoriteRepo.updateMeta(id, {
        title: draftTitle,
        tags: parseTags(draftTags),
        note: draftNote,
      });

      if (updated !== undefined) {
        setItems((prev) => (prev === null ? null : prev.map((item) => (item.id === id ? updated : item))));
      }
      setEditingId(null);
    } catch {
      setError("保存失败，请重试。");
    }
  }

  const total = items?.length ?? 0;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">收藏</h1>
        <p className="text-sm text-slate-600">
          {items === null
            ? "读取中…"
            : visible.length === total
              ? `共 ${total} 题，只保存在本机。`
              : `显示 ${visible.length} / ${total} 题。`}
        </p>
      </header>

      {error !== null ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <section aria-label="搜索与筛选" className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          搜索标题或标签
          <input
            type="search"
            value={query.search}
            onChange={(event) => setQuery({ ...query, search: event.target.value })}
            placeholder="输入关键字"
            className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
          />
        </label>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="flex flex-col gap-1 text-slate-500">
            难度
            <select
              value={query.difficulty}
              onChange={(event) =>
                setQuery({ ...query, difficulty: event.target.value as PuzzleDifficulty | "all" })
              }
              className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
            >
              <option value="all">全部</option>
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {DIFFICULTY_LABEL[difficulty]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-slate-500">
            状态
            <select
              value={query.status}
              onChange={(event) =>
                setQuery({ ...query, status: event.target.value as FavoriteStatusFilter })
              }
              className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
            >
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-slate-500">
            排序
            <select
              value={query.sort}
              onChange={(event) => setQuery({ ...query, sort: event.target.value as FavoriteSort })}
              className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
            >
              {Object.entries(SORT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {items !== null && total === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          还没有收藏。完成一局后可以点「收藏本题」。
        </p>
      ) : null}

      {items !== null && total > 0 && visible.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
          没有符合条件的收藏，换个关键字或清空筛选试试。
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {visible.map((favorite) => (
          <li key={favorite.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => handleOpen(favorite)}
                className="flex flex-1 flex-col items-start gap-1 text-left"
              >
                <span className="font-medium text-slate-900">
                  {favorite.title.trim() === ""
                    ? (DIFFICULTY_LABEL[favorite.puzzleSnapshot.difficulty] ?? "自定义")
                    : favorite.title}
                </span>
                <span className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                  <span>{DIFFICULTY_LABEL[favorite.puzzleSnapshot.difficulty] ?? "自定义"}</span>
                  <span aria-hidden>·</span>
                  <span>最佳 {formatTime(favorite.bestTimeMs)}</span>
                  <span aria-hidden>·</span>
                  <span>{favorite.createdAt.slice(0, 10)}</span>
                </span>
                {favorite.tags.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {favorite.tags.map((tag) => (
                      <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {tag}
                      </span>
                    ))}
                  </span>
                ) : null}
              </button>

              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => (editingId === favorite.id ? setEditingId(null) : startEditing(favorite))}
                  aria-label={`编辑收藏：${favorite.title.trim() === "" ? "未命名" : favorite.title}`}
                  className="min-h-11 rounded-lg bg-slate-100 px-3 text-sm"
                >
                  {editingId === favorite.id ? "收起" : "编辑"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemove(favorite)}
                  aria-label={`删除收藏：${favorite.title.trim() === "" ? "未命名" : favorite.title}`}
                  className="min-h-11 rounded-lg bg-slate-100 px-3 text-sm"
                >
                  删除
                </button>
              </div>
            </div>

            {editingId === favorite.id ? (
              <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  标题
                  <input
                    type="text"
                    value={draftTitle}
                    maxLength={TITLE_MAX_LENGTH}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  标签（用逗号或空格分隔，最多 8 个）
                  <input
                    type="text"
                    value={draftTags}
                    onChange={(event) => setDraftTags(event.target.value)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm text-slate-900"
                  />
                </label>

                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  备注（{draftNote.length} / {NOTE_MAX_LENGTH}）
                  <textarea
                    value={draftNote}
                    maxLength={NOTE_MAX_LENGTH}
                    rows={3}
                    onChange={(event) => setDraftNote(event.target.value)}
                    className="rounded-lg border border-slate-300 p-2 text-sm text-slate-900"
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void saveEditing(favorite.id)}
                    className="min-h-11 flex-1 rounded-lg bg-blue-600 px-3 text-white"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="min-h-11 flex-1 rounded-lg bg-white px-3 text-slate-700 ring-1 ring-slate-300"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {undoItem !== null ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white"
        >
          <span>已取消收藏</span>
          <button
            type="button"
            onClick={() => void handleUndo()}
            className="min-h-11 rounded-lg bg-white px-3 font-medium text-slate-900"
          >
            撤销
          </button>
        </div>
      ) : null}

      <Link to="/" className="mt-auto min-h-11 text-center leading-[2.75rem] text-blue-700">
        返回首页
      </Link>
    </main>
  );
}
