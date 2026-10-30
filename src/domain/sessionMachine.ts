/**
 * 对局状态机（SRS 8.1）。
 *
 * `ready` 不入库（SRS：Ready 状态不产生对局记录），因此它只存在于内存状态里。
 * 非法迁移直接抛错，开发期立刻暴露，而不是静默保持原状。
 */

import type { SessionStatus } from "./types";

export type MachineStatus = "ready" | SessionStatus;

export type SessionEvent =
  | { readonly type: "FIRST_MOVE" }
  | { readonly type: "PAUSE"; readonly reason: "manual" | "hidden" }
  | { readonly type: "RESUME" }
  | { readonly type: "COMPLETE" }
  | { readonly type: "SOLVE" }
  | { readonly type: "ABANDON" };

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

type EventType = SessionEvent["type"];

const TABLE: Readonly<Record<MachineStatus, Partial<Record<EventType, MachineStatus>>>> = {
  ready: { FIRST_MOVE: "playing", ABANDON: "abandoned" },
  playing: {
    PAUSE: "paused",
    COMPLETE: "completed",
    SOLVE: "solved",
    ABANDON: "abandoned",
  },
  paused: {
    RESUME: "playing",
    COMPLETE: "completed",
    SOLVE: "solved",
    ABANDON: "abandoned",
  },
  // 终态：编辑入口由「继续研究」创建新对局，不在这里做迁移
  completed: {},
  solved: {},
  // 放弃后仍可恢复（SRS 8.1：保留恢复入口）
  abandoned: { RESUME: "playing" },
};

export function transition(status: MachineStatus, event: SessionEvent): MachineStatus {
  const next = TABLE[status][event.type];
  if (next === undefined) {
    throw new TransitionError(`非法状态迁移：${status} + ${event.type}`);
  }
  return next;
}

/** completed / solved 是终态，不能继续编辑原记录。 */
export function isTerminal(status: MachineStatus): boolean {
  return status === "completed" || status === "solved";
}

/** 可以落子/改候选的状态。 */
export function canEdit(status: MachineStatus): boolean {
  return status === "ready" || status === "playing";
}

export function isTiming(status: MachineStatus): boolean {
  return status === "playing";
}
