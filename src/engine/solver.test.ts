import { describe, expect, it } from "vitest";
import { isStandardPlayable, solvePuzzle } from "./solver";

const CLASSIC =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

const CLASSIC_SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function mutate(grid: string, index: number, value: string): string {
  const cells = grid.split("");
  cells[index] = value;
  return cells.join("");
}

describe("solvePuzzle", () => {
  it("唯一解题返回 unique 与完整终盘", () => {
    const outcome = solvePuzzle(CLASSIC);
    expect(outcome.status).toBe("unique");
    expect(outcome.solution).toBe(CLASSIC_SOLUTION);
    expect(outcome.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("完整合法终盘也判为 unique", () => {
    const outcome = solvePuzzle(CLASSIC_SOLUTION);
    expect(outcome.status).toBe("unique");
    expect(outcome.solution).toBe(CLASSIC_SOLUTION);
  });

  it("空盘判为 multiple，只带回第一个解并标记解数为 2", () => {
    const outcome = solvePuzzle("0".repeat(81), { deadlineMs: 2000 });
    expect(outcome.status).toBe("multiple");
    expect(outcome.count).toBe(2);
    expect(outcome.solution).toMatch(/^[1-9]{81}$/);
  });

  it("合法但无解返回 none", () => {
    const outcome = solvePuzzle(mutate(CLASSIC, 2, "1"));
    expect(outcome.status).toBe("none");
    expect(outcome.solution).toBeNull();
  });

  it("给定数冲突返回 invalid，不混为无解", () => {
    const cells = "0".repeat(81).split("");
    cells[0] = "5";
    cells[5] = "5";
    const outcome = solvePuzzle(cells.join(""));
    expect(outcome.status).toBe("invalid");
  });

  it("长度错误返回 invalid", () => {
    expect(solvePuzzle("123").status).toBe("invalid");
  });

  it("非法字符返回 invalid", () => {
    expect(solvePuzzle(`${"0".repeat(80)}x`).status).toBe("invalid");
  });

  it("deadline 为 0 返回 timeout，绝不判为 none", () => {
    const outcome = solvePuzzle(CLASSIC, { deadlineMs: 0 });
    expect(outcome.status).toBe("timeout");
    expect(outcome.solution).toBeNull();
  });
});

describe("isStandardPlayable", () => {
  it("唯一解题可以开始标准模式", () => {
    expect(isStandardPlayable(CLASSIC)).toBe(true);
  });

  it("多解题、无解题、非法题都不可以", () => {
    expect(isStandardPlayable("0".repeat(81), 1000)).toBe(false);
    expect(isStandardPlayable(mutate(CLASSIC, 2, "1"))).toBe(false);
    expect(isStandardPlayable("123")).toBe(false);
  });
});
