import { describe, expect, it } from "vitest";
import { countSolutions } from "./counter";
import { pickPuzzle, poolSize } from "./pool";
import type { Difficulty } from "./types";

const DIFFICULTIES: readonly Difficulty[] = ["beginner", "easy", "medium", "hard", "expert"];

describe("题库取题（D11）", () => {
  it("五档题库都有题", async () => {
    for (const difficulty of DIFFICULTIES) {
      expect(await poolSize(difficulty), `${difficulty} 题库为空`).toBeGreaterThan(0);
    }
  });

  it("取出的题目都通过唯一解复核", async () => {
    for (const difficulty of DIFFICULTIES) {
      const puzzle = await pickPuzzle(difficulty);
      expect(puzzle, `${difficulty} 取题失败`).not.toBeNull();
      if (puzzle === null) continue;

      expect(puzzle.givens).toHaveLength(81);
      expect(puzzle.solution).toHaveLength(81);
      expect(puzzle.difficulty).toBe(difficulty);

      const check = countSolutions(puzzle.givens, { limit: 2, deadlineMs: 2_000 });
      expect(check.count, `${difficulty} 的题不是唯一解`).toBe(1);
    }
  });

  it("给定数与解答一致", async () => {
    const puzzle = await pickPuzzle("beginner");
    if (puzzle === null) throw new Error("beginner 取题失败");

    for (let i = 0; i < 81; i++) {
      const given = puzzle.givens.charAt(i);
      if (given !== "0") expect(puzzle.solution.charAt(i)).toBe(given);
    }
  });

  it("同一 seed 取到同一道题", async () => {
    const a = await pickPuzzle("easy", { seed: "daily-2026-10-30" });
    const b = await pickPuzzle("easy", { seed: "daily-2026-10-30" });
    expect(a?.givens).toBe(b?.givens);
  });

  it("exclude 里的题会被跳过", async () => {
    const first = await pickPuzzle("medium", { seed: "avoid" });
    if (first === null) throw new Error("medium 取题失败");

    const second = await pickPuzzle("medium", { seed: "avoid", exclude: new Set([first.givens]) });
    expect(second?.givens).not.toBe(first.givens);
  });
});
