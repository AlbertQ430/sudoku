/**
 * 从文件导入题目（SRS FR-CUS-010）。
 *
 * 支持 `.txt` 与 `.json`，上限 5 MB。只做「提取 81 位字符串」这一件事，
 * 后续的合法性校验仍走 CustomPage 的五步流程，避免两套校验口径。
 */

import { parse81 } from "../engine/parser";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ImportResult = { readonly ok: true; readonly givens: string } | { readonly ok: false; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 把一个候选值规范成 81 位字符串；不是合法题目则返回 null。 */
function normalize(candidate: unknown): string | null {
  if (typeof candidate !== "string") return null;
  const parsed = parse81(candidate, { minClues: 0 });
  return parsed.ok ? parsed.givens : null;
}

/** 递归收集可能藏题的字段，兼容 `{ givens }`、`{ puzzles: [...] }`、纯数组等写法。 */
function candidatesFrom(value: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  if (typeof value === "string") return [value];

  if (Array.isArray(value)) {
    return value.flatMap((item) => candidatesFrom(item, depth + 1));
  }

  if (isRecord(value)) {
    const keys = ["givens", "puzzle", "sudoku", "grid", "board", "data", "puzzles", "题目", "题面"];
    return keys.flatMap((key) => (key in value ? candidatesFrom(value[key], depth + 1) : []));
  }

  return [];
}

function fromJson(content: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, message: "JSON 格式错误，无法解析" };
  }

  for (const candidate of candidatesFrom(parsed)) {
    const givens = normalize(candidate);
    if (givens !== null) return { ok: true, givens };
  }

  return { ok: false, message: "JSON 里没有找到 81 位的题目字符串" };
}

function fromText(content: string): ImportResult {
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    if (line.trim() === "") continue;

    const givens = normalize(line);
    if (givens !== null) return { ok: true, givens };
  }

  // 整段读进来再试一次：有些文件是一长行用空格分隔
  const whole = normalize(content.replace(/\s+/g, ""));
  if (whole !== null) return { ok: true, givens: whole };

  return { ok: false, message: "文件里没有找到 81 位题目，每行应是一道完整的 81 位题目" };
}

/** 按扩展名选择解析方式；扩展名缺失时先按 JSON 试，再按文本试。 */
export function extractPuzzle(content: string, fileName: string): ImportResult {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".json")) return fromJson(content);
  if (lower.endsWith(".txt")) return fromText(content);

  return fromJson(content).ok ? fromJson(content) : fromText(content);
}

/** 文件大小是否在允许范围内。 */
export function isImportableSize(bytes: number): boolean {
  return bytes <= MAX_IMPORT_BYTES;
}
