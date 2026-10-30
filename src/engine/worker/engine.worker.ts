/**
 * 引擎 Worker 入口。
 *
 * 只做消息分发，不持有业务规则——所有判定都在 engine 的纯函数里。
 * 取消：`cancel` 消息会被记录，生成/求解在下一个检查点通过 `shouldCancel` 退出；
 * 由于算法是同步的，消息无法在长循环中途被处理，主线程另有强制终止兜底。
 */

import { countSolutions } from "../counter";
import { generatePuzzle } from "../generator";
import { ratePuzzle } from "../rater";
import { solvePuzzle } from "../solver";
import type { EngineRequest, EngineResponse } from "./protocol";

interface WorkerScope {
  onmessage: ((event: MessageEvent<EngineRequest>) => void) | null;
  postMessage(message: EngineResponse): void;
}

const scope = self as unknown as WorkerScope;

/** 已被取消但可能仍在运行的请求。 */
const cancelled = new Set<string>();

function post(message: EngineResponse): void {
  scope.postMessage(message);
}

function handle(request: EngineRequest): void {
  if (request.kind === "cancel") {
    cancelled.add(request.targetId);
    return;
  }

  const { id } = request;

  try {
    switch (request.kind) {
      case "generate": {
        const result = generatePuzzle({
          ...request.payload,
          shouldCancel: () => cancelled.has(id),
          onProgress: (progress) => post({ id, kind: "progress", payload: progress }),
        });
        post({ id, kind: "result", payload: result });
        break;
      }
      case "solve": {
        const result = solvePuzzle(request.payload.givens, { deadlineMs: request.payload.deadlineMs });
        post({ id, kind: "result", payload: result });
        break;
      }
      case "count": {
        const result = countSolutions(request.payload.givens, {
          limit: request.payload.limit,
          deadlineMs: request.payload.deadlineMs,
        });
        post({ id, kind: "result", payload: result });
        break;
      }
      case "rate": {
        const result = ratePuzzle(request.payload.givens);
        post({ id, kind: "result", payload: result });
        break;
      }
      default: {
        post({
          id,
          kind: "error",
          payload: { code: "BAD_REQUEST", message: "未知请求类型" },
        });
      }
    }
  } catch (error) {
    post({
      id,
      kind: "error",
      payload: {
        code: "INTERNAL",
        message: error instanceof Error ? error.message : "未知错误",
      },
    });
  } finally {
    cancelled.delete(id);
  }
}

scope.onmessage = (event: MessageEvent<EngineRequest>) => {
  handle(event.data);
};
