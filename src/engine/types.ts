/**
 * 引擎层的公共类型。
 *
 * 约定：对外一律使用 81 位字符串（`0` 表示空），位掩码只在引擎内部流转。
 */

/** 81 位字符串，每一位是 `0`–`9`。 */
export type Grid81 = string;

/** 产品对外的五档难度（SRS 3.5）。 */
export type Difficulty = "beginner" | "easy" | "medium" | "hard" | "expert";

/** 挖空对称性（SRS 3.6）。 */
export type Symmetry = "rotational" | "none";

/** 单元格索引，0–80，`row * 9 + column`。 */
export type CellIndex = number;

export type ParseErrorCode =
  | "LENGTH"
  | "CHARACTER"
  | "CONFLICT"
  | "TOO_FEW_CLUES";

export interface ParseOk {
  readonly ok: true;
  readonly givens: Grid81;
  readonly clues: number;
}

export interface ParseFail {
  readonly ok: false;
  readonly code: ParseErrorCode;
  /** 出问题的格位，供 UI 定位；结构性错误为空数组。 */
  readonly cells: readonly CellIndex[];
}

export type ParseResult = ParseOk | ParseFail;

export interface ConflictReport {
  /** 参与冲突的格，升序。 */
  readonly cells: readonly CellIndex[];
  /** 发生冲突的行 / 列 / 宫。 */
  readonly rows: readonly boolean[];
  readonly cols: readonly boolean[];
  readonly boxes: readonly boolean[];
}
