/**
 * 统计仓储：单例行（SRS 6.2.5）。聚合口径由 `domain/stats.ts` 决定，这里只存取。
 */

import { createDefaultStats, type Stats } from "../../domain/types";
import type { SudokuDB } from "../db";
import { SINGLETON_KEY } from "../schema";

export class StatsRepository {
  constructor(private readonly db: SudokuDB) {}

  async get(now: string): Promise<Stats> {
    const row = await this.db.stats.get(SINGLETON_KEY);
    if (row === undefined) return createDefaultStats(now);

    const { key: _key, ...stats } = row;
    // 合并默认值：旧记录缺少后来新增的字段时不会变成 undefined
    return { ...createDefaultStats(now), ...stats };
  }

  async save(stats: Stats): Promise<void> {
    await this.db.stats.put({ ...stats, key: SINGLETON_KEY });
  }

  async reset(now: string): Promise<Stats> {
    const stats = createDefaultStats(now);
    await this.save(stats);
    return stats;
  }
}
