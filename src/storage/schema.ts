/**
 * IndexedDB 的库名、版本与表结构（SRS 6.4）。
 *
 * 索引设计说明：
 * - `puzzles &canonicalKey`：同一题只能入库一次；
 * - `sessions [puzzleId+status]`：查「同一题是否有进行中对局」；
 * - `favorites &puzzleId`：同一题只能收藏一次。
 */

export const DB_NAME = "sudoku";
export const DB_VERSION = 1;

/** Dexie 的 stores 声明：主键在前，`&` 表示唯一索引，`[]` 表示复合索引。 */
export const TABLE_SCHEMA = {
  puzzles: "id, &canonicalKey, difficulty, source, createdAt",
  sessions: "id, puzzleId, status, updatedAt, [puzzleId+status]",
  favorites: "id, &puzzleId, canonicalKey, createdAt, lastOpenedAt",
  settings: "key",
  stats: "key",
  meta: "key",
} as const;

export type TableName = keyof typeof TABLE_SCHEMA;

/** settings / stats 是单例表，用固定主键。 */
export const SINGLETON_KEY = "app";

/** meta 表里用到的键。 */
export const META_KEYS = {
  schemaVersion: "schemaVersion",
  ratingVersion: "ratingVersion",
  appVersion: "appVersion",
  migratedAt: "migratedAt",
} as const;

/** 迁移标记的键前缀：`migration:<id>`。 */
export const MIGRATION_PREFIX = "migration:";
