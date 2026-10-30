import { expect, test } from "@playwright/test";
import { fillAllEmpty, startBeginnerGame } from "./helpers";

test.describe("收藏（AC-08）", () => {
  test("完成一局后收藏，能在列表打开并撤销删除", async ({ page }) => {
    await startBeginnerGame(page);
    await fillAllEmpty(page);

    await expect(page.getByRole("heading", { name: "完成" })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "收藏本题" }).click();
    await expect(page.getByRole("button", { name: "已收藏" })).toBeDisabled();

    await page.goto("/favorites");
    await expect(page.getByRole("listitem")).toHaveCount(1);

    // 从列表重新打开
    await page.getByRole("listitem").first().getByRole("button").first().click();
    await expect(page.getByRole("grid")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("gridcell")).toHaveCount(81);

    // 回到列表删除并撤销
    await page.goto("/favorites");
    await page.getByRole("button", { name: /删除收藏/ }).click();
    await expect(page.getByRole("listitem")).toHaveCount(0);

    await page.getByRole("button", { name: "撤销" }).click();
    await expect(page.getByRole("listitem")).toHaveCount(1);
  });
});
