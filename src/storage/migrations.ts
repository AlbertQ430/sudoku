/**
 * 迁移框架（SRS 6.4 第 4 条：迁移必须幂等）。
 *
 * 每个迁移带稳定 id，执行前查 meta 里的 `migration:<id>` 标记；
 * 执行成功才写标记，因此重复执行不会产生重复数据。
 * 破坏性迁移的「先备份再迁移」由调用方在 `backup` 回调里提供。
 */

import type { SudokuDB } from "./db";
import { META_KEYS, MIGRATION_PREFIX } from "./schema";

export interface Migration {
  readonly id: string;
  /** 迁移内容；抛错则整体中止，标记不会写入。 */
  readonly run: (db: SudokuDB) => Promise<void>;
  /** 破坏性迁移前导出快照；返回的字符串由调用方保存。 */
  readonly backup?: (db: SudokuDB) => Promise<string>;
}

export interface MigrationReport {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
  readonly backup?: string;
}

export async function runMigrations(db: SudokuDB, migrations: readonly Migration[]): Promise<MigrationReport> {
  const applied: string[] = [];
  const skipped: string[] = [];
  let backup: string | undefined;

  for (const migration of migrations) {
    const marker = await db.meta.get(`${MIGRATION_PREFIX}${migration.id}`);
    if (marker !== undefined) {
      skipped.push(migration.id);
      continue;
    }

    if (migration.backup !== undefined) {
      backup = await migration.backup(db);
    }

    await migration.run(db);
    await db.meta.put({ key: `${MIGRATION_PREFIX}${migration.id}`, value: new Date().toISOString() });
    applied.push(migration.id);
  }

  if (applied.length > 0) {
    await db.meta.put({ key: META_KEYS.migratedAt, value: new Date().toISOString() });
  }

  return backup === undefined ? { applied, skipped } : { applied, skipped, backup };
}
