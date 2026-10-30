import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  BACKUP_VERSION,
  BackupError,
  backupFileName,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup,
} from "./backup";
import { openDatabase, type SudokuDB } from "./db";
import { SINGLETON_KEY } from "./schema";
import type { Favorite, GameSession, Puzzle, Settings } from "../domain/types";

const GIVENS = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

const SETTINGS: Settings = {
  theme: "system",
  locale: "zh-CN",
  autoRemoveNotes: true,
  highlightSameNumber: true,
  highlightPeers: true,
  showConflicts: true,
  showTimer: true,
  hideBoardOnPause: true,
  soundEnabled: false,
  hapticsEnabled: false,
  reducedMotion: false,
  onboardingDone: false,
  schemaVersion: 1,
};

function makePuzzle(overrides: Partial<Puzzle> = {}): Puzzle {
  return {
    id: "p1",
    canonicalKey: GIVENS,
    givens: GIVENS,
    solution: SOLUTION,
    difficulty: "easy",
    ratingVersion: "1.0.0",
    source: "generated",
    symmetry: "rotational",
    seed: "seed-1",
    title: "",
    tags: [],
    createdAt: "2026-10-30T10:00:00.000Z",
    updatedAt: "2026-10-30T10:00:00.000Z",
    ...overrides,
  };
}

function makeFavorite(overrides: Partial<Favorite> = {}): Favorite {
  return {
    id: "f1",
    puzzleId: "p1",
    puzzleSnapshot: { givens: GIVENS, solution: SOLUTION, difficulty: "easy", ratingVersion: "1.0.0" },
    title: "经典题",
    note: "",
    tags: [],
    createdAt: "2026-10-30T10:05:00.000Z",
    lastOpenedAt: null,
    bestTimeMs: null,
    lastSessionId: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: "s1",
    puzzleId: "p1",
    puzzleSnapshot: { givens: GIVENS, solution: SOLUTION, difficulty: "easy", ratingVersion: "1.0.0" },
    currentGrid: GIVENS,
    notes: Array.from({ length: 81 }, () => 0),
    status: "playing",
    isPractice: false,
    elapsedMs: 12_000,
    assisted: false,
    machineSolved: false,
    hintCount: 0,
    checkCount: 0,
    startedAt: "2026-10-30T10:00:00.000Z",
    updatedAt: "2026-10-30T10:03:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("备份格式", () => {
  it("导出的文件名带日期时间", () => {
    expect(backupFileName(new Date(2026, 9, 30, 9, 5))).toBe("sudoku-backup-20261030-0905.json");
  });

  it("拒绝非本应用的备份", () => {
    expect(() => parseBackup(JSON.stringify({ format: "other", version: 1 }))).toThrow(BackupError);
  });

  it("拒绝更高版本的备份", () => {
    const payload = {
      format: "sudoku-backup",
      version: BACKUP_VERSION + 1,
      puzzles: [],
      favorites: [],
      sessions: [],
    };
    expect(() => parseBackup(JSON.stringify(payload))).toThrow(/高于当前支持/);
  });

  it("拒绝非法 JSON", () => {
    expect(() => parseBackup("{ not json")).toThrow(/不是合法的 JSON/);
  });

  it("拒绝字段缺失的记录", () => {
    const payload = {
      format: "sudoku-backup",
      version: 1,
      puzzles: [{ id: "p1" }],
      favorites: [],
      sessions: [],
    };
    expect(() => parseBackup(JSON.stringify(payload))).toThrow(BackupError);
  });

  it("接受合法备份并补全可选字段", () => {
    const payload = {
      format: "sudoku-backup",
      version: 1,
      puzzles: [makePuzzle()],
      favorites: [],
      sessions: [],
    };
    const parsed = parseBackup(JSON.stringify(payload));
    expect(parsed.puzzles).toHaveLength(1);
    expect(parsed.settings).toBeNull();
    expect(parsed.stats).toBeNull();
  });
});

describe("导出与导入", () => {
  let db: SudokuDB;

  beforeEach(async () => {
    db = openDatabase(`backup-test-${Math.random().toString(36).slice(2)}`);
    await db.open();
  });

  it("往返导出导入后数据一致（replace）", async () => {
    await db.puzzles.put(makePuzzle());
    await db.favorites.put(makeFavorite());
    await db.sessions.put(makeSession());
    await db.settings.put({ ...SETTINGS, key: SINGLETON_KEY });

    const exported = await exportBackup(db);
    const text = serializeBackup(exported);

    const other = openDatabase(`backup-test-${Math.random().toString(36).slice(2)}`);
    await other.open();
    const summary = await importBackup(other, parseBackup(text), "replace");

    expect(summary.puzzles).toBe(1);
    expect(summary.favorites).toBe(1);
    expect(summary.sessions).toBe(1);
    expect((await other.puzzles.toArray())[0]?.givens).toBe(GIVENS);
    expect((await other.settings.toArray())[0]?.key).toBe(SINGLETON_KEY);
  });

  it("replace 模式会清掉原有数据", async () => {
    await db.puzzles.put(makePuzzle({ id: "old", canonicalKey: "old" }));

    const payload = parseBackup(
      JSON.stringify({
        format: "sudoku-backup",
        version: 1,
        puzzles: [makePuzzle({ id: "new", canonicalKey: "new" })],
        favorites: [],
        sessions: [],
      }),
    );

    await importBackup(db, payload, "replace");

    const ids = (await db.puzzles.toArray()).map((item) => item.id);
    expect(ids).toEqual(["new"]);
  });

  it("merge 模式保留较新记录并统计冲突", async () => {
    await db.puzzles.put(makePuzzle({ updatedAt: "2026-10-30T12:00:00.000Z", title: "本地较新" }));

    const incoming = parseBackup(
      JSON.stringify({
        format: "sudoku-backup",
        version: 1,
        puzzles: [makePuzzle({ updatedAt: "2026-10-30T09:00:00.000Z", title: "导入较旧" })],
        favorites: [],
        sessions: [],
      }),
    );

    const summary = await importBackup(db, incoming, "merge");

    expect(summary.conflicts).toBe(1);
    expect((await db.puzzles.toArray())[0]?.title).toBe("本地较新");
  });

  it("merge 模式写入更新的记录", async () => {
    await db.puzzles.put(makePuzzle({ updatedAt: "2026-10-30T09:00:00.000Z", title: "本地较旧" }));

    const incoming = parseBackup(
      JSON.stringify({
        format: "sudoku-backup",
        version: 1,
        puzzles: [makePuzzle({ updatedAt: "2026-10-30T12:00:00.000Z", title: "导入较新" })],
        favorites: [],
        sessions: [],
      }),
    );

    await importBackup(db, incoming, "merge");
    expect((await db.puzzles.toArray())[0]?.title).toBe("导入较新");
  });

  it("校验失败时不会写入任何数据", async () => {
    await db.puzzles.put(makePuzzle());

    const broken = JSON.stringify({
      format: "sudoku-backup",
      version: 1,
      puzzles: [makePuzzle(), { id: "bad" }],
      favorites: [],
      sessions: [],
    });

    expect(() => parseBackup(broken)).toThrow(BackupError);
    expect(await db.puzzles.count()).toBe(1);
  });
});
