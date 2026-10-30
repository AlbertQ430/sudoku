/**
 * 设置仓储：单例行，读写整份设置（SRS 6.2.4）。
 */

import { createDefaultSettings, type Settings } from "../../domain/types";
import type { SudokuDB } from "../db";
import { SINGLETON_KEY } from "../schema";

export class SettingsRepository {
  constructor(private readonly db: SudokuDB) {}

  /** 未初始化时返回默认值，不写库。 */
  async get(schemaVersion: number): Promise<Settings> {
    const row = await this.db.settings.get(SINGLETON_KEY);
    if (row === undefined) return createDefaultSettings(schemaVersion);

    const { key: _key, ...settings } = row;
    return settings;
  }

  async save(settings: Settings): Promise<void> {
    await this.db.settings.put({ ...settings, key: SINGLETON_KEY });
  }

  async reset(schemaVersion: number): Promise<Settings> {
    const settings = createDefaultSettings(schemaVersion);
    await this.save(settings);
    return settings;
  }
}
