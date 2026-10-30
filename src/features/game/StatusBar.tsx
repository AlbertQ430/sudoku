import { formatDuration } from "../../domain/timer";
import type { MachineStatus } from "../../domain/sessionMachine";
import type { PuzzleDifficulty } from "../../domain/types";

const DIFFICULTY_LABEL: Readonly<Record<PuzzleDifficulty, string>> = {
  beginner: "入门",
  easy: "简单",
  medium: "中等",
  hard: "困难",
  expert: "专家",
  custom: "自定义",
};

export interface StatusBarProps {
  readonly difficulty: PuzzleDifficulty;
  readonly elapsedMs: number;
  /** 还差多少格填满；填满后传 0。 */
  readonly remaining: number;
  /** 是否显示计时（设置项 showTimer）。 */
  readonly showTimer?: boolean;
  readonly status: MachineStatus;
  readonly onPause: () => void;
  readonly onResume: () => void;
}

export function StatusBar(props: StatusBarProps) {
  const canToggle = props.status === "playing" || props.status === "paused";
  const showRemaining = props.remaining > 0 && (props.status === "playing" || props.status === "paused");
  const showTimer = props.showTimer ?? true;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="rounded bg-slate-100 px-2 py-1 font-medium text-slate-800">
        {DIFFICULTY_LABEL[props.difficulty]}
      </span>

      {showTimer ? (
        <output aria-label="用时" className="font-mono tabular-nums text-slate-700">
          {formatDuration(props.elapsedMs)}
        </output>
      ) : null}

      {/* 「还差 N 格」取代了原来的手动检查按钮（SRS V1.2 3.7 第 5 条） */}
      {showRemaining ? <span className="text-slate-600">还差 {props.remaining} 格</span> : null}

      <button
        type="button"
        disabled={!canToggle}
        onClick={props.status === "playing" ? props.onPause : props.onResume}
        className="min-h-11 rounded-lg bg-slate-100 px-3 font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-50"
      >
        {props.status === "playing" ? "暂停" : "继续"}
      </button>
    </div>
  );
}
