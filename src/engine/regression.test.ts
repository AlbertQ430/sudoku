/**
 * 回归题集校验（SRS NFR-MNT-003）。
 *
 * 只验证生成时记录下来的不变量，不重新评级——重新评级会调用 200×5 次 `analyze`，
 * 既慢又会撞上内存上限。评级稳定性由 `ratingVersion` 快照 + 单独的重评脚本负责。
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countSolutions } from "./counter";
import { isLegalComplete } from "./conflicts";
import { DIFFICULTY_ORDER } from "./rater";

interface RegressionEntry {
  readonly seed: string;
  readonly givens: string;
  readonly solution: string;
  readonly clues: number;
  readonly ratingVersion: string;
}

const FIXTURE_FILE = join(process.cwd(), "src/engine/fixtures/regression.json");
const STORE: Record<string, RegressionEntry[]> | null = existsSync(FIXTURE_FILE)
  ? (JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as Record<string, RegressionEntry[]>)
  : null;

describe.skipIf(STORE === null)("回归题集", () => {
  for (const difficulty of DIFFICULTY_ORDER) {
    it(
      `${difficulty}：至少 200 题，全部唯一解且解合法`,
      () => {
        const list = STORE?.[difficulty] ?? [];
        expect(list.length).toBeGreaterThanOrEqual(200);

        for (const entry of list) {
          expect(entry.givens).toMatch(/^[0-9]{81}$/);
          expect(entry.solution).toMatch(/^[1-9]{81}$/);
          expect(entry.clues).toBeGreaterThanOrEqual(22);
          expect(entry.clues).toBeLessThanOrEqual(50);
          expect(isLegalComplete(entry.solution)).toBe(true);

          for (let i = 0; i < 81; i++) {
            if (entry.givens.charAt(i) !== "0") {
              expect(entry.solution.charAt(i)).toBe(entry.givens.charAt(i));
            }
          }

          const count = countSolutions(entry.givens, { limit: 2 });
          expect(count.invalid).toBe(false);
          expect(count.timedOut).toBe(false);
          expect(count.count).toBe(1);
        }
      },
      120_000,
    );
  }
});
