/**
 * 单个棋盘格。
 *
 * 无障碍要点（NFR-A11Y-004）：
 * - `aria-label` 读出行、列、宫、给定/用户填写、候选数、冲突、错误；
 * - 给定数与用户填写不靠颜色区分，同时用字重和颜色（NFR-A11Y-010）；
 * - 候选数用 3×3 固定位置排布，屏幕阅读器也能读出集合。
 */

import { boxOf, colOf, rowOf } from "../../engine/bitset";

export interface CellProps {
  readonly index: number;
  readonly digit: number;
  readonly notes: readonly number[];
  readonly given: boolean;
  readonly selected: boolean;
  readonly conflict: boolean;
  readonly wrong: boolean;
  readonly peer: boolean;
  readonly sameNumber: boolean;
  readonly tabStop: boolean;
  readonly onSelect: (index: number) => void;
  readonly registerRef: (index: number, element: HTMLDivElement | null) => void;
}

/** 供测试与调试使用：把格子的语义拼成一句话。 */
export function cellAriaLabel(input: {
  index: number;
  digit: number;
  notes: readonly number[];
  given: boolean;
  conflict?: boolean;
  wrong?: boolean;
}): string {
  const row = rowOf(input.index) + 1;
  const col = colOf(input.index) + 1;
  const box = boxOf(input.index) + 1;

  const parts: string[] = [`第${row}行第${col}列`, `第${box}宫`];

  if (input.given) {
    parts.push(`给定数${input.digit}`);
  } else if (input.digit > 0) {
    parts.push(`用户填写${input.digit}`);
  } else if (input.notes.length > 0) {
    parts.push(`空白，候选数${input.notes.join("、")}`);
  } else {
    parts.push("空白");
  }

  if (input.conflict) parts.push("冲突");
  if (input.wrong) parts.push("与答案不一致");

  return parts.join("，");
}

function cellClasses(props: CellProps): string {
  const classes = ["relative flex aspect-square items-center justify-center select-none"];

  // 宫边界：第 3、6 列/行加粗，避免只靠间距区分
  const col = colOf(props.index);
  const row = rowOf(props.index);
  if (col === 2 || col === 5) classes.push("border-r-2 border-r-slate-700");
  if (row === 2 || row === 5) classes.push("border-b-2 border-b-slate-700");

  if (props.given) {
    classes.push("font-bold text-slate-900");
  } else {
    classes.push(props.digit > 0 ? "font-normal text-blue-700" : "text-slate-400");
  }

  if (props.selected) classes.push("bg-blue-100 ring-2 ring-inset ring-blue-600");
  else if (props.conflict) classes.push("bg-red-100");
  else if (props.wrong) classes.push("bg-amber-100");
  else if (props.sameNumber) classes.push("bg-blue-50");
  else if (props.peer) classes.push("bg-slate-100");
  else classes.push("bg-white");

  return classes.join(" ");
}

export function Cell(props: CellProps) {
  const { index, digit, notes, given, selected, conflict, wrong } = props;

  return (
    <div
      role="gridcell"
      aria-label={cellAriaLabel({ index, digit, notes, given, conflict, wrong })}
      aria-selected={selected}
      aria-readonly={given}
      tabIndex={props.tabStop ? 0 : -1}
      data-index={index}
      ref={(element) => props.registerRef(index, element)}
      onClick={() => props.onSelect(index)}
      className={cellClasses(props)}
    >
      {digit > 0 ? (
        <span className="text-[clamp(1rem,4vw,1.75rem)] leading-none">{digit}</span>
      ) : notes.length > 0 ? (
        <span className="grid h-full w-full grid-cols-3 grid-rows-3 text-[clamp(0.5rem,1.6vw,0.75rem)] leading-none">
          {Array.from({ length: 9 }, (_, i) => {
            const noteDigit = i + 1;
            return (
              <span key={noteDigit} className="flex items-center justify-center">
                {notes.includes(noteDigit) ? noteDigit : ""}
              </span>
            );
          })}
        </span>
      ) : null}

      {/* 冲突不只靠底色：右下角加一个可见符号 */}
      {conflict ? (
        <span aria-hidden="true" className="absolute bottom-0 right-0 text-[8px] text-red-700">
          !
        </span>
      ) : null}
    </div>
  );
}
