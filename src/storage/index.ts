/**
 * 存储层公共出口。
 *
 * 其他层只从这里拿 repository，不直接接触 Dexie 实例。
 */

export { SudokuDB, openDatabase } from "./db";
export type { MetaRow, SettingsRow, StatsRow } from "./db";
export { DB_NAME, DB_VERSION, SINGLETON_KEY, TABLE_SCHEMA } from "./schema";
export type { TableName } from "./schema";
export { detectStorage, isIndexedDbAvailable } from "./availability";
export type { StorageMode, StorageStatus } from "./availability";
export { runMigrations } from "./migrations";
export type { Migration, MigrationReport } from "./migrations";

export { PuzzleRepository } from "./repositories/puzzles";
export { SessionRepository } from "./repositories/sessions";
export { FavoriteRepository } from "./repositories/favorites";
export { SettingsRepository } from "./repositories/settings";
export { StatsRepository } from "./repositories/stats";
export { MetaRepository } from "./repositories/meta";
