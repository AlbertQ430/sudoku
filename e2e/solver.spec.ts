import { expect, test } from "@playwright/test";
import { CLASSIC, startAndMove } from "./helpers";

test.describe("求解当前题（AC-05）", () => {
  test("求解后展示完整答案，状态为机器求解", async ({ page }) => {
    await startAndMove(page);

    await page.getByRole("button", { name: "求解本题" }).click();

    await expect(page.getByRole("heading", { name: "已显示答案" })).toBeVisible();
    await expect(page.getByText(/机器求解不计入完成率与最佳时间/)).toBeVisible();

    // 棋盘应被填满：不再有「空白」格
    const labels = await page.getByRole("gridcell").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label") ?? ""),
    );
    expect(labels.some((label) => label.includes("空白"))).toBe(false);
  });

  test("求解后不能继续编辑", async ({ page }) => {
    await startAndMove(page);

    await page.getByRole("button", { name: "求解本题" }).click();
    await expect(page.getByRole("heading", { name: "已显示答案" })).toBeVisible();

    const before = await page.getByRole("gridcell").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label")),
    );

    await page.getByRole("gridcell").nth(0).click();
    await page.keyboard.press("1");

    const after = await page.getByRole("gridcell").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label")),
    );
    expect(after).toEqual(before);
  });

  test("重置本题回到空白棋盘", async ({ page }) => {
    await startAndMove(page);
    await page.getByRole("button", { name: "求解本题" }).click();
    await expect(page.getByRole("heading", { name: "已显示答案" })).toBeVisible();

    await page.getByRole("button", { name: "重置本题" }).click();

    await expect(page.getByRole("heading", { name: "已显示答案" })).toHaveCount(0);
    const labels = await page.getByRole("gridcell").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label") ?? ""),
    );
    expect(labels.some((label) => label.includes("空白"))).toBe(true);
  });
});

test.describe("独立求解器（AC-06）", () => {
  test("唯一解题返回唯一解和答案盘", async ({ page }) => {
    await page.goto("/solver");

    await page.getByLabel("题目输入").fill(CLASSIC);
    await page.getByRole("button", { name: "求解" }).click();

    await expect(page.getByText(/唯一解/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("img", { name: "求解结果" })).toBeVisible();
  });

  test("冲突题目提示具体格位", async ({ page }) => {
    await page.goto("/solver");

    const conflicting = "0".repeat(81).split("");
    conflicting[0] = "5";
    conflicting[5] = "5";

    await page.getByLabel("题目输入").fill(conflicting.join(""));
    await page.getByRole("button", { name: "求解" }).click();

    await expect(page.getByRole("alert")).toContainText("冲突");
  });

  test("长度不对时提示", async ({ page }) => {
    await page.goto("/solver");

    await page.getByLabel("题目输入").fill("123");
    await page.getByRole("button", { name: "求解" }).click();

    await expect(page.getByRole("alert")).toContainText("81");
  });
});
