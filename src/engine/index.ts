/**
 * 引擎层公共出口。
 *
 * 其他层只能从这里 import；引擎内部模块之间可以互相引用，
 * 但不得依赖 React、DOM、存储或状态层（ESLint `no-restricted-imports` 强制）。
 */

export { CELL_COUNT } from "./constants";

export type {
  CellIndex,
  ConflictReport,
  Difficulty,
  Grid81,
  ParseErrorCode,
  ParseResult,
  Symmetry,
} from "./types";

export { canonicalKey, cluesOf, format81, normalize, parse81, toHalfWidthDigits } from "./parser";
export { filledCount, findConflicts, isLegalComplete, sharesUnit } from "./conflicts";
export { countSolutions, searchSolutions } from "./counter";
export type { CountResult, SearchOptions, SearchResult } from "./counter";
export { isStandardPlayable, solvePuzzle } from "./solver";
export type { SolveOptions, SolveOutcome, SolveStatus } from "./solver";
export { DIFFICULTY_ORDER, RATING_VERSION, ratePuzzle } from "./rater";
export type { Rating, UsedTechnique } from "./rater";
export { createRng, generatePuzzle } from "./generator";
export type {
  GenerateFailureReason,
  GenerateOptions,
  GenerateProgress,
  GenerateResult,
  GeneratedPuzzle,
} from "./generator";
export { groupsFor, isRotationallySymmetric, rotationalPartner } from "./symmetry";
