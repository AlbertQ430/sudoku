/**
 * 对局仓储。
 *
 * 约束（SRS 6.3）：同一 `puzzleId` 同时最多一个 `playing/paused` 对局，
 * 由 `save` 在事务里保证——写入进行中状态前会先把同题的其它进行中对局标记为放弃。
 */

import type { GameSession, SessionStatus } from "../../domain/types";
import type { SudokuDB } from "../db";

const ACTIVE_STATUSES: readonly SessionStatus[] = ["playing", "paused"];

export class SessionRepository {
  constructor(private readonly db: SudokuDB) {}

  /** 新建对局；若同题已有进行中对局，会先把它标记为 abandoned。 */
  async create(session: GameSession): Promise<GameSession> {
    return this.db.transaction("rw", this.db.sessions, async () => {
      const ongoing = await this.db.sessions
        .where("[puzzleId+status]")
        .anyOf(ACTIVE_STATUSES.map((status) => [session.puzzleId, status]))
        .toArray();

      for (const other of ongoing) {
        if (other.id === session.id) continue;
        await this.db.sessions.put({ ...other, status: "abandoned", updatedAt: session.updatedAt });
      }

      await this.db.sessions.put(session);
      return session;
    });
  }

  async save(session: GameSession): Promise<void> {
    await this.db.sessions.put(session);
  }

  async get(id: string): Promise<GameSession | undefined> {
    return this.db.sessions.get(id);
  }

  async findOngoingByPuzzle(puzzleId: string): Promise<GameSession | undefined> {
    return this.db.sessions
      .where("[puzzleId+status]")
      .anyOf(ACTIVE_STATUSES.map((status) => [puzzleId, status]))
      .first();
  }

  async findLatestByPuzzle(puzzleId: string): Promise<GameSession | undefined> {
    // updatedAt 不是 puzzleId 索引的一部分，取出后自己排序，避免 .last() 的语义陷阱
    const list = await this.db.sessions.where("puzzleId").equals(puzzleId).toArray();
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }

  /** 最近一局进行中的对局，用于首页「继续对局」。 */
  async findLatestOngoing(): Promise<GameSession | undefined> {
    const all = await this.db.sessions.where("status").anyOf([...ACTIVE_STATUSES]).toArray();
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }

  /**
   * 保留最近 `keep` 条已结束对局（SRS 5.11：历史对局 200 条）。
   * 不清理进行中与收藏关联的记录。
   */
  async pruneHistory(keep = 200): Promise<number> {
    return this.db.transaction("rw", this.db.sessions, async () => {
      const finished = await this.db.sessions
        .where("status")
        .anyOf(["completed", "solved", "abandoned"])
        .toArray();

      if (finished.length <= keep) return 0;

      finished.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
      const stale = finished.slice(0, finished.length - keep);
      await this.db.sessions.bulkDelete(stale.map((session) => session.id));
      return stale.length;
    });
  }

  async count(): Promise<number> {
    return this.db.sessions.count();
  }
}
