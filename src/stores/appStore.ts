/**
 * 应用级 store 实例：把领域 store 与 IndexedDB 持久化接起来。
 *
 * 浏览器入口导入这里；组件测试用 `createGameStore(mockAdapter)`。
 */

import { recordOutcome, recordStart } from "../domain";
import { localToday, puzzleRepo, sessionRepo, statsRepo } from "../storage/runtime";
import { createGameStore, type GameAdapter } from "./gameStore";

const adapter: GameAdapter = {
  async onStart(session) {
    await sessionRepo.create(session);
  },

  async onUpdate(session) {
    const existing = await sessionRepo.get(session.id);
    if (existing === undefined) {
      await puzzleRepo.save({
        id: session.puzzleId,
        canonicalKey: session.puzzleSnapshot.givens,
        givens: session.puzzleSnapshot.givens,
        solution: session.puzzleSnapshot.solution,
        difficulty: session.puzzleSnapshot.difficulty,
        ratingVersion: session.puzzleSnapshot.ratingVersion,
        source: "generated",
        symmetry: "rotational",
        seed: null,
        title: "",
        tags: [],
        createdAt: session.startedAt,
        updatedAt: session.updatedAt,
      });
      await sessionRepo.create(session);
      return;
    }
    await sessionRepo.save(session);
  },

  async onFinish(session) {
    await adapter.onUpdate(session);
    const now = new Date().toISOString();
    const stats = await statsRepo.get(now);
    const next = recordOutcome(stats, session, { now, today: localToday() });
    await statsRepo.save(next);
  },

  async onAbandon(session) {
    await adapter.onUpdate(session);
    const now = new Date().toISOString();
    const stats = await statsRepo.get(now);
    const next = recordOutcome(stats, session, { now, today: localToday() });
    await statsRepo.save(next);
  },
};

export const useGameStore = createGameStore(adapter);

/** 第一局开始时把 totalStarted 加一（SRS 6.2.5）。 */
export async function markStarted(): Promise<void> {
  const now = new Date().toISOString();
  const stats = await statsRepo.get(now);
  await statsRepo.save(recordStart(stats, { now }));
}
