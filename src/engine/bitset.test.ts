import { describe, expect, it } from "vitest";
import {
  digitsOf,
  digitBit,
  firstDigit,
  fullCandidates,
  hasDigit,
  indexOf,
  isDigit,
  popcount,
} from "./bitset";
import { ALL_DIGITS_MASK } from "./constants";

describe("digitBit", () => {
  it("1 对应 bit0，9 对应 bit8", () => {
    expect(digitBit(1)).toBe(1);
    expect(digitBit(9)).toBe(256);
    expect(digitBit(5)).toBe(16);
  });

  it("越界返回 0", () => {
    expect(digitBit(0)).toBe(0);
    expect(digitBit(10)).toBe(0);
    expect(digitBit(-1)).toBe(0);
  });
});

describe("isDigit", () => {
  it("接受 1–9 的整数", () => {
    for (let d = 1; d <= 9; d++) expect(isDigit(d)).toBe(true);
  });

  it("拒绝 0、10、小数与非数字", () => {
    expect(isDigit(0)).toBe(false);
    expect(isDigit(10)).toBe(false);
    expect(isDigit(1.5)).toBe(false);
    expect(isDigit(Number.NaN)).toBe(false);
  });
});

describe("popcount", () => {
  it("空掩码为 0", () => {
    expect(popcount(0)).toBe(0);
  });

  it("满掩码为 9", () => {
    expect(popcount(ALL_DIGITS_MASK)).toBe(9);
  });

  it("按位计数", () => {
    expect(popcount(0b101)).toBe(2);
    expect(popcount(0b1111)).toBe(4);
  });
});

describe("digitsOf", () => {
  it("空掩码返回空数组", () => {
    expect(digitsOf(0)).toEqual([]);
  });

  it("按升序展开", () => {
    expect(digitsOf(digitBit(9) | digitBit(1))).toEqual([1, 9]);
    expect(digitsOf(ALL_DIGITS_MASK)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe("hasDigit", () => {
  it("判断掩码是否包含某个数字", () => {
    const mask = digitBit(3) | digitBit(7);
    expect(hasDigit(mask, 3)).toBe(true);
    expect(hasDigit(mask, 7)).toBe(true);
    expect(hasDigit(mask, 5)).toBe(false);
  });
});

describe("firstDigit", () => {
  it("返回最小的候选；空掩码返回 0", () => {
    expect(firstDigit(0)).toBe(0);
    expect(firstDigit(ALL_DIGITS_MASK)).toBe(1);
    expect(firstDigit(digitBit(4) | digitBit(8))).toBe(4);
  });
});

describe("fullCandidates", () => {
  it("返回九个数字全开的掩码", () => {
    expect(fullCandidates()).toBe(ALL_DIGITS_MASK);
  });
});

describe("indexOf", () => {
  it("行列换算成索引", () => {
    expect(indexOf(0, 0)).toBe(0);
    expect(indexOf(8, 8)).toBe(80);
    expect(indexOf(4, 2)).toBe(38);
  });
});
