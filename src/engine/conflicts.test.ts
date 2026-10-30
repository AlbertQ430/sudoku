import { describe, expect, it } from "vitest";
import { boxOf, colOf, indexOf, rowOf } from "./bitset";
import { filledCount, findConflicts, isLegalComplete, sharesUnit } from "./conflicts";

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function gridWith(values: Record<number, string>): string {
  const cells = Array.from({ length: 81 }, () => "0");
  for (const [index, value] of Object.entries(values)) {
    cells[Number(index)] = value;
  }
  return cells.join("");
}

describe("索引换算", () => {
  it("row/col/box 与索引互相对应", () => {
    expect(rowOf(0)).toBe(0);
    expect(colOf(0)).toBe(0);
    expect(boxOf(0)).toBe(0);
    expect(rowOf(80)).toBe(8);
    expect(colOf(80)).toBe(8);
    expect(boxOf(80)).toBe(8);
    expect(indexOf(4, 7)).toBe(43);
    expect(boxOf(indexOf(4, 7))).toBe(5);
  });
});

describe("findConflicts", () => {
  it("空盘没有冲突", () => {
    const report = findConflicts("0".repeat(81));
    expect(report.cells).toEqual([]);
    expect(report.rows.every((v) => !v)).toBe(true);
  });

  it("完整合法终盘没有冲突", () => {
    expect(findConflicts(SOLUTION).cells).toEqual([]);
  });

  it("同行重复标记两个格", () => {
    const report = findConflicts(gridWith({ 0: "5", 5: "5" }));
    expect(report.cells).toEqual([0, 5]);
    expect(report.rows[0]).toBe(true);
    // 同一行内的重复不构成列冲突
    expect(report.cols[0]).toBe(false);
    expect(report.cols[5]).toBe(false);
  });

  it("同列重复标记两个格", () => {
    const report = findConflicts(gridWith({ 0: "7", 9: "7" }));
    expect(report.cells).toEqual([0, 9]);
    expect(report.cols[0]).toBe(true);
    expect(report.rows[0]).toBe(false);
  });

  it("同宫重复标记两个格", () => {
    const report = findConflicts(gridWith({ 0: "9", 10: "9" }));
    expect(report.cells).toEqual([0, 10]);
    expect(report.boxes[0]).toBe(true);
    expect(report.rows[0]).toBe(false);
    expect(report.cols[0]).toBe(false);
  });

  it("同一格参与多种冲突时只出现一次", () => {
    const report = findConflicts(gridWith({ 0: "4", 1: "4", 9: "4" }));
    expect(report.cells).toEqual([0, 1, 9]);
    expect(new Set(report.cells).size).toBe(report.cells.length);
  });

  it("多个独立冲突全部返回", () => {
    const report = findConflicts(gridWith({ 0: "3", 8: "3", 40: "6", 76: "6" }));
    expect(report.cells).toEqual([0, 8, 40, 76]);
  });
});

describe("isLegalComplete", () => {
  it("完整合法终盘返回 true", () => {
    expect(isLegalComplete(SOLUTION)).toBe(true);
  });

  it("有空格返回 false", () => {
    expect(isLegalComplete(`${SOLUTION.slice(0, 80)}0`)).toBe(false);
  });

  it("含 0 但被当作数字时判 false", () => {
    const cells = SOLUTION.split("");
    cells[0] = "0";
    expect(isLegalComplete(cells.join(""))).toBe(false);
  });

  it("有冲突返回 false", () => {
    const cells = SOLUTION.split("");
    cells[0] = cells[1] ?? "1";
    expect(isLegalComplete(cells.join(""))).toBe(false);
  });

  it("长度不对返回 false", () => {
    expect(isLegalComplete("123")).toBe(false);
  });
});

describe("filledCount", () => {
  it("统计非零格", () => {
    expect(filledCount(SOLUTION)).toBe(81);
    expect(filledCount("0".repeat(81))).toBe(0);
    expect(filledCount(gridWith({ 0: "1", 40: "9" }))).toBe(2);
  });
});

describe("sharesUnit", () => {
  it("同行/同列/同宫为 true，自身也算", () => {
    expect(sharesUnit(0, 8)).toBe(true);
    expect(sharesUnit(0, 72)).toBe(true);
    expect(sharesUnit(0, 10)).toBe(true);
    expect(sharesUnit(0, 0)).toBe(true);
  });

  it("不同行不同列不同宫为 false", () => {
    expect(sharesUnit(0, 40)).toBe(false);
  });
});
