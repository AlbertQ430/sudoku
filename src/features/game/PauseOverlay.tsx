/** 暂停遮罩：默认遮住棋盘，避免「暂停时偷看」（SRS 设置项 hideBoardOnPause）。 */

export interface PauseOverlayProps {
  readonly onResume: () => void;
}

export function PauseOverlay(props: PauseOverlayProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-slate-900/90 text-white">
      <p className="text-lg font-medium">已暂停</p>
      <button
        type="button"
        onClick={props.onResume}
        className="min-h-11 rounded-lg bg-white px-4 font-medium text-slate-900"
      >
        继续
      </button>
    </div>
  );
}
