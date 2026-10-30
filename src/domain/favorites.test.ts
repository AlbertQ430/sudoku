import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUERY,
  MAX_TAGS,
  collectTags,
  isCompleted,
  matchesSearch,
  parseTags,
  queryFavorites,
} from "./favorites";
import type { Favorite, PuzzleDifficulty } from "./types";

const GIVENS = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function makeFavorite(overrides: Partial<Favorite> & { difficulty?: PuzzleDifficulty } = {}): Favorite {
  const { difficulty = "easy", ...rest } = overrides;
  return {
    id: `f-${Math.random().toString(36).slice(2, 8)}`,
    puzzleId: `p-${Math.random().toString(36).slice(2, 8)}`,
    puzzleSnapshot: { givens: GIVENS, solution: SOLUTION, difficulty, ratingVersion: "1.0.0" },
    title: "",
    note: "",
    tags: [],
    createdAt: "2026-10-30T10:00:00.000Z",
    lastOpenedAt: null,
    bestTimeMs: null,
    lastSessionId: null,
    ...rest,
  };
}

describe("收藏搜索", () => {
  it("匹配标题，不区分大小写", () => {
    const favorite = makeFavorite({ title: "Classic Puzzle" });
    expect(matchesSearch(favorite, "classic")).toBe(true);
    expect(matchesSearch(favorite, "PUZZLE")).toBe(true);
    expect(matchesSearch(favorite, "nope")).toBe(false);
  });

  it("匹配任一标签", () => {
    const favorite = makeFavorite({ tags: ["通勤", "难题"] });
    expect(matchesSearch(favorite, "通勤")).toBe(true);
    expect(matchesSearch(favorite, "难")).toBe(true);
  });

  it("空关键字命中全部", () => {
    expect(matchesSearch(makeFavorite(), "  ")).toBe(true);
  });
});

describe("收藏筛选与排序", () => {
  const older = makeFavorite({
    title: "旧题",
    difficulty: "beginner",
    createdAt: "2026-10-01T00:00:00.000Z",
    bestTimeMs: 300_000,
  });
  const newer = makeFavorite({
    title: "新题",
    difficulty: "expert",
    createdAt: "2026-10-20T00:00:00.000Z",
    lastOpenedAt: "2026-10-29T00:00:00.000Z",
  });
  const list = [older, newer];

  it("按难度筛选", () => {
    const result = queryFavorites(list, { ...DEFAULT_QUERY, difficulty: "expert" });
    expect(result.map((item) => item.title)).toEqual(["新题"]);
  });

  it("按完成状态筛选", () => {
    expect(queryFavorites(list, { ...DEFAULT_QUERY, status: "completed" })).toHaveLength(1);
    expect(queryFavorites(list, { ...DEFAULT_QUERY, status: "unfinished" })).toHaveLength(1);
  });

  it("默认按收藏时间倒序", () => {
    const result = queryFavorites(list, DEFAULT_QUERY);
    expect(result.map((item) => item.title)).toEqual(["新题", "旧题"]);
  });

  it("按难度排序时按五档顺序", () => {
    const result = queryFavorites(list, { ...DEFAULT_QUERY, sort: "difficulty" });
    expect(result.map((item) => item.title)).toEqual(["旧题", "新题"]);
  });

  it("按最佳用时排序时空值排最后", () => {
    const result = queryFavorites(list, { ...DEFAULT_QUERY, sort: "bestTime" });
    expect(result[0]?.title).toBe("旧题");
    expect(result[1]?.title).toBe("新题");
  });

  it("不修改入参数组", () => {
    const input = [...list];
    queryFavorites(input, { ...DEFAULT_QUERY, sort: "difficulty" });
    expect(input[0]?.title).toBe("旧题");
  });

  it("isCompleted 以最佳用时为准", () => {
    expect(isCompleted(older)).toBe(true);
    expect(isCompleted(newer)).toBe(false);
  });
});

describe("标签解析", () => {
  it("按中英文逗号和空格切分", () => {
    expect(parseTags("通勤，难题 经典,每日")).toEqual(["通勤", "难题", "经典", "每日"]);
  });

  it("去重并去掉空项", () => {
    expect(parseTags("a, a,  , b")).toEqual(["a", "b"]);
  });

  it("限制标签数量", () => {
    const input = Array.from({ length: 12 }, (_, index) => `t${index}`).join(",");
    expect(parseTags(input)).toHaveLength(MAX_TAGS);
  });

  it("collectTags 去重并排序", () => {
    const tags = collectTags([makeFavorite({ tags: ["b", "a"] }), makeFavorite({ tags: ["a", "c"] })]);
    expect(tags).toEqual(["a", "b", "c"]);
  });
});
