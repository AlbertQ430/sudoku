/**
 * Dexie 数据库实例。
 *
 * 只声明结构与版本；所有访问都经由 repositories，调用方不直接写 `db.table.put()`，
 * 这样事务边界和校验才有唯一入口。
 */

import Dexie, { type Table } from "dexie";
import type { Favorite, GameSession, Puzzle, Settings, Stats } from "../domain/types";
import { DB_NAME, DB_VERSION, TABLE_SCHEMA } from "./schema";

export interface SettingsRow extends Settings {
  readonly key: string;
}

export interface StatsRow extends Stats {
  readonly key: string;
}

export interface MetaRow {
  readonly key: string;
  readonly value: unknown;
}

export class SudokuDB extends Dexie {
  puzzles!: Table<Puzzle, string>;
  sessions!: Table<GameSession, string>;
  favorites!: Table<Favorite, string>;
  settings!: Table<SettingsRow, string>;
  stats!: Table<StatsRow, string>;
  meta!: Table<MetaRow, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(DB_VERSION).stores(TABLE_SCHEMA);
  }
}

/** 打开（或创建）主库。 */
export function openDatabase(name: string = DB_NAME): SudokuDB {
  return new SudokuDB(name);
}
