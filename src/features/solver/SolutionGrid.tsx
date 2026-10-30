/** 只读的解题结果展示：给定数加粗，求解填出的数字用蓝色。 */

export interface SolutionGridProps {
  readonly solution: string;
  readonly givens: string;
}

export function SolutionGrid(props: SolutionGridProps) {
  return (
    <div
      role="img"
      aria-label="求解结果"
      className="grid aspect-square w-full grid-cols-9 gap-px border-2 border-slate-700 bg-slate-700"
    >
      {Array.from({ length: 81 }, (_, index) => {
        const digit = props.solution.charAt(index);
        const given = props.givens.charAt(index) !== "0";
        const row = Math.floor(index / 9);
        const col = index % 9;

        const classes = [
          "flex aspect-square items-center justify-center bg-white text-[clamp(0.9rem,3.5vw,1.5rem)]",
          given ? "font-bold text-slate-900" : "font-normal text-blue-700",
        ];
        if (col === 2 || col === 5) classes.push("border-r-2 border-r-slate-700");
        if (row === 2 || row === 5) classes.push("border-b-2 border-b-slate-700");

        return (
          <div key={index} className={classes.join(" ")}>
            {digit === "0" ? "" : digit}
          </div>
        );
      })}
    </div>
  );
}
