// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BoardGrid } from "./BoardGrid";

const GIVENS = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

function setup(overrides: Partial<Parameters<typeof BoardGrid>[0]> = {}) {
  const props = {
    grid: GIVENS,
    givens: GIVENS,
    notes: Array.from({ length: 81 }, () => 0),
    selected: 0 as number | null,
    notesMode: false,
    onSelect: vi.fn(),
    onPlace: vi.fn(),
    onClear: vi.fn(),
    onToggleNote: vi.fn(),
    onToggleNotesMode: vi.fn(),
    ...overrides,
  };

  const utils = render(<BoardGrid {...props} />);
  return { props, ...utils };
}

function keydown(key: string) {
  fireEvent.keyDown(screen.getByRole("grid"), { key });
}

describe("BoardGrid 渲染", () => {
  it("渲染 81 个格子与 9 行", () => {
    setup();
    expect(screen.getAllByRole("gridcell")).toHaveLength(81);
    expect(screen.getAllByRole("row")).toHaveLength(9);
  });

  it("给定数读出为「给定数」，空格读出为「空白」", () => {
    setup();
    const cells = screen.getAllByRole("gridcell");
    expect(cells[0]).toHaveAccessibleName(/第1行第1列/);
    expect(cells[0]).toHaveAccessibleName(/给定数5/);
    expect(cells[2]).toHaveAccessibleName(/空白/);
  });

  it("用户填写的数字读出「用户填写」", () => {
    const cells = GIVENS.split("");
    cells[2] = "4";
    setup({ grid: cells.join("") });
    expect(screen.getAllByRole("gridcell")[2]).toHaveAccessibleName(/用户填写4/);
  });

  it("候选数被朗读出来", () => {
    const notes = Array.from({ length: 81 }, () => 0);
    notes[2] = (1 << 0) | (1 << 2); // 候选 1、3
    setup({ notes });
    expect(screen.getAllByRole("gridcell")[2]).toHaveAccessibleName(/候选数1、3/);
  });

  it("冲突格在标签里带「冲突」", () => {
    const cells = GIVENS.split("");
    cells[2] = "5"; // 与 R1C1 重复
    setup({ grid: cells.join("") });
    expect(screen.getAllByRole("gridcell")[2]).toHaveAccessibleName(/冲突/);
  });

  it("错误格在标签里带「与答案不一致」", () => {
    const cells = GIVENS.split("");
    cells[2] = "1";
    setup({ grid: cells.join(""), wrongCells: [2] });
    expect(screen.getAllByRole("gridcell")[2]).toHaveAccessibleName(/与答案不一致/);
  });

  it("只有选中格是 tab 停靠点", () => {
    setup({ selected: 5 });
    const cells = screen.getAllByRole("gridcell");
    expect(cells[5]).toHaveAttribute("tabindex", "0");
    expect(cells[0]).toHaveAttribute("tabindex", "-1");
  });
});

describe("BoardGrid 键盘操作", () => {
  it("方向键移动选中格", () => {
    const { props } = setup({ selected: 0 });
    keydown("ArrowRight");
    expect(props.onSelect).toHaveBeenCalledWith(1);

    keydown("ArrowDown");
    expect(props.onSelect).toHaveBeenCalledWith(9);
  });

  it("边界处不会越界", () => {
    const { props } = setup({ selected: 0 });
    keydown("ArrowUp");
    expect(props.onSelect).toHaveBeenCalledWith(0);

    keydown("ArrowLeft");
    expect(props.onSelect).toHaveBeenCalledWith(0);
  });

  it("数字键落子", () => {
    const { props } = setup({ selected: 2 });
    keydown("4");
    expect(props.onPlace).toHaveBeenCalledWith(2, 4);
  });

  it("候选模式下数字键切换候选", () => {
    const { props } = setup({ selected: 2, notesMode: true });
    keydown("7");
    expect(props.onToggleNote).toHaveBeenCalledWith(2, 7);
    expect(props.onPlace).not.toHaveBeenCalled();
  });

  it("退格清除", () => {
    const { props } = setup({ selected: 3 });
    keydown("Backspace");
    expect(props.onClear).toHaveBeenCalledWith(3);
  });

  it("N 切换候选模式，Esc 取消选中", () => {
    const { props } = setup({ selected: 3 });
    keydown("N");
    expect(props.onToggleNotesMode).toHaveBeenCalled();

    keydown("Escape");
    expect(props.onSelect).toHaveBeenCalledWith(null);
  });

  it("未选中时按键作用在第一格", () => {
    const { props } = setup({ selected: null });
    keydown("5");
    expect(props.onPlace).toHaveBeenCalledWith(0, 5);
  });
});

describe("BoardGrid 鼠标操作", () => {
  it("点击格子触发选中", () => {
    const { props } = setup();
    fireEvent.click(screen.getAllByRole("gridcell")[40]!);
    expect(props.onSelect).toHaveBeenCalledWith(40);
  });
});
