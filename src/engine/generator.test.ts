import { describe, expect, it } from "vitest";
import { countSolutions } from "./counter";
import { generatePuzzle } from "./generator";
import { ratePuzzle } from "./rater";
import { isRotationallySymmetric } from "./symmetry";

const TIMEOUT = 30_000;

function expectValidPuzzle(result: ReturnType<typeof generatePuzzle>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`生成失败：${result.reason}`);
  return result.puzzle;
}

describe("generatePuzzle", () => {
  it(
    "生成中等难度：唯一解、提示数合法、评级命中",
    () => {
      const puzzle = expectValidPuzzle(
        generatePuzzle({ difficulty: "medium", seed: "medium-1", deadlineMs: 5000 }),
      );

      expect(puzzle.difficulty).toBe("medium");
      expect(puzzle.requestedDifficulty).toBe("medium");
      expect(puzzle.clues).toBeGreaterThanOrEqual(22);
      expect(puzzle.clues).toBeLessThanOrEqual(50);

      const check = countSolutions(puzzle.givens, { limit: 2 });
      expect(check.invalid).toBe(false);
      expect(check.count).toBe(1);

      expect(/^[1-9]{81}$/.test(puzzle.solution)).toBe(true);
      for (let i = 0; i < 81; i++) {
        if (puzzle.givens.charAt(i) !== "0") {
          expect(puzzle.solution.charAt(i)).toBe(puzzle.givens.charAt(i));
        }
      }
    },
    TIMEOUT,
  );

  it(
    "同一 seed 生成同一道题",
    () => {
      const a = expectValidPuzzle(generatePuzzle({ difficulty: "beginner", seed: "same-seed", deadlineMs: 5000 }));
      const b = expectValidPuzzle(generatePuzzle({ difficulty: "beginner", seed: "same-seed", deadlineMs: 5000 }));
      expect(a.givens).toBe(b.givens);
      expect(a.solution).toBe(b.solution);
    },
    TIMEOUT,
  );

  it(
    "默认开启 180° 旋转对称",
    () => {
      const puzzle = expectValidPuzzle(generatePuzzle({ difficulty: "beginner", seed: "sym-1", deadlineMs: 5000 }));
      expect(puzzle.symmetry).toBe("rotational");
      expect(isRotationallySymmetric(puzzle.givens)).toBe(true);
    },
    TIMEOUT,
  );

  it(
    "关闭对称时不强制对称",
    () => {
      const puzzle = expectValidPuzzle(
        generatePuzzle({ difficulty: "beginner", seed: "asym-1", symmetry: "none", deadlineMs: 5000 }),
      );
      expect(puzzle.symmetry).toBe("none");
      expect(countSolutions(puzzle.givens, { limit: 2 }).count).toBe(1);
    },
    TIMEOUT,
  );

  it("deadline 为 0 时立即返回超时", () => {
    const result = generatePuzzle({ difficulty: "expert", deadlineMs: 0, seed: "t" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("timeout");
  });

  it("shouldCancel 为真时返回取消", () => {
    const result = generatePuzzle({
      difficulty: "medium",
      deadlineMs: 5000,
      shouldCancel: () => true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("cancelled");
  });

  it(
    "生成的题目评级与请求档一致",
    () => {
      const puzzle = expectValidPuzzle(generatePuzzle({ difficulty: "hard", seed: "hard-1", deadlineMs: 8000 }));
      const rating = ratePuzzle(puzzle.givens);
      expect(rating).not.toBeNull();
      if (rating === null) return;
      expect(rating.difficulty).toBe("hard");
      expect(rating.hasUniqueSolution).toBe(true);
    },
    TIMEOUT,
  );
});
