/**
 * 收藏仓储：同一题只能收藏一次（`puzzleId` 唯一索引）。
 */

import type { Favorite } from "../../domain/types";
import { NOTE_MAX_LENGTH, TITLE_MAX_LENGTH } from "../../domain/favorites";
import type { SudokuDB } from "../db";

export class FavoriteRepository {
  constructor(private readonly db: SudokuDB) {}

  /** 已收藏则返回已有记录，不创建副本（SRS 6.6）。 */
  async add(favorite: Favorite): Promise<{ favorite: Favorite; created: boolean }> {
    return this.db.transaction("rw", this.db.favorites, async () => {
      const existing = await this.db.favorites.where("puzzleId").equals(favorite.puzzleId).first();
      if (existing !== undefined) return { favorite: existing, created: false };

      await this.db.favorites.put(favorite);
      return { favorite, created: true };
    });
  }

  async remove(id: string): Promise<void> {
    await this.db.favorites.delete(id);
  }

  async get(id: string): Promise<Favorite | undefined> {
    return this.db.favorites.get(id);
  }

  async byPuzzle(puzzleId: string): Promise<Favorite | undefined> {
    return this.db.favorites.where("puzzleId").equals(puzzleId).first();
  }

  async byCanonicalKey(canonicalKey: string): Promise<Favorite | undefined> {
    return this.db.favorites.where("canonicalKey").equals(canonicalKey).first();
  }

  /** 按收藏时间倒序。 */
  async list(): Promise<Favorite[]> {
    return this.db.favorites.orderBy("createdAt").reverse().toArray();
  }

  async updateBestTime(puzzleId: string, bestTimeMs: number): Promise<void> {
    const existing = await this.byPuzzle(puzzleId);
    if (existing === undefined) return;
    if (existing.bestTimeMs !== null && existing.bestTimeMs <= bestTimeMs) return;
    await this.db.favorites.put({ ...existing, bestTimeMs });
  }

  async markOpened(id: string, at: string, sessionId: string | null): Promise<void> {
    const existing = await this.db.favorites.get(id);
    if (existing === undefined) return;
    await this.db.favorites.put({ ...existing, lastOpenedAt: at, lastSessionId: sessionId });
  }

  async count(): Promise<number> {
    return this.db.favorites.count();
  }

  /** 编辑标题、备注与标签（FR-FAV-008）。长度在这里兜底，页面也会限制输入。 */
  async updateMeta(
    id: string,
    patch: { readonly title?: string; readonly note?: string; readonly tags?: readonly string[] },
  ): Promise<Favorite | undefined> {
    const existing = await this.db.favorites.get(id);
    if (existing === undefined) return undefined;

    const next: Favorite = {
      ...existing,
      title: patch.title === undefined ? existing.title : patch.title.slice(0, TITLE_MAX_LENGTH),
      note: patch.note === undefined ? existing.note : patch.note.slice(0, NOTE_MAX_LENGTH),
      tags: patch.tags === undefined ? existing.tags : [...patch.tags],
    };

    await this.db.favorites.put(next);
    return next;
  }
}
