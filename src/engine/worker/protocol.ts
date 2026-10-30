/**
 * 主线程 ↔ Worker 的消息协议。
 *
 * 约束：请求体必须可结构化克隆，因此不能包含函数。
 * 生成选项里的 `onProgress` / `shouldCancel` 由 Worker 侧自行补齐。
 */

import type { CountResult } from "../counter";
import type { GenerateProgress, GenerateResult } from "../generator";
import type { Rating } from "../rater";
import type { SolveOutcome } from "../solver";
import type { Difficulty, Grid81, Symmetry } from "../types";

/** 可跨线程传递的生成参数。 */
export interface EngineGeneratePayload {
  readonly difficulty: Difficulty;
  readonly symmetry?: Symmetry;
  readonly deadlineMs?: number;
  readonly seed?: string;
}

export interface EngineSolvePayload {
  readonly givens: Grid81;
  readonly deadlineMs?: number;
}

export interface EngineCountPayload {
  readonly givens: Grid81;
  readonly limit?: 1 | 2;
  readonly deadlineMs?: number;
}

export interface EngineRatePayload {
  readonly givens: Grid81;
}

export type EngineRequest =
  | { readonly id: string; readonly kind: "generate"; readonly payload: EngineGeneratePayload }
  | { readonly id: string; readonly kind: "solve"; readonly payload: EngineSolvePayload }
  | { readonly id: string; readonly kind: "count"; readonly payload: EngineCountPayload }
  | { readonly id: string; readonly kind: "rate"; readonly payload: EngineRatePayload }
  | { readonly id: string; readonly kind: "cancel"; readonly targetId: string };

export type EngineErrorCode = "BAD_REQUEST" | "WORKER_CRASH" | "INTERNAL";

export type EngineResponse =
  | { readonly id: string; readonly kind: "progress"; readonly payload: GenerateProgress }
  | { readonly id: string; readonly kind: "result"; readonly payload: GenerateResult | SolveOutcome | CountResult | Rating | null }
  | { readonly id: string; readonly kind: "error"; readonly payload: { readonly code: EngineErrorCode; readonly message: string } }
  | { readonly id: string; readonly kind: "cancelled" };
