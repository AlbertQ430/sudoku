/**
 * 构建期题库生成（SRS V1.4 / D11）。
 *
 * 用 sudoku-core 的 `generate(L1..L10)` 产出候选，再用本项目的评级器复核难度、
 * 用自研计数器复核唯一解——只有两道校验都通过才收录，所以题库里的题可信。
 *
 * 为什么不用 `engine/generator.ts`：它是为运行时挖空设计的，单次成功率低
 * （简单档约 30%），凑够 200 道要跑上万次 `analyze`。`sudoku-core.generate`
 * 内部已按难度定向搜索，命中率高一个数量级。
 *
 * 用法：
 *   tsx scripts/build-pool.ts --target=easy --count=200 --minutes=5
 *
 * 每运行一次只做一小批（默认 40 道或 5 分钟），反复调用即可补足——
 * 每次都是独立进程，能规避 `analyze` 在长驻进程里的内存累积。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generate, type Difficulty as CoreLevel } from "sudoku-core";
import { countSolutions } from "../src/engine/counter";
import { cluesOf } from "../src/engine/parser";
import { RATING_VERSION, ratePuzzle } from "../src/engine/rater";
import { solvePuzzle } from "../src/engine/solver";
import type { Difficulty } from "../src/engine/types";

// 用 cwd 而不是 import.meta.url：这个脚本会被 Vite SSR 打包到 .tmp 下执行，
// 打包后 import.meta.url 指向 .tmp，会导致题库写到错误目录。
const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "src", "engine", "fixtures");

const DIFFICULTIES: readonly Difficulty[] = ["beginner", "easy", "medium", "hard", "expert"];

/** 每个目标档轮换尝试的 sudoku-core 等级。 */
const LEVELS: Readonly<Record<Difficulty, readonly CoreLevel[]>> = {
  beginner: ["L1", "L2"],
  easy: ["L3", "L4"],
  medium: ["L5", "L6"],
  hard: ["L7", "L8"],
  expert: ["L9", "L10"],
};

interface PoolItem {
  readonly givens: string;
  readonly solution: string;
  readonly clues: number;
}

interface PoolFile {
  readonly difficulty: Difficulty;
  readonly ratingVersion: string;
  readonly symmetry: string;
  puzzles: PoolItem[];
}

function poolPath(difficulty: Difficulty): string {
  return join(OUT_DIR, `pool-${difficulty}.json`);
}

function loadPool(difficulty: Difficulty): PoolFile {
  const path = poolPath(difficulty);
  if (!existsSync(path)) {
    return { difficulty, ratingVersion: RATING_VERSION, symmetry: "rotational", puzzles: [] };
  }
  return JSON.parse(readFileSync(path, "utf8")) as PoolFile;
}

function savePool(file: PoolFile): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(poolPath(file.difficulty), `${JSON.stringify(file)}\n`, "utf8");
}

function boardToString(board: Array<number | null>): string {
  return board.map((value) => (value === null ? "0" : String(value))).join("");
}

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((item) => item.startsWith(`${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 1);
}

function main(): void {
  const difficultyArg = arg("--target", "easy");
  if (!DIFFICULTIES.includes(difficultyArg as Difficulty)) {
    throw new Error(`未知难度：${difficultyArg}（可选 ${DIFFICULTIES.join("/")}）`);
  }
  const difficulty = difficultyArg as Difficulty;

  const count = Number(arg("--count", "40"));
  const budgetMs = Number(arg("--minutes", "5")) * 60_000;

  const pool = loadPool(difficulty);
  const seen = new Set(pool.puzzles.map((item) => item.givens));
  const startedAt = Date.now();

  let attempts = 0;
  let added = 0;

  while (pool.puzzles.length < count && Date.now() - startedAt < budgetMs) {
    const levels = LEVELS[difficulty];
    const level = levels[attempts % levels.length]!;
    attempts += 1;

    const board = generate(level);
    const givens = boardToString(board);
    if (seen.has(givens)) continue;

    // 难度必须由本项目的评级器确认，不能只信 sudoku-core 的等级
    const rating = ratePuzzle(givens);
    if (rating === null || !rating.hasUniqueSolution || rating.difficulty !== difficulty) continue;

    const outcome = solvePuzzle(givens);
    if (outcome.status !== "unique" || outcome.solution === null) continue;

    const check = countSolutions(givens, { limit: 2, deadlineMs: 500 });
    if (check.invalid || check.timedOut || check.count !== 1) continue;

    seen.add(givens);
    added += 1;
    pool.puzzles.push({ givens, solution: outcome.solution, clues: cluesOf(givens) });

    // 每道都落盘：sudoku-core 的 generate 在中等/专家档会偶发崩溃（0xC0000005），
    // 攒批保存会把已经跑出来的题一起丢掉。
    savePool(pool);
    console.warn(`[pool] ${difficulty}: ${pool.puzzles.length}/${count}（尝试 ${attempts} 次）`);
  }

  savePool(pool);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const rate = attempts === 0 ? 0 : (added / attempts) * 100;
  console.warn(
    `[pool] ${difficulty} 完成：${pool.puzzles.length}/${count} 道，本次新增 ${added} 道，` +
      `尝试 ${attempts} 次，命中率 ${rate.toFixed(1)}%，耗时 ${seconds}s`,
  );
}

main();
