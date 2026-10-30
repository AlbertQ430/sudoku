/**
 * 性能基准（SRS 9.2 / AC-13）。
 *
 * 只测引擎层——浏览器侧的首屏、内存、交互延迟需要 Lighthouse / DevTools，
 * 那部分给出操作清单，由人在真机上跑。
 *
 * 题库化（V1.4）之后，「生成」不再是运行时行为，改测：
 * - 题库加载（JSON 解析）
 * - 取题校验（唯一解复核）
 * - 求解、评级
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { countSolutions } from "../src/engine/counter";
import { ratePuzzle } from "../src/engine/rater";
import { solvePuzzle } from "../src/engine/solver";
import type { Difficulty } from "../src/engine/types";

const DIFFICULTIES: readonly Difficulty[] = ["beginner", "easy", "medium", "hard", "expert"];

interface PoolItem {
  readonly givens: string;
  readonly solution: string;
  readonly clues: number;
}

interface PoolFile {
  readonly puzzles: readonly PoolItem[];
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function load(difficulty: Difficulty): { file: PoolFile; ms: number; bytes: number } {
  const path = join(process.cwd(), "src", "engine", "fixtures", `pool-${difficulty}.json`);
  const text = readFileSync(path, "utf8");
  const started = performance.now();
  const file = JSON.parse(text) as PoolFile;
  return { file, ms: performance.now() - started, bytes: Buffer.byteLength(text) };
}

function main(): void {
  const rows: string[] = [];

  for (const difficulty of DIFFICULTIES) {
    const { file, ms: parseMs, bytes } = load(difficulty);
    const puzzles = file.puzzles;
    if (puzzles.length === 0) continue;

    // 取题校验：就是运行期 pickPuzzle 做的事
    const verifyTimes: number[] = [];
    for (let i = 0; i < 60; i++) {
      const item = puzzles[i % puzzles.length]!;
      const started = performance.now();
      countSolutions(item.givens, { limit: 2, deadlineMs: 1_000 });
      verifyTimes.push(performance.now() - started);
    }

    // 求解
    const solveTimes: number[] = [];
    for (let i = 0; i < 30; i++) {
      const item = puzzles[(i * 7) % puzzles.length]!;
      const started = performance.now();
      solvePuzzle(item.givens);
      solveTimes.push(performance.now() - started);
    }

    // 评级
    const rateTimes: number[] = [];
    for (let i = 0; i < 20; i++) {
      const item = puzzles[(i * 11) % puzzles.length]!;
      const started = performance.now();
      ratePuzzle(item.givens);
      rateTimes.push(performance.now() - started);
    }

    const clues = puzzles.map((item) => item.clues);
    const avgClues = round(clues.reduce((a, b) => a + b, 0) / clues.length);

    rows.push(
      `| ${difficulty} | ${puzzles.length} | ${avgClues} | ${round(bytes / 1024)} KB | ${round(parseMs)} | ` +
        `${round(percentile(verifyTimes, 50))} | ${round(percentile(verifyTimes, 95))} | ` +
        `${round(percentile(solveTimes, 50))} | ${round(percentile(solveTimes, 95))} | ` +
        `${round(percentile(rateTimes, 95))} |`,
    );
  }

  const memory = process.memoryUsage();
  console.warn("| 难度 | 题数 | 平均提示 | 题库大小 | JSON 解析 | 取题校验 P50 | 取题校验 P95 | 求解 P50 | 求解 P95 | 评级 P95 |");
  console.warn("|---|---|---|---|---|---|---|---|---|---|");
  for (const row of rows) console.warn(row);
  console.warn(`| 内存 | | | | | | | | | RSS ${round(memory.rss / 1024 / 1024)} MB |`);
}

main();
