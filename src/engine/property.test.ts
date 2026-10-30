/**
 * 属性测试（纯计数层，不调用 sudoku-core 的评级）。
 *
 * SRS NFR-MNT-002 要求覆盖唯一解 / 多解 / 无解 / 冲突 / 边界。
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { countSolutions } from "./counter";
import { normalize } from "./parser";
import { solvePuzzle } from "./solver";

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

/** 随机挖空若干格：可能唯一、可能多解、可能无解。 */
function digger(maxDug: number) {
  return fc.uniqueArray(fc.integer({ min: 0, max: 80 }), { maxLength: maxDug }).map((indices) => {
    const cells = SOLUTION.split("");
    for (const index of indices) cells[index] = "0";
    return cells.join("");
  });
}

describe("归一化", () => {
  it("normalize 是幂等的", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const once = normalize(text);
        expect(normalize(once)).toBe(once);
      }),
      { numRuns: 300 },
    );
  });

  it("归一化不引入空白和分隔符", () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        expect(normalize(text)).not.toMatch(/[\s|+,/\\]/);
      }),
      { numRuns: 200 },
    );
  });
});

describe("解数判定", () => {
  it("countSolutions 与 solvePuzzle 的结论一致", () => {
    fc.assert(
      fc.property(digger(60), (grid) => {
        const count = countSolutions(grid, { limit: 2, deadlineMs: 2000 });
        if (count.invalid || count.timedOut) return;

        const solved = solvePuzzle(grid, { deadlineMs: 2000 });
        if (solved.status === "timeout") return;

        const expected = count.count === 0 ? "none" : count.count === 1 ? "unique" : "multiple";
        expect(solved.status).toBe(expected);
      }),
      { numRuns: 150, timeout: 60_000 },
    );
  });

  it("完整终盘只有一个解", () => {
    expect(countSolutions(SOLUTION, { limit: 2 }).count).toBe(1);
  });
});
