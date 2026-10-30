import { describe, expect, it } from "vitest";
import { MAX_IMPORT_BYTES, extractPuzzle, isImportableSize } from "./puzzle-file";

const CLASSIC = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

describe("文本导入", () => {
  it("取第一行有效题目", () => {
    const result = extractPuzzle(`# 我的题目\n${CLASSIC}\n`, "puzzles.txt");
    expect(result).toEqual({ ok: true, givens: CLASSIC });
  });

  it("容忍空格与分隔符", () => {
    const spaced = `530 070 000 600 195 000 098 000 060 800 060 003 400 803 001 700 020 006 060 000 280 000 419 005 000 080 079`;
    const result = extractPuzzle(spaced, "a.txt");
    expect(result.ok).toBe(true);
  });

  it("把点号与下划线当空格", () => {
    const dotted = CLASSIC.replaceAll("0", ".");
    const result = extractPuzzle(dotted, "a.txt");
    expect(result).toEqual({ ok: true, givens: CLASSIC });
  });

  it("找不到 81 位时给出提示", () => {
    const result = extractPuzzle("这不是题目", "a.txt");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("81 位");
  });
});

describe("JSON 导入", () => {
  it("接受纯字符串", () => {
    const result = extractPuzzle(JSON.stringify(CLASSIC), "a.json");
    expect(result).toEqual({ ok: true, givens: CLASSIC });
  });

  it("接受 { givens }", () => {
    const result = extractPuzzle(JSON.stringify({ givens: CLASSIC }), "a.json");
    expect(result).toEqual({ ok: true, givens: CLASSIC });
  });

  it("接受 { puzzles: [...] } 并取第一道", () => {
    const result = extractPuzzle(JSON.stringify({ puzzles: [{ givens: CLASSIC }] }), "a.json");
    expect(result).toEqual({ ok: true, givens: CLASSIC });
  });

  it("接受数组", () => {
    const result = extractPuzzle(JSON.stringify([CLASSIC]), "a.json");
    expect(result).toEqual({ ok: true, givens: CLASSIC });
  });

  it("JSON 语法错误时报错", () => {
    const result = extractPuzzle("{ not json", "a.json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("JSON");
  });

  it("结构里没有题目时报错", () => {
    const result = extractPuzzle(JSON.stringify({ foo: 1, bar: [] }), "a.json");
    expect(result.ok).toBe(false);
  });
});

describe("扩展名处理", () => {
  it("扩展名缺失时先试 JSON 再试文本", () => {
    expect(extractPuzzle(JSON.stringify(CLASSIC), "noext").ok).toBe(true);
    expect(extractPuzzle(CLASSIC, "noext").ok).toBe(true);
  });
});

describe("大小限制", () => {
  it("5 MB 以内可导入", () => {
    expect(isImportableSize(MAX_IMPORT_BYTES)).toBe(true);
    expect(isImportableSize(MAX_IMPORT_BYTES + 1)).toBe(false);
  });
});
