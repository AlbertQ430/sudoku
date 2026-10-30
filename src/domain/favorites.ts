/**
 * 收藏的查询逻辑（SRS FR-FAV-006~008）。
 *
 * 筛选与排序放在这里而不是页面里，是为了有一处可测的口径：
 * - 搜索匹配标题与标签，不区分大小写；
 * - 排序时「没有值」的记录一律排在最后，避免空值把有用的顶到后面。
 */

import type { Favorite, PuzzleDifficulty } from "./types";

const DIFFICULTY_ORDER: readonly PuzzleDifficulty[] = [
  "beginner",
  "easy",
  "medium",
  "hard",
  "expert",
  "custom",
];

export type FavoriteStatusFilter = "all" | "completed" | "unfinished";
export type FavoriteSort = "createdAt" | "lastOpened" | "difficulty" | "bestTime";

export interface FavoriteQuery {
  readonly search: string;
  readonly difficulty: PuzzleDifficulty | "all";
  readonly status: FavoriteStatusFilter;
  readonly sort: FavoriteSort;
}

export const DEFAULT_QUERY: FavoriteQuery = {
  search: "",
  difficulty: "all",
  status: "all",
  sort: "createdAt",
};

/** 是否完成过（完成过才有最佳用时）。 */
export function isCompleted(favorite: Favorite): boolean {
  return favorite.bestTimeMs !== null;
}

/** 标题或任一标签命中关键字；空关键字视为全部命中。 */
export function matchesSearch(favorite: Favorite, keyword: string): boolean {
  const needle = keyword.trim().toLowerCase();
  if (needle === "") return true;

  if (favorite.title.toLowerCase().includes(needle)) return true;
  return favorite.tags.some((tag) => tag.toLowerCase().includes(needle));
}

function compareNullableNumber(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

function compareNullableDate(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  // 越新越靠前
  return b.localeCompare(a);
}

function difficultyRank(favorite: Favorite): number {
  const index = DIFFICULTY_ORDER.indexOf(favorite.puzzleSnapshot.difficulty);
  return index < 0 ? DIFFICULTY_ORDER.length : index;
}

/** 应用搜索、筛选与排序，返回新数组，不修改入参。 */
export function queryFavorites(list: readonly Favorite[], query: FavoriteQuery): Favorite[] {
  const filtered = list.filter((favorite) => {
    if (!matchesSearch(favorite, query.search)) return false;
    if (query.difficulty !== "all" && favorite.puzzleSnapshot.difficulty !== query.difficulty) return false;
    if (query.status === "completed" && !isCompleted(favorite)) return false;
    if (query.status === "unfinished" && isCompleted(favorite)) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    switch (query.sort) {
      case "lastOpened":
        return compareNullableDate(a.lastOpenedAt, b.lastOpenedAt);
      case "difficulty":
        return difficultyRank(a) - difficultyRank(b);
      case "bestTime":
        return compareNullableNumber(a.bestTimeMs, b.bestTimeMs);
      case "createdAt":
      default:
        return b.createdAt.localeCompare(a.createdAt);
    }
  });
}

/** 从已有收藏里收集去重后的标签，用于筛选条。 */
export function collectTags(list: readonly Favorite[]): string[] {
  const tags = new Set<string>();
  for (const favorite of list) {
    for (const tag of favorite.tags) {
      const trimmed = tag.trim();
      if (trimmed !== "") tags.add(trimmed);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export const NOTE_MAX_LENGTH = 500;
export const TITLE_MAX_LENGTH = 60;
export const TAG_MAX_LENGTH = 20;
export const MAX_TAGS = 8;

/** 把用户输入的一行标签解析成数组：按逗号/空格切分、去空、去重、限长。 */
export function parseTags(input: string): string[] {
  const parts = input
    .split(/[,，\s]+/)
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => part.slice(0, TAG_MAX_LENGTH));

  return [...new Set(parts)].slice(0, MAX_TAGS);
}
