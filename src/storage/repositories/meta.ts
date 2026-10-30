/**
 * 元数据仓储：schema 版本、迁移标记、诊断日志等（SRS 6.4）。
 */

import type { SudokuDB } from "../db";
import { META_KEYS, MIGRATION_PREFIX } from "../schema";

export class MetaRepository {
  constructor(private readonly db: SudokuDB) {}

  async get<T>(key: string): Promise<T | undefined> {
    const row = await this.db.meta.get(key);
    return row?.value as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.db.meta.put({ key, value });
  }

  async has(key: string): Promise<boolean> {
    return (await this.db.meta.get(key)) !== undefined;
  }

  /** 迁移是否已执行过（幂等判断）。 */
  async isMigrationApplied(id: string): Promise<boolean> {
    return this.has(`${MIGRATION_PREFIX}${id}`);
  }

  async markMigrationApplied(id: string): Promise<void> {
    await this.set(`${MIGRATION_PREFIX}${id}`, new Date().toISOString());
  }

  async getSchemaVersion(): Promise<number | undefined> {
    return this.get<number>(META_KEYS.schemaVersion);
  }

  async setSchemaVersion(version: number): Promise<void> {
    await this.set(META_KEYS.schemaVersion, version);
  }
}
