import { expect, test } from "@playwright/test";
import { CLASSIC } from "./helpers";

test.describe("自定义题目（AC-07）", () => {
  test("唯一解题通过五步校验后可以开始", async ({ page }) => {
    await page.goto("/custom");

    await page.getByLabel("题目输入").fill(CLASSIC);
    await page.getByRole("button", { name: "校验题目" }).click();

    await expect(page.getByRole("button", { name: "开始游戏" })).toBeEnabled({ timeout: 20_000 });
  });

  test("提示数不足会卡在第三步", async ({ page }) => {
    await page.goto("/custom");

    await page.getByLabel("题目输入").fill("0".repeat(81));
    await page.getByRole("button", { name: "校验题目" }).click();

    await expect(page.getByText(/当前只有 0 个提示数/)).toBeVisible();
    await expect(page.getByRole("button", { name: "开始游戏" })).toBeDisabled();
  });

  test("冲突题目会定位到格位", async ({ page }) => {
    await page.goto("/custom");

    const cells = CLASSIC.split("");
    cells[1] = "5"; // 与 R1C1 的 5 冲突

    await page.getByLabel("题目输入").fill(cells.join(""));
    await page.getByRole("button", { name: "校验题目" }).click();

    await expect(page.getByText(/存在冲突/)).toBeVisible();
    await expect(page.getByRole("button", { name: "开始游戏" })).toBeDisabled();
  });

  test("逐格录入模式可以输入数字", async ({ page }) => {
    await page.goto("/custom");

    await page.getByRole("tab", { name: "逐格录入" }).click();
    await expect(page.getByRole("gridcell")).toHaveCount(81);

    await page.getByRole("gridcell").nth(0).click();
    await page.keyboard.press("7");

    await expect(page.getByRole("gridcell").nth(0)).toHaveAttribute("aria-label", /用户填写7/);
    await expect(page.getByText(/当前提示数：1/)).toBeVisible();
  });

  test("从 .txt 文件导入题目并通过校验", async ({ page }) => {
    await page.goto("/custom");

    await page.locator('input[type="file"]').setInputFiles({
      name: "puzzle.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(`${CLASSIC}\n`),
    });

    await expect(page.getByLabel("题目输入")).toHaveValue(CLASSIC);
    await page.getByRole("button", { name: "校验题目" }).click();
    await expect(page.getByRole("button", { name: "开始游戏" })).toBeEnabled({ timeout: 20_000 });
  });

  test("从 .json 文件导入题目", async ({ page }) => {
    await page.goto("/custom");

    await page.locator('input[type="file"]').setInputFiles({
      name: "puzzle.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ puzzles: [{ givens: CLASSIC }] })),
    });

    await expect(page.getByLabel("题目输入")).toHaveValue(CLASSIC);
  });

  test("无法识别的文件给出提示", async ({ page }) => {
    await page.goto("/custom");

    await page.locator('input[type="file"]').setInputFiles({
      name: "bad.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("这不是一道题"),
    });

    await expect(page.getByRole("alert")).toContainText("81 位");
  });
});
