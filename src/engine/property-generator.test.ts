/**
 * 属性测试：生成结果的不变式。
 *
 * 次数压低的原因同 property-rating：每次生成内部会多次调用 `analyze`。
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { countSolutions } from "./counter";
import { generatePuzzle } from "./generator";
import { DIFFICULTY_ORDER } from "./rater";

describe("生成结果的不变式", () => {
  it("唯一解、解合法、解兼容给定数、提示数合法", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DIFFICULTY_ORDER),
        fc.integer({ min: 0, max: 999_999 }),
        (difficulty, seed) => {
          const result = generatePuzzle({ difficulty, seed: `prop-${seed}`, deadlineMs: 8000 });
          if (!result.ok) return;

          const { givens, solution, clues, difficulty: rated } = result.puzzle;

          expect(clues).toBeGreaterThanOrEqual(22);
          expect(clues).toBeLessThanOrEqual(50);
          expect(solution).toMatch(/^[1-9]{81}$/);
          expect(rated).toBe(difficulty);
          expect(countSolutions(givens, { limit: 2 }).count).toBe(1);

          for (let i = 0; i < 81; i++) {
            if (givens.charAt(i) !== "0") {
              expect(solution.charAt(i)).toBe(givens.charAt(i));
            }
          }
        },
      ),
      { numRuns: 10, timeout: 60_000 },
    );
  }, 90_000);
});
