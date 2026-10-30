/**
 * 存储层的运行时单例。
 *
 * 只在应用启动时导入；测试直接构造 `SudokuDB`，不经过这里。
 */

import { openDatabase } from "./db";
import { DB_VERSION } from "./schema";
import { FavoriteRepository } from "./repositories/favorites";
import { MetaRepository } from "./repositories/meta";
import { PuzzleRepository } from "./repositories/puzzles";
import { SessionRepository } from "./repositories/sessions";
import { SettingsRepository } from "./repositories/settings";
import { StatsRepository } from "./repositories/stats";

export const db = openDatabase();

export const puzzleRepo = new PuzzleRepository(db);
export const sessionRepo = new SessionRepository(db);
export const favoriteRepo = new FavoriteRepository(db);
export const settingsRepo = new SettingsRepository(db);
export const statsRepo = new StatsRepository(db);
export const metaRepo = new MetaRepository(db);

export const SCHEMA_VERSION = DB_VERSION;

/** 本地日期 `YYYY-MM-DD`，用于连续天数。 */
export function localToday(): string {
  return new Date().toLocaleDateString("sv-SE");
}
