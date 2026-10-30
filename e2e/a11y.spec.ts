import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fillCell, findEmptyCell, startBeginnerGame } from "./helpers";

const TAGS = ["wcag2a", "wcag2aa"];

async function scan(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  const detail = blocking
    .map((violation) => `${violation.id}（${violation.impact}）${violation.help}\n  影响 ${violation.nodes.length} 处`)
    .join("\n");

  expect(blocking, `${label} 存在 serious/critical 级无障碍问题：\n${detail}`).toEqual([]);
}

test.describe("无障碍扫描（AC-12）", () => {
  test("首页", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "数独" })).toBeVisible();
    await scan(page, "首页");
  });

  test("对局页", async ({ page }) => {
    await startBeginnerGame(page);

    const empty = await findEmptyCell(page);
    await fillCell(page, empty, 1);
    await expect(page.getByRole("grid")).toBeVisible();

    await scan(page, "对局页");
  });

  test("自定义题目页", async ({ page }) => {
    await page.goto("/custom");
    await expect(page.getByRole("heading", { name: "自定义题目" })).toBeVisible();
    await scan(page, "自定义题目页");
  });

  test("独立求解器页", async ({ page }) => {
    await page.goto("/solver");
    await expect(page.getByRole("heading", { name: "独立求解器" })).toBeVisible();
    await scan(page, "独立求解器页");
  });

  test("收藏页", async ({ page }) => {
    await page.goto("/favorites");
    await expect(page.getByRole("heading", { name: "收藏" })).toBeVisible();
    await scan(page, "收藏页");
  });

  test("设置页", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
    await scan(page, "设置页");
  });

  test("统计页", async ({ page }) => {
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "统计" })).toBeVisible();
    await scan(page, "统计页");
  });

  test("关于页", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "关于" })).toBeVisible();
    await scan(page, "关于页");
  });

  test("深色模式下的首页与对局页", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("主题").selectOption("dark");
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "数独" })).toBeVisible();
    await scan(page, "深色首页");

    await page.getByRole("button", { name: /入门/ }).click();
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 30_000 });
    await scan(page, "深色对局页");
  });
});
