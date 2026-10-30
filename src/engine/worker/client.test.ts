import { afterEach, describe, expect, it, vi } from "vitest";
import type { EngineRequest, EngineResponse } from "./protocol";
import { EngineCancelledError, EngineError, createEngineClient } from "./client";

class FakeWorker {
  onmessage: ((event: MessageEvent<EngineResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  readonly sent: EngineRequest[] = [];
  terminated = false;

  postMessage(message: EngineRequest): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  reply(message: EngineResponse): void {
    this.onmessage?.({ data: message } as MessageEvent<EngineResponse>);
  }

  lastRequest(): EngineRequest | undefined {
    return this.sent[this.sent.length - 1];
  }
}

function setup(options: { graceMs?: number } = {}) {
  const workers: FakeWorker[] = [];
  const client = createEngineClient({
    createWorker: () => {
      const fake = new FakeWorker();
      workers.push(fake);
      return fake as unknown as Worker;
    },
    cancelGraceMs: options.graceMs ?? 100,
  });
  return { client, workers, current: () => workers[workers.length - 1]! };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createEngineClient", () => {
  it("生成请求返回结果", async () => {
    const { client, current } = setup();
    const handle = client.generate({ difficulty: "medium" });

    const request = current().lastRequest();
    expect(request?.kind).toBe("generate");

    const result = { ok: true, puzzle: { clues: 30 } };
    current().reply({ id: handle.id, kind: "result", payload: result as never });

    await expect(handle.promise).resolves.toEqual(result);
  });

  it("进度消息触发回调", async () => {
    const { client, current } = setup();
    const onProgress = vi.fn();
    const handle = client.generate({ difficulty: "hard", onProgress });

    current().reply({ id: handle.id, kind: "progress", payload: { phase: "digging", clues: 40 } });
    current().reply({ id: handle.id, kind: "result", payload: { ok: false, reason: "timeout", elapsedMs: 1 } });

    await handle.promise;
    expect(onProgress).toHaveBeenCalledWith({ phase: "digging", clues: 40 });
  });

  it("错误响应转成 EngineError", async () => {
    const { client, current } = setup();
    const handle = client.generate({ difficulty: "easy" });

    current().reply({ id: handle.id, kind: "error", payload: { code: "INTERNAL", message: "炸了" } });

    await expect(handle.promise).rejects.toBeInstanceOf(EngineError);
    await expect(handle.promise).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("取消立即拒绝并通知 Worker", async () => {
    vi.useFakeTimers();
    const { client, current } = setup();

    const handle = client.generate({ difficulty: "expert" });
    const started = performance.now();
    client.cancel(handle.id);

    await expect(handle.promise).rejects.toBeInstanceOf(EngineCancelledError);
    // 乐观取消：不等待 Worker 让出，主线程应立即恢复（SRS 要求 ≤200ms）
    expect(performance.now() - started).toBeLessThan(50);

    const cancelRequest = current().sent.find((item) => item.kind === "cancel");
    expect(cancelRequest).toBeDefined();
    if (cancelRequest?.kind === "cancel") {
      expect(cancelRequest.targetId).toBe(handle.id);
    }
  });

  it("Worker 卡住超过宽限期时被终止，并重建新 Worker", async () => {
    vi.useFakeTimers();
    const { client, workers, current } = setup({ graceMs: 100 });

    const handle = client.generate({ difficulty: "expert" });
    client.cancel(handle.id);
    await expect(handle.promise).rejects.toBeInstanceOf(EngineCancelledError);

    expect(workers).toHaveLength(1);
    vi.advanceTimersByTime(150);
    expect(current().terminated).toBe(true);

    // 新请求会触发重建
    void client.solve("0".repeat(81)).promise.catch(() => undefined);
    expect(workers).toHaveLength(2);
  });

  it("取消后迟到的结果被忽略", async () => {
    vi.useFakeTimers();
    const { client, current } = setup();

    const handle = client.generate({ difficulty: "easy" });
    client.cancel(handle.id);
    await expect(handle.promise).rejects.toBeInstanceOf(EngineCancelledError);

    // Worker 之后才回复，不应引发异常
    expect(() => {
      current().reply({ id: handle.id, kind: "result", payload: { ok: false, reason: "timeout", elapsedMs: 1 } });
    }).not.toThrow();
  });

  it("dispose 拒绝所有未完成请求并终止 Worker", async () => {
    const { client, current } = setup();
    const first = client.solve("0".repeat(81));
    const second = client.count("0".repeat(81));

    client.dispose();

    await expect(first.promise).rejects.toBeInstanceOf(EngineCancelledError);
    await expect(second.promise).rejects.toBeInstanceOf(EngineCancelledError);
    expect(current().terminated).toBe(true);
  });

  it("worker 崩溃时拒绝全部请求", async () => {
    const { client, current } = setup();
    const handle = client.rate("0".repeat(81));

    current().onerror?.();

    await expect(handle.promise).rejects.toMatchObject({ code: "WORKER_CRASH" });
  });
});
