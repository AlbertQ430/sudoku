import { describe, expect, it } from "vitest";
import { countSolutions, searchSolutions } from "./counter";

/** 经典题（唯一解，30 个提示数）。 */
const CLASSIC =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

/** CLASSIC 的唯一终盘。 */
const CLASSIC_SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function mutate(grid: string, index: number, value: string): string {
  const cells = grid.split("");
  cells[index] = value;
  return cells.join("");
}

describe("countSolutions", () => {
  it("经典题恰好一个解", () => {
    const result = countSolutions(CLASSIC);
    expect(result).toEqual({ count: 1, timedOut: false, invalid: false });
  });

  it("limit=1 时找到一个解就停", () => {
    const result = countSolutions(CLASSIC, { limit: 1 });
    expect(result.count).toBe(1);
    expect(result.timedOut).toBe(false);
  });

  it("空盘在 limit=2 时返回 2，不会穷举", () => {
    const result = countSolutions("0".repeat(81), { limit: 2 });
    expect(result).toEqual({ count: 2, timedOut: false, invalid: false });
  });

  it("只挖掉一格的完整终盘仍是唯一解", () => {
    const result = countSolutions(mutate(CLASSIC_SOLUTION, 40, "0"));
    expect(result.count).toBe(1);
  });

  it("完整合法终盘按 1 个解计", () => {
    expect(countSolutions(CLASSIC_SOLUTION).count).toBe(1);
  });

  it("把唯一解题的某个空格改成错误数字后无解", () => {
    // 原题 R1C3 为空，其解为 4；填 1 既不与给定数冲突，也破坏了唯一解
    const broken = mutate(CLASSIC, 2, "1");
    const result = countSolutions(broken);
    expect(result).toEqual({ count: 0, timedOut: false, invalid: false });
  });

  it("多解题返回 2（够判定即可）", () => {
    // 只保留前两行的给定数，其余清空
    const loose = CLASSIC.slice(0, 18) + "0".repeat(63);
    const result = countSolutions(loose);
    expect(result.count).toBe(2);
    expect(result.invalid).toBe(false);
  });

  it("长度不对判为非法", () => {
    const result = countSolutions("123");
    expect(result.invalid).toBe(true);
    expect(result.count).toBe(0);
  });

  it("非法字符判为非法", () => {
    const result = countSolutions(`${"0".repeat(80)}x`);
    expect(result.invalid).toBe(true);
  });

  it("给定数冲突判为非法", () => {
    const cells = "0".repeat(81).split("");
    cells[0] = "5";
    cells[5] = "5";
    const result = countSolutions(cells.join(""));
    expect(result.invalid).toBe(true);
    expect(result.count).toBe(0);
  });

  it("deadline 为 0 时立即超时，不会误报无解", () => {
    const result = countSolutions(CLASSIC, { deadlineMs: 0 });
    expect(result.timedOut).toBe(true);
    expect(result.invalid).toBe(false);
  });

  it("超时时不清零已确认的解数", () => {
    const result = countSolutions(CLASSIC, { deadlineMs: 0 });
    expect(result.count).toBe(0);
    expect(result.timedOut).toBe(true);
  });
});

describe("searchSolutions", () => {
  it("captureFirst 返回的终盘与已知解一致", () => {
    const result = searchSolutions(CLASSIC, { limit: 2, captureFirst: true });
    expect(result.count).toBe(1);
    expect(result.firstSolution).toBe(CLASSIC_SOLUTION);
  });

  it("不要求捕获时不返回解", () => {
    const result = searchSolutions(CLASSIC);
    expect(result.firstSolution).toBeNull();
  });

  it("返回的解是合法终盘", () => {
    const result = searchSolutions(CLASSIC, { captureFirst: true });
    const solution = result.firstSolution;
    expect(solution).not.toBeNull();
    if (solution === null) return;
    expect(solution).toHaveLength(81);
    expect(/^[1-9]{81}$/.test(solution)).toBe(true);
    // 每个给定数都保留
    for (let i = 0; i < 81; i++) {
      if (CLASSIC.charAt(i) !== "0") {
        expect(solution.charAt(i)).toBe(CLASSIC.charAt(i));
      }
    }
  });
});
