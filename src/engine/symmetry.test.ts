import { describe, expect, it } from "vitest";
import { groupsFor, isRotationallySymmetric, rotationalGroups, rotationalPartner, singleGroups } from "./symmetry";

const SYMMETRIC =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

describe("rotationalPartner", () => {
  it("180° 旋转对应到镜像格", () => {
    expect(rotationalPartner(0)).toBe(80);
    expect(rotationalPartner(80)).toBe(0);
    expect(rotationalPartner(40)).toBe(40);
    expect(rotationalPartner(9)).toBe(71);
  });
});

describe("rotationalGroups", () => {
  it("共 41 组：40 对 + 中心格", () => {
    const groups = rotationalGroups();
    expect(groups).toHaveLength(41);
    expect(groups[0]).toEqual([0, 80]);
    expect(groups[40]).toEqual([40]);
    for (const group of groups) {
      expect(group.length).toBeGreaterThanOrEqual(1);
      expect(group.length).toBeLessThanOrEqual(2);
    }
  });
});

describe("singleGroups", () => {
  it("81 组，每组一格", () => {
    const groups = singleGroups();
    expect(groups).toHaveLength(81);
    expect(groups[0]).toEqual([0]);
    expect(groups[80]).toEqual([80]);
  });
});

describe("groupsFor", () => {
  it("按对称模式选择分组", () => {
    expect(groupsFor("rotational")).toHaveLength(41);
    expect(groupsFor("none")).toHaveLength(81);
  });
});

describe("isRotationallySymmetric", () => {
  it("对称盘返回 true", () => {
    expect(isRotationallySymmetric(SYMMETRIC)).toBe(true);
  });

  it("只挖掉一侧返回 false", () => {
    const cells = SYMMETRIC.split("");
    cells[0] = "0"; // 对应位置 80 仍有 9
    expect(isRotationallySymmetric(cells.join(""))).toBe(false);
  });

  it("长度不对返回 false", () => {
    expect(isRotationallySymmetric("123")).toBe(false);
  });

  it("中心格不影响判断", () => {
    const cells = SYMMETRIC.split("");
    cells[40] = "0";
    expect(isRotationallySymmetric(cells.join(""))).toBe(true);
  });
});
