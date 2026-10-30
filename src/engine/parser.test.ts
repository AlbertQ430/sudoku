import { describe, expect, it } from "vitest";
import {
  canonicalKey,
  cluesOf,
  format81,
  normalize,
  parse81,
  toHalfWidthDigits,
} from "./parser";

/** 经典题（唯一解），用作解析测试的基准。 */
const CLASSIC =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

/** 与 CLASSIC 对应的完整终盘。 */
const CLASSIC_SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function emptyGrid(): string[] {
  return Array.from({ length: 81 }, () => "0");
}

describe("toHalfWidthDigits", () => {
  it("把全角数字转成半角", () => {
    expect(toHalfWidthDigits("０１２３４５６７８９")).toBe("0123456789");
  });

  it("保留非数字字符", () => {
    expect(toHalfWidthDigits("a１b")).toBe("a1b");
  });
});

describe("normalize", () => {
  it("把点和下划线当成空格", () => {
    expect(normalize("1.2_3")).toBe("10203");
  });

  it("忽略空白和常见分隔符", () => {
    expect(normalize("1 2|3+4-5,6/7\\8\t9")).toBe("123456789");
  });

  it("把全角数字与全角空格一并处理", () => {
    expect(normalize("１２３　４")).toBe("1234");
  });
});

describe("parse81", () => {
  it("解析经典题并统计提示数", () => {
    const result = parse81(CLASSIC);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.givens).toBe(CLASSIC);
    expect(result.clues).toBe(30);
  });

  it("接受全角数字与换行分隔的输入", () => {
    const pretty = [
      "５３０ ０７０ ０００",
      "６００ １９５ ０００",
      "０９８ ０００ ０６０",
      "８００ ０６０ ００３",
      "４００ ８０３ ００１",
      "７００ ０２０ ００６",
      "０６０ ０００ ２８０",
      "０００ ４１９ ００５",
      "０００ ０８０ ０７９",
    ].join("\n");
    const result = parse81(pretty);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.givens).toBe(CLASSIC);
  });

  it("长度不足返回 LENGTH", () => {
    const result = parse81("123");
    expect(result).toEqual({ ok: false, code: "LENGTH", cells: [] });
  });

  it("非法字符返回具体格位", () => {
    const cells = emptyGrid();
    cells[0] = "x";
    cells[80] = "#";
    const result = parse81(cells.join(""));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("CHARACTER");
    expect(result.cells).toEqual([0, 80]);
  });

  it("同行重复数字返回冲突格", () => {
    const cells = emptyGrid();
    cells[0] = "5";
    cells[5] = "5";
    const result = parse81(cells.join(""));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("CONFLICT");
    expect(result.cells).toEqual([0, 5]);
  });

  it("提示数不足返回 TOO_FEW_CLUES", () => {
    const result = parse81("0".repeat(81));
    expect(result).toEqual({ ok: false, code: "TOO_FEW_CLUES", cells: [] });
  });

  it("可以放宽提示数下限", () => {
    const result = parse81("0".repeat(81), { minClues: 0 });
    expect(result.ok).toBe(true);
  });

  it("冲突检查优先于提示数下限", () => {
    const cells = emptyGrid();
    cells[0] = "7";
    cells[1] = "7";
    const result = parse81(cells.join(""));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("CONFLICT");
  });
});

describe("cluesOf", () => {
  it("只统计 1–9", () => {
    expect(cluesOf(CLASSIC)).toBe(30);
    expect(cluesOf(CLASSIC_SOLUTION)).toBe(81);
    expect(cluesOf("0".repeat(81))).toBe(0);
  });
});

describe("canonicalKey", () => {
  it("对合法题目返回归一化后的 81 位字符串", () => {
    expect(canonicalKey(CLASSIC)).toBe(CLASSIC);
  });

  it("对带分隔符的输入同样归一化", () => {
    expect(canonicalKey(format81(CLASSIC, ".").replaceAll(" ", "").replaceAll(".", "0"))).toBe(CLASSIC);
  });

  it("对非法长度抛错", () => {
    expect(() => canonicalKey("123")).toThrow(RangeError);
  });

  it("对非法字符抛错", () => {
    expect(() => canonicalKey(`${"0".repeat(80)}x`)).toThrow(RangeError);
  });
});

describe("format81", () => {
  it("输出 9 行、每行 3 组", () => {
    const text = format81(CLASSIC);
    const lines = text.split("\n");
    expect(lines).toHaveLength(9);
    expect(lines[0]).toBe("530 070 000");
    expect(lines[8]).toBe("000 080 079");
  });

  it("可以替换空位字符", () => {
    const text = format81(CLASSIC, ".");
    expect(text.split("\n")[0]).toBe("53. .7. ...");
  });
});
