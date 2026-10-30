/**
 * 题目仓储：canonicalKey 去重是唯一写入入口。
 */

import type { Puzzle } from "../../domain/types";
import type { SudokuDB } from "../db";

export class PuzzleRepository {
  constructor(private readonly db: SudokuDB) {}

  /**
   * 写入题目。
   *
   * 同一个 `canonicalKey` 只保留一条记录：若已存在不同 id 的同题，
   * 复用已有 id 和创建时间，避免收藏/对局引用悬空。
   */
  async save(puzzle: Puzzle): Promise<Puzzle> {
    return this.db.transaction("rw", this.db.puzzles, async () => {
      const existing = await this.db.puzzles.where("canonicalKey").equals(puzzle.canonicalKey).first();

      if (existing !== undefined && existing.id !== puzzle.id) {
        const merged: Puzzle = { ...puzzle, id: existing.id, createdAt: existing.createdAt };
        await this.db.puzzles.put(merged);
        return merged;
      }

      await this.db.puzzles.put(puzzle);
      return puzzle;
    });
  }

  async get(id: string): Promise<Puzzle | undefined> {
    return this.db.puzzles.get(id);
  }

  async byCanonicalKey(canonicalKey: string): Promise<Puzzle | undefined> {
    return this.db.puzzles.where("canonicalKey").equals(canonicalKey).first();
  }

  async listRecent(limit = 20): Promise<Puzzle[]> {
    return this.db.puzzles.orderBy("createdAt").reverse().limit(limit).toArray();
  }

  async count(): Promise<number> {
    return this.db.puzzles.count();
  }

  async remove(id: string): Promise<void> {
    await this.db.transaction("rw", this.db.puzzles, async () => {
      await this.db.puzzles.delete(id);
    });
  }
}
