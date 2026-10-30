/**
 * 回归题集构建器（SRS NFR-MNT-003：每档至少 200 道）。
 *
 * 默认跳过。分批生成的原因：sudoku-core 的 `analyze` 在单进程连续调用约 40 次后
 * 会耗尽内存，所以每批只生成 30 道，由外部循环推进批次号。
 *
 * 跑法：
 *   FIXTURE_DIFFICULTY=medium FIXTURE_BATCH=0 pnpm exec vitest run src/engine/fixture-builder.test.ts
 * 批次号决定 seed 区段（batch × 30），重复跑同一批不会产生重复数据。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { it } from "vitest";
import { generatePuzzle } from "./generator";
import { DIFFICULTY_ORDER } from "./rater";
import type { Difficulty } from "./types";

const DIFFICULTY_NAME = process.env.FIXTURE_DIFFICULTY ?? "";
const BATCH = Number(process.env.FIXTURE_BATCH ?? -1);
const CHUNK_SIZE = 30;
const TARGET = 200;
const FIXTURE_FILE = join(process.cwd(), "src/engine/fixtures/regression.json");

interface RegressionEntry {
  readonly seed: string;
  readonly givens: string;
  readonly solution: string;
  readonly clues: number;
  readonly ratingVersion: string;
}

type FixtureStore = Record<string, RegressionEntry[]>;

const isDifficulty = (value: string): value is Difficulty =>
  (DIFFICULTY_ORDER as readonly string[]).includes(value);

it.skipIf(BATCH < 0 || !isDifficulty(DIFFICULTY_NAME))(
  `构建回归题集 ${DIFFICULTY_NAME} 批次 ${BATCH}`,
  () => {
    const difficulty = DIFFICULTY_NAME as Difficulty;
    const store: FixtureStore = existsSync(FIXTURE_FILE)
      ? (JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as FixtureStore)
      : {};
    const list = store[difficulty] ?? [];
    const seen = new Set(list.map((entry) => entry.seed));

    // 用随机 seed 而不是连续的 seed 区间：mulberry32 对相邻字符串会产生相关性，
    // 实测某些 seed 区段会整段失败，导致夹具缺口集中在某一档。
    for (let i = 0; i < CHUNK_SIZE && list.length < TARGET; i++) {
      const seed = `reg-${difficulty}-${Math.random().toString(36).slice(2, 10)}`;
      if (seen.has(seed)) continue;

      const result = generatePuzzle({ difficulty, seed, deadlineMs: 8000 });
      if (!result.ok) continue;

      list.push({
        seed,
        givens: result.puzzle.givens,
        solution: result.puzzle.solution,
        clues: result.puzzle.clues,
        ratingVersion: result.puzzle.ratingVersion,
      });
      seen.add(seed);
    }

    store[difficulty] = list;
    mkdirSync(dirname(FIXTURE_FILE), { recursive: true });
    writeFileSync(FIXTURE_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    console.warn(`[fixture] ${difficulty} batch ${BATCH}: ${list.length}/${TARGET}`);
  },
  300_000,
);
