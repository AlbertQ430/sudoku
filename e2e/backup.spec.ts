import { expect, test } from "@playwright/test";
import { fillCell, findEmptyCell, startBeginnerGame, waitForSessionSaved } from "./helpers";

test.describe("备份导出导入（AC-11）", () => {
  test("导出的文件名符合规范，并能重新导入", async ({ page }) => {
    // 先制造一条对局数据（自动保存）
    await startBeginnerGame(page);
    const empty = await findEmptyCell(page);
    await fillCell(page, empty, 4);
    await waitForSessionSaved(page);

    await page.goto("/settings");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出备份" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^sudoku-backup-\d{8}-\d{4}\.json$/);

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    if (filePath === null) return;

    await page.locator('input[type="file"]').setInputFiles(filePath);
    await expect(page.getByText(/将导入 \d+ 道题/)).toBeVisible();

    await page.getByRole("button", { name: "合并导入" }).click();
    await expect(page.getByRole("status")).toContainText("已合并", { timeout: 15_000 });
  });

  test("损坏的文件被拒绝且不写入", async ({ page }) => {
    await page.goto("/settings");

    await page.locator('input[type="file"]').setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{ this is not json"),
    });

    await expect(page.getByRole("alert")).toContainText("JSON");
    await expect(page.getByText(/将导入/)).toHaveCount(0);
  });

  test("非本应用的备份被拒绝", async ({ page }) => {
    await page.goto("/settings");

    await page.locator('input[type="file"]').setInputFiles({
      name: "other.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ format: "something-else", version: 1 })),
    });

    await expect(page.getByRole("alert")).toContainText("不是本应用导出的备份");
  });
});
