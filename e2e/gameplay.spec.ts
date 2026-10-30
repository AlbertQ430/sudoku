import { expect, test } from "@playwright/test";
import {
  cell,
  fillAllEmpty,
  findEmptyCell,
  findGivenCell,
  fillCell,
  readSolution,
  startBeginnerGame,
  waitForSessionSaved,
} from "./helpers";

test.describe("生成与开局（AC-01）", () => {
  test("从首页选难度能生成一局并进入棋盘", async ({ page }) => {
    await startBeginnerGame(page);
    await expect(page.getByRole("grid")).toHaveAttribute("aria-label", "数独棋盘");
  });

  test("状态栏显示剩余格数，落子后开始计时", async ({ page }) => {
    await startBeginnerGame(page);

    const empty = await findEmptyCell(page);
    await fillCell(page, empty, 1);

    await expect(page.getByText(/还差 \d+ 格/)).toBeVisible();
    await expect(page.getByLabel("用时")).toBeVisible();
  });

  test("生成期间显示进度和取消入口的时间窗内不会卡死", async ({ page }) => {
    await page.goto("/");

    const button = page.getByRole("button", { name: /中等/ });
    await button.click();

    // 生成可能很快，进度条不保证出现；这里只验证最终一定会进入棋盘
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("棋盘基础操作（AC-02）", () => {
  test("填数后格子读出「用户填写」", async ({ page }) => {
    await startBeginnerGame(page);

    const empty = await findEmptyCell(page);
    await fillCell(page, empty, 5);

    await expect(cell(page, empty)).toHaveAttribute("aria-label", /用户填写5/);
  });

  test("给定数不可修改", async ({ page }) => {
    await startBeginnerGame(page);

    const givenIndex = await findGivenCell(page);
    const first = cell(page, givenIndex);
    const label = await first.getAttribute("aria-label");
    expect(label).toContain("给定数");

    const given = label?.match(/给定数(\d)/)?.[1] ?? "1";
    await first.click();
    await page.keyboard.press(given === "9" ? "1" : "9");

    await expect(first).toHaveAttribute("aria-label", label ?? "");
  });

  test("撤销与重做", async ({ page }) => {
    await startBeginnerGame(page);

    const empty = await findEmptyCell(page);
    await fillCell(page, empty, 4);
    await expect(cell(page, empty)).toHaveAttribute("aria-label", /用户填写4/);

    await page.getByRole("button", { name: "撤销" }).click();
    await expect(cell(page, empty)).toHaveAttribute("aria-label", /空白/);

    await page.getByRole("button", { name: "重做" }).click();
    await expect(cell(page, empty)).toHaveAttribute("aria-label", /用户填写4/);
  });

  test("候选数模式切换", async ({ page }) => {
    await startBeginnerGame(page);

    const empty = await findEmptyCell(page);
    await cell(page, empty).click();
    await page.keyboard.press("n");
    await page.keyboard.press("3");

    await expect(cell(page, empty)).toHaveAttribute("aria-label", /候选数3/);
  });

  test("方向键移动焦点", async ({ page }) => {
    await startBeginnerGame(page);

    await cell(page, 0).click();
    await page.keyboard.press("ArrowRight");

    await expect(cell(page, 1)).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("进度恢复（AC-09）", () => {
  test("刷新后恢复棋盘与进度", async ({ page }) => {
    await startBeginnerGame(page);

    const empty = await findEmptyCell(page);
    await fillCell(page, empty, 7);
    const before = await cell(page, empty).getAttribute("aria-label");

    // 轮询到 session 真正落库，再刷新
    await waitForSessionSaved(page);

    await page.reload();

    await expect(page.getByRole("grid")).toBeVisible({ timeout: 20_000 });
    await expect(cell(page, empty)).toHaveAttribute("aria-label", before ?? "");
  });

  test("首页显示继续对局入口", async ({ page }) => {
    await startBeginnerGame(page);
    const empty = await findEmptyCell(page);
    await fillCell(page, empty, 3);
    await waitForSessionSaved(page);

    await page.goto("/");
    await expect(page.getByRole("button", { name: /继续上一局/ })).toBeVisible();
  });
});

test.describe("完成判定（AC-04）", () => {
  test("填满且全对时自动完成", async ({ page }) => {
    await startBeginnerGame(page);
    const filled = await fillAllEmpty(page);
    expect(filled).toBeGreaterThan(0);

    await expect(page.getByRole("heading", { name: "完成" })).toBeVisible({ timeout: 15_000 });
  });

  test("填满但有错时不判完成并标出错误格", async ({ page }) => {
    await startBeginnerGame(page);

    const empty = await findEmptyCell(page);
    const solution = await readSolution(page);
    const answer = Number(solution.charAt(empty));
    const wrong = answer === 9 ? 1 : answer + 1;

    await fillCell(page, empty, wrong);
    await fillAllEmpty(page);

    await expect(cell(page, empty)).toHaveAttribute("aria-label", /与答案不一致/);
    await expect(page.getByRole("heading", { name: "完成" })).toHaveCount(0);
  });
});

test.describe("五档生成（AC-01）", () => {
  for (const label of ["入门", "简单", "中等", "困难", "专家"]) {
    test(`生成${label}题并进入棋盘`, async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: new RegExp(`^${label}`) }).click();

      await expect(page.getByRole("grid")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    });
  }
});

test.describe("冲突提示（AC-03）", () => {
  test("同行重复会被标记为冲突", async ({ page }) => {
    await startBeginnerGame(page);

    const labels = await page.getByRole("gridcell").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label") ?? ""),
    );

    // 不假设第 0 行有空——入门题库里 60 个提示数的题，某行可能只剩一个空格。
    // 任意找一行至少有 2 个空格的。
    let first = -1;
    let second = -1;
    let digit = "1";

    for (let row = 0; row < 9 && first < 0; row++) {
      const empties: number[] = [];
      const used = new Set<string>();

      for (let col = 0; col < 9; col++) {
        const label = labels[row * 9 + col] ?? "";
        if (label.includes("空白")) empties.push(row * 9 + col);
        const given = label.match(/给定数(\d)/)?.[1];
        if (given !== undefined) used.add(given);
      }

      if (empties.length < 2) continue;

      const candidate = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].find((d) => !used.has(d));
      if (candidate === undefined) continue;

      first = empties[0] ?? -1;
      second = empties[1] ?? -1;
      digit = candidate;
    }

    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThanOrEqual(0);

    await fillCell(page, first, Number(digit));
    await fillCell(page, second, Number(digit));

    await expect(cell(page, second)).toHaveAttribute("aria-label", /冲突/);
  });
});
