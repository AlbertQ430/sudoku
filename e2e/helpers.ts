import { expect, type Page } from "@playwright/test";

/** 从首页开始一局入门题，等到棋盘出现。 */
export async function startBeginnerGame(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /入门/ }).click();
  await expect(page.getByRole("grid")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("gridcell")).toHaveCount(81);
}

/** 开始一局并落一子，让状态从 ready 进入 playing。 */
export async function startAndMove(page: Page): Promise<number> {
  await startBeginnerGame(page);
  const empty = await findEmptyCell(page);
  await fillCell(page, empty, 1);
  return empty;
}

export function cell(page: Page, index: number) {
  return page.getByRole("gridcell").nth(index);
}

/** 选中某格并按键填数。 */
export async function fillCell(page: Page, index: number, digit: number): Promise<void> {
  await cell(page, index).click();
  await page.keyboard.press(String(digit));
}

async function labels(page: Page): Promise<string[]> {
  return page
    .getByRole("gridcell")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-label") ?? ""));
}

/** 找一个空格索引（aria-label 里带「空白」）。 */
export async function findEmptyCell(page: Page): Promise<number> {
  const all = await labels(page);
  const index = all.findIndex((label) => label.includes("空白"));
  if (index < 0) throw new Error("棋盘上没有空格");
  return index;
}

/** 找一个给定数格索引。 */
export async function findGivenCell(page: Page): Promise<number> {
  const all = await labels(page);
  const index = all.findIndex((label) => label.includes("给定数"));
  if (index < 0) throw new Error("棋盘上没有给定数");
  return index;
}

/** 从 IndexedDB 读当前题目的解（每个测试上下文只有一题）。 */
export async function readSolution(page: Page): Promise<string> {
  const solution = await page.evaluate(
    () =>
      new Promise<string | null>((resolve) => {
        const request = indexedDB.open("sudoku");
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("puzzles")) {
            resolve(null);
            return;
          }
          const all = db.transaction("puzzles", "readonly").objectStore("puzzles").getAll();
          all.onsuccess = () => {
            const rows = all.result as Array<{ solution?: string }>;
            resolve(rows.at(-1)?.solution ?? null);
          };
          all.onerror = () => resolve(null);
        };
      }),
  );

  if (solution === null) throw new Error("读不到题目解");
  return solution;
}

/** 把所有空格填成正确答案，用来触发「填满自动完成」。 */
export async function fillAllEmpty(page: Page, transform?: (digit: number) => number): Promise<number> {
  const solution = await readSolution(page);
  const all = await labels(page);

  let filled = 0;
  for (let index = 0; index < 81; index++) {
    if (!(all[index] ?? "").includes("空白")) continue;

    const answer = Number(solution.charAt(index));
    await fillCell(page, index, transform ? transform(answer) : answer);
    filled += 1;
  }
  return filled;
}

/** 经典题，唯一解。 */
export const CLASSIC =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";

/** 等自动保存真正写入 IndexedDB（固定 waitForTimeout 在慢机器上不可靠）。 */
export async function waitForSessionSaved(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              const request = indexedDB.open("sudoku");
              request.onerror = () => resolve(-1);
              request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains("sessions")) {
                  resolve(0);
                  return;
                }
                const count = db.transaction("sessions", "readonly").objectStore("sessions").count();
                count.onsuccess = () => resolve(count.result);
                count.onerror = () => resolve(-1);
              };
            }),
        ),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
}
