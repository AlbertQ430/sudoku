/**
 * 属性测试：自研计数器与 sudoku-core 的唯一性判定必须一致。
 *
 * 数量刻意压得很低——sudoku-core 的 `analyze` 分配较大，
 * 单进程连续调用约 40 次就可能耗尽内存，整个测试文件共用这个额度。
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { countSolutions } from "./counter";
import { ratePuzzle } from "./rater";

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function digger(maxDug: number) {
  return fc.uniqueArray(fc.integer({ min: 0, max: 80 }), { maxLength: maxDug }).map((indices) => {
    const cells = SOLUTION.split("");
    for (const index of indices) cells[index] = "0";
    return cells.join("");
  });
}

describe("两套实现的唯一性判定", () => {
  it("同一盘面的结论一致", () => {
    fc.assert(
      fc.property(digger(40), (grid) => {
        const rating = ratePuzzle(grid);
        const count = countSolutions(grid, { limit: 2 });

        if (rating === null) {
          expect(count.count).toBe(0);
          return;
        }
        if (count.timedOut || count.invalid) return;

        expect(rating.hasUniqueSolution).toBe(count.count === 1);
      }),
      { numRuns: 20, timeout: 60_000 },
    );
  }, 90_000);
});
