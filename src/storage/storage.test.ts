import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Favorite, GameSession, Puzzle } from "../domain/types";
import { isIndexedDbAvailable } from "./availability";
import { openDatabase } from "./db";
import type { SudokuDB } from "./db";
import { runMigrations, type Migration } from "./migrations";
import { FavoriteRepository } from "./repositories/favorites";
import { MetaRepository } from "./repositories/meta";
import { PuzzleRepository } from "./repositories/puzzles";
import { SessionRepository } from "./repositories/sessions";
import { SettingsRepository } from "./repositories/settings";
import { StatsRepository } from "./repositories/stats";
import { DB_VERSION } from "./schema";

const GIVENS = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

let db: SudokuDB;
let dbName: string;

function makePuzzle(overrides: Partial<Puzzle> = {}): Puzzle {
  return {
    id: crypto.randomUUID(),
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
    createdAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T00:00:00.000Z",
    ...overrides,
  };
}

function makeSession(puzzleId: string, overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: crypto.randomUUID(),
    puzzleId,
    puzzleSnapshot: { givens: GIVENS, solution: SOLUTION, difficulty: "easy", ratingVersion: "1.0.0" },
    currentGrid: GIVENS,
    notes: Array.from({ length: 81 }, () => 0),
    status: "playing",
    isPractice: false,
    elapsedMs: 0,
    assisted: false,
    machineSolved: false,
    hintCount: 0,
    checkCount: 0,
    startedAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T00:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function makeFavorite(puzzleId: string, overrides: Partial<Favorite> = {}): Favorite {
  return {
    id: crypto.randomUUID(),
    puzzleId,
    puzzleSnapshot: { givens: GIVENS, solution: SOLUTION, difficulty: "easy", ratingVersion: "1.0.0" },
    title: "测试题",
    tags: [],
    note: "",
    createdAt: "2026-10-29T00:00:00.000Z",
    lastOpenedAt: null,
    bestTimeMs: null,
    lastSessionId: null,
    ...overrides,
  };
}

beforeEach(async () => {
  dbName = `sudoku-test-${crypto.randomUUID()}`;
  db = openDatabase(dbName);
  await db.open();
});

afterEach(async () => {
  db.close();
  await Dexie.delete(dbName);
});

describe("PuzzleRepository", () => {
  it("按 id 读写", async () => {
    const repo = new PuzzleRepository(db);
    const puzzle = makePuzzle();
    await repo.save(puzzle);

    expect(await repo.get(puzzle.id)).toMatchObject({ id: puzzle.id, canonicalKey: GIVENS });
    expect(await repo.count()).toBe(1);
  });

  it("同一 canonicalKey 复用已有 id，不产生第二行", async () => {
    const repo = new PuzzleRepository(db);
    const first = await repo.save(makePuzzle());
    const second = await repo.save(makePuzzle({ title: "改名" }));

    expect(second.id).toBe(first.id);
    expect(await repo.count()).toBe(1);
    expect((await repo.get(first.id))?.title).toBe("改名");
  });

  it("不同题目各自入库", async () => {
    const repo = new PuzzleRepository(db);
    await repo.save(makePuzzle());
    await repo.save(
      makePuzzle({
        canonicalKey: SOLUTION,
        givens: SOLUTION,
      }),
    );
    expect(await repo.count()).toBe(2);
  });
});

describe("SessionRepository", () => {
  it("新建对局后能按题目查到进行中的一局", async () => {
    const repo = new SessionRepository(db);
    const session = makeSession("puzzle-1");
    await repo.create(session);

    expect(await repo.findOngoingByPuzzle("puzzle-1")).toMatchObject({ id: session.id, status: "playing" });
  });

  it("同题新建对局时旧的进行中对局转为 abandoned", async () => {
    const repo = new SessionRepository(db);
    const old = makeSession("puzzle-1");
    await repo.create(old);

    const next = makeSession("puzzle-1", { updatedAt: "2026-10-29T01:00:00.000Z" });
    await repo.create(next);

    expect((await repo.get(old.id))?.status).toBe("abandoned");
    expect((await repo.get(next.id))?.status).toBe("playing");
    expect(await repo.findOngoingByPuzzle("puzzle-1")).toMatchObject({ id: next.id });
  });

  it("findLatestOngoing 返回最近更新的一局", async () => {
    const repo = new SessionRepository(db);
    await repo.create(makeSession("puzzle-1", { updatedAt: "2026-10-29T00:00:00.000Z" }));
    const recent = makeSession("puzzle-2", { updatedAt: "2026-10-29T02:00:00.000Z" });
    await repo.create(recent);

    expect(await repo.findLatestOngoing()).toMatchObject({ id: recent.id });
  });

  it("pruneHistory 只清理已结束对局，保留进行中", async () => {
    const repo = new SessionRepository(db);
    for (let i = 0; i < 5; i++) {
      await repo.create(
        makeSession(`puzzle-${i}`, {
          status: "completed",
          updatedAt: `2026-10-29T0${i}:00:00.000Z`,
        }),
      );
    }
    const ongoing = makeSession("puzzle-live", { updatedAt: "2026-10-29T09:00:00.000Z" });
    await repo.create(ongoing);

    const removed = await repo.pruneHistory(2);
    expect(removed).toBe(3);
    expect(await repo.count()).toBe(3);
    expect(await repo.get(ongoing.id)).toBeDefined();
  });
});

describe("FavoriteRepository", () => {
  it("同一题只收藏一次", async () => {
    const repo = new FavoriteRepository(db);
    const first = await repo.add(makeFavorite("puzzle-1"));
    const second = await repo.add(makeFavorite("puzzle-1", { title: "重复" }));

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.favorite.id).toBe(first.favorite.id);
    expect(await repo.count()).toBe(1);
  });

  it("按收藏时间倒序返回", async () => {
    const repo = new FavoriteRepository(db);
    await repo.add(makeFavorite("puzzle-1", { createdAt: "2026-10-27T00:00:00.000Z" }));
    await repo.add(makeFavorite("puzzle-2", { createdAt: "2026-10-29T00:00:00.000Z" }));

    const list = await repo.list();
    expect(list.map((item) => item.puzzleId)).toEqual(["puzzle-2", "puzzle-1"]);
  });

  it("updateBestTime 只接受更快成绩", async () => {
    const repo = new FavoriteRepository(db);
    await repo.add(makeFavorite("puzzle-1", { bestTimeMs: 120_000 }));

    await repo.updateBestTime("puzzle-1", 200_000);
    expect((await repo.byPuzzle("puzzle-1"))?.bestTimeMs).toBe(120_000);

    await repo.updateBestTime("puzzle-1", 90_000);
    expect((await repo.byPuzzle("puzzle-1"))?.bestTimeMs).toBe(90_000);
  });
});

describe("SettingsRepository", () => {
  it("未初始化的库返回默认设置且不落盘", async () => {
    const repo = new SettingsRepository(db);
    const settings = await repo.get(DB_VERSION);

    expect(settings.schemaVersion).toBe(DB_VERSION);
    expect(settings.locale).toBe("zh-CN");
    expect(await db.settings.count()).toBe(0);
  });

  it("保存后可读回", async () => {
    const repo = new SettingsRepository(db);
    const initial = await repo.get(DB_VERSION);
    await repo.save({ ...initial, theme: "dark", showTimer: false });

    const restored = await repo.get(DB_VERSION);
    expect(restored.theme).toBe("dark");
    expect(restored.showTimer).toBe(false);
  });

  it("reset 恢复默认值", async () => {
    const repo = new SettingsRepository(db);
    await repo.save({ ...(await repo.get(DB_VERSION)), theme: "light" });
    const reset = await repo.reset(DB_VERSION);
    expect(reset.theme).toBe("system");
  });
});

describe("StatsRepository", () => {
  it("未初始化时返回全零统计", async () => {
    const repo = new StatsRepository(db);
    const stats = await repo.get("2026-10-29T00:00:00.000Z");
    expect(stats.totalStarted).toBe(0);
    expect(stats.bestTimeByDifficulty).toEqual({});
  });

  it("保存后可读回", async () => {
    const repo = new StatsRepository(db);
    const stats = await repo.get("2026-10-29T00:00:00.000Z");
    await repo.save({ ...stats, totalCompleted: 3, bestTimeByDifficulty: { easy: 61_000 } });

    const restored = await repo.get("2026-10-29T01:00:00.000Z");
    expect(restored.totalCompleted).toBe(3);
    expect(restored.bestTimeByDifficulty.easy).toBe(61_000);
  });
});

describe("MetaRepository 与迁移", () => {
  it("读写元数据", async () => {
    const repo = new MetaRepository(db);
    expect(await repo.getSchemaVersion()).toBeUndefined();

    await repo.setSchemaVersion(1);
    expect(await repo.getSchemaVersion()).toBe(1);
  });

  it("迁移只执行一次", async () => {
    let runs = 0;
    const migration: Migration = {
      id: "v2-add-field",
      run: async () => {
        runs++;
      },
    };

    const first = await runMigrations(db, [migration]);
    const second = await runMigrations(db, [migration]);

    expect(first.applied).toEqual(["v2-add-field"]);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["v2-add-field"]);
    expect(runs).toBe(1);
  });

  it("迁移失败时不写标记，可重试", async () => {
    const migration: Migration = {
      id: "broken",
      run: async () => {
        throw new Error("迁移失败");
      },
    };

    await expect(runMigrations(db, [migration])).rejects.toThrow("迁移失败");

    const repo = new MetaRepository(db);
    expect(await repo.isMigrationApplied("broken")).toBe(false);
  });

  it("破坏性迁移会先产出备份", async () => {
    const migration: Migration = {
      id: "destructive",
      backup: async () => "BACKUP_PAYLOAD",
      run: async () => undefined,
    };

    const report = await runMigrations(db, [migration]);
    expect(report.backup).toBe("BACKUP_PAYLOAD");
  });
});

describe("事务", () => {
  it("事务内抛错会回滚", async () => {
    await expect(
      db.transaction("rw", db.meta, async () => {
        await db.meta.put({ key: "rollback", value: 1 });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await db.meta.get("rollback")).toBeUndefined();
  });
});

describe("可用性探测", () => {
  it("fake-indexeddb 环境下判定为可用", async () => {
    expect(await isIndexedDbAvailable()).toBe(true);
  });
});

describe("容量与性能（M2 完成标准）", () => {
  it(
    "1,000 条收藏 + 200 条对局的写入与读取在 500ms 内",
    async () => {
      const favorites = new FavoriteRepository(db);
      const sessions = new SessionRepository(db);

      const favoriteRows = Array.from({ length: 1000 }, (_, i) =>
        makeFavorite(`puzzle-${i}`, { createdAt: `2026-10-29T00:00:${String(i % 60).padStart(2, "0")}.000Z` }),
      );
      const sessionRows = Array.from({ length: 200 }, (_, i) => makeSession(`puzzle-${i}`));

      const started = performance.now();
      await db.favorites.bulkPut(favoriteRows);
      await db.sessions.bulkPut(sessionRows);
      const list = await favorites.list();
      const elapsed = performance.now() - started;

      expect(list).toHaveLength(1000);
      expect(await sessions.count()).toBe(200);
      // fake-indexeddb 是内存实现，真实浏览器会慢一些；这里作为下限守门
      expect(elapsed).toBeLessThan(500);
    },
    120_000,
  );

  it("pruneHistory 每次只清理超出阈值的部分", async () => {
    const sessions = new SessionRepository(db);
    const rows = Array.from({ length: 1000 }, (_, i) =>
      makeSession(`puzzle-${i}`, {
        status: "completed",
        updatedAt: new Date(1_700_000_000_000 + i * 1000).toISOString(),
      }),
    );
    await db.sessions.bulkPut(rows);

    const started = performance.now();
    const removed = await sessions.pruneHistory(999);
    const elapsed = performance.now() - started;

    // 真实场景是「+1 条就清 1 条」，不是一口气清 800 条
    expect(removed).toBe(1);
    expect(await sessions.count()).toBe(999);
    expect(elapsed).toBeLessThan(500);
  }, 120_000);
});
