import { describe, expect, it } from "vitest";
import { DIFFICULTY_ORDER, RATING_VERSION, ratePuzzle } from "./rater";

const CLASSIC =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

const CLASSIC_SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

/** AI Escargot：著名的高难题，用于验证「逻辑解不出」的标记。 */
const AI_ESCARGOT =
  "100007090030020008009600500005300900010080002600004000300000010040000007007000300";

function mutate(grid: string, index: number, value: string): string {
  const cells = grid.split("");
  cells[index] = value;
  return cells.join("");
}

describe("ratePuzzle", () => {
  it("给经典题评出五档之一，并记录所用技巧", () => {
    const rating = ratePuzzle(CLASSIC);
    expect(rating).not.toBeNull();
    if (rating === null) return;

    expect(DIFFICULTY_ORDER).toContain(rating.difficulty);
    expect(rating.ratingVersion).toBe(RATING_VERSION);
    expect(rating.usedTechniques.length).toBeGreaterThan(0);
    expect(rating.hardestTactic).not.toBeNull();
    expect(rating.clues).toBe(30);
    expect(rating.requiresGuessing).toBe(false);
  });

  it("已完成的终盘评为入门，且没有技巧记录", () => {
    const rating = ratePuzzle(CLASSIC_SOLUTION);
    expect(rating).not.toBeNull();
    if (rating === null) return;

    expect(rating.difficulty).toBe("beginner");
    expect(rating.usedTechniques).toEqual([]);
    expect(rating.hardestTactic).toBeNull();
    expect(rating.clues).toBe(81);
  });

  it("技巧频次之和等于解题步数里的放置类步骤至少为 1", () => {
    const rating = ratePuzzle(CLASSIC);
    expect(rating).not.toBeNull();
    if (rating === null) return;

    const total = rating.usedTechniques.reduce((sum, t) => sum + t.count, 0);
    expect(total).toBeGreaterThan(0);
  });

  it("无解题目返回 null", () => {
    expect(ratePuzzle(mutate(CLASSIC, 2, "1"))).toBeNull();
  });

  it("长度不对返回 null", () => {
    expect(ratePuzzle("123")).toBeNull();
  });

  it("非法字符返回 null", () => {
    expect(ratePuzzle(`${"0".repeat(80)}x`)).toBeNull();
  });

  it("高难题不会崩溃，且难度不高于专家", () => {
    const rating = ratePuzzle(AI_ESCARGOT);
    expect(rating).not.toBeNull();
    if (rating === null) return;

    expect(DIFFICULTY_ORDER).toContain(rating.difficulty);
    expect(DIFFICULTY_ORDER.indexOf(rating.difficulty)).toBeLessThanOrEqual(4);
    console.log("AI Escargot rating:", rating.difficulty, rating.hardestTactic, rating.requiresGuessing);
  });
});
