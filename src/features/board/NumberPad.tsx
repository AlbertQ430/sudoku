/**
 * 数字键盘（NFR-A11Y-007：触摸目标 ≥ 44×44）。
 */

export interface NumberPadProps {
  readonly onDigit: (digit: number) => void;
  readonly onClear: () => void;
  readonly notesMode: boolean;
  readonly onToggleNotes: () => void;
  readonly disabled?: boolean;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const BASE_BUTTON =
  "flex min-h-11 min-w-11 items-center justify-center rounded-lg text-lg font-medium " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function NumberPad(props: NumberPadProps) {
  const disabled = props.disabled ?? false;

  return (
    <div role="group" aria-label="数字键盘" className="grid grid-cols-5 gap-2">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => props.onDigit(digit)}
          aria-label={`填入 ${digit}`}
          className={`${BASE_BUTTON} bg-slate-100 text-slate-900 hover:bg-slate-200`}
        >
          {digit}
        </button>
      ))}

      <button
        type="button"
        disabled={disabled}
        onClick={props.onClear}
        aria-label="清除当前格"
        className={`${BASE_BUTTON} bg-slate-100 text-slate-900 hover:bg-slate-200`}
      >
        <span aria-hidden="true">⌫</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={props.onToggleNotes}
        aria-label="候选模式"
        aria-pressed={props.notesMode}
        className={`${BASE_BUTTON} ${
          props.notesMode ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-900 hover:bg-slate-200"
        }`}
      >
        <span aria-hidden="true">✎</span>
      </button>
    </div>
  );
}
