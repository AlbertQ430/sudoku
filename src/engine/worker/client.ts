/**
 * Worker 客户端：请求/响应配对、进度回调、取消与崩溃恢复。
 *
 * 取消是「乐观」的：主线程先拒绝 Promise 让 UI 立刻恢复，
 * 再通知 Worker 尽快退出；如果 Worker 被同步算法卡住（消息进不去），
 * 宽限期过后直接终止并重建，保证后续请求不被堵死。
 */

import type { CountResult } from "../counter";
import type { GenerateOptions, GenerateProgress, GenerateResult } from "../generator";
import type { Rating } from "../rater";
import type { SolveOutcome } from "../solver";
import type { EngineRequest, EngineResponse } from "./protocol";

export class EngineCancelledError extends Error {
  constructor() {
    super("请求已取消");
    this.name = "EngineCancelledError";
  }
}

export class EngineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}

export interface EngineClientOptions {
  /** 测试注入点；默认用模块 Worker。 */
  readonly createWorker?: () => Worker;
  /** 取消后等待 Worker 让出的宽限期，默认 800ms。 */
  readonly cancelGraceMs?: number;
}

export interface EngineRequestHandle<T> {
  readonly id: string;
  readonly promise: Promise<T>;
}

export interface EngineClient {
  generate(options: GenerateOptions): EngineRequestHandle<GenerateResult>;
  solve(givens: string, deadlineMs?: number): EngineRequestHandle<SolveOutcome>;
  count(givens: string, options?: { limit?: 1 | 2; deadlineMs?: number }): EngineRequestHandle<CountResult>;
  rate(givens: string): EngineRequestHandle<Rating | null>;
  cancel(id: string): void;
  dispose(): void;
}

interface Pending {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
}

export function createEngineClient(options: EngineClientOptions = {}): EngineClient {
  const graceMs = options.cancelGraceMs ?? 800;

  let worker: Worker | null = null;
  let sequence = 0;

  const pending = new Map<string, Pending>();
  const progressHandlers = new Map<string, (progress: GenerateProgress) => void>();
  const awaiting = new Set<string>();
  const cancelTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function spawnWorker(): Worker {
    const created = options.createWorker
      ? options.createWorker()
      : new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
    created.onmessage = onMessage;
    created.onerror = onCrash;
    return created;
  }

  function ensureWorker(): Worker {
    if (worker === null) worker = spawnWorker();
    return worker;
  }

  function clearCancelTimer(id: string): void {
    const timer = cancelTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      cancelTimers.delete(id);
    }
  }

  function settle(id: string): Pending | undefined {
    const entry = pending.get(id);
    pending.delete(id);
    progressHandlers.delete(id);
    awaiting.delete(id);
    clearCancelTimer(id);
    return entry;
  }

  function onMessage(event: MessageEvent<EngineResponse>): void {
    const message = event.data;

    if (message.kind === "progress") {
      progressHandlers.get(message.id)?.(message.payload);
      return;
    }

    // 已被取消的请求仍可能回复，用来证明 Worker 已经让出
    if (!pending.has(message.id)) {
      awaiting.delete(message.id);
      clearCancelTimer(message.id);
      return;
    }

    const entry = settle(message.id);
    if (entry === undefined) return;

    if (message.kind === "result") entry.resolve(message.payload);
    else if (message.kind === "cancelled") entry.reject(new EngineCancelledError());
    else entry.reject(new EngineError(message.payload.code, message.payload.message));
  }

  function onCrash(): void {
    failAll(new EngineError("WORKER_CRASH", "工作线程异常终止"));
    worker?.terminate();
    worker = null;
  }

  function failAll(error: Error): void {
    for (const id of [...pending.keys()]) {
      const entry = settle(id);
      entry?.reject(error);
    }
    awaiting.clear();
  }

  function nextId(): string {
    sequence += 1;
    return `req-${sequence}`;
  }

  function send<T>(request: EngineRequest): EngineRequestHandle<T> {
    awaiting.add(request.id);

    const promise = new Promise<T>((resolve, reject) => {
      pending.set(request.id, { resolve: resolve as (value: unknown) => void, reject });
      ensureWorker().postMessage(request);
    });

    return { id: request.id, promise };
  }

  return {
    generate(generateOptions: GenerateOptions): EngineRequestHandle<GenerateResult> {
      const id = nextId();
      if (generateOptions.onProgress !== undefined) {
        progressHandlers.set(id, generateOptions.onProgress);
      }
      const { onProgress: _onProgress, shouldCancel: _shouldCancel, ...payload } = generateOptions;
      const handle = send<GenerateResult>({ id, kind: "generate", payload });

      // 生成是重型任务：每次结束后回收 Worker，避免 sudoku-core 的内存
      // 在长驻线程里累积，最终把渲染进程拖崩。
      const recycle = (): void => {
        worker?.terminate();
        worker = null;
      };
      handle.promise.then(recycle, recycle);

      return handle;
    },

    solve(givens: string, deadlineMs?: number): EngineRequestHandle<SolveOutcome> {
      return send<SolveOutcome>({ id: nextId(), kind: "solve", payload: { givens, deadlineMs } });
    },

    count(
      givens: string,
      countOptions: { limit?: 1 | 2; deadlineMs?: number } = {},
    ): EngineRequestHandle<CountResult> {
      return send<CountResult>({
        id: nextId(),
        kind: "count",
        payload: { givens, limit: countOptions.limit, deadlineMs: countOptions.deadlineMs },
      });
    },

    rate(givens: string): EngineRequestHandle<Rating | null> {
      return send<Rating | null>({ id: nextId(), kind: "rate", payload: { givens } });
    },

    cancel(id: string): void {
      const entry = pending.get(id);
      if (entry === undefined) return;

      // 立即让 UI 恢复，不等 Worker
      pending.delete(id);
      progressHandlers.delete(id);
      entry.reject(new EngineCancelledError());

      ensureWorker().postMessage({ id: nextId(), kind: "cancel", targetId: id });

      const timer = setTimeout(() => {
        cancelTimers.delete(id);
        if (!awaiting.has(id)) return;
        // Worker 没能让出：终止并重建，避免新请求被一起堵住
        awaiting.delete(id);
        worker?.terminate();
        worker = null;
      }, graceMs);

      cancelTimers.set(id, timer);
    },

    dispose(): void {
      failAll(new EngineCancelledError());
      for (const timer of cancelTimers.values()) clearTimeout(timer);
      cancelTimers.clear();
      worker?.terminate();
      worker = null;
    },
  };
}
