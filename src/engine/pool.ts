/**
 * 题库取题（SRS V1.4 / D11）。
 *
 * 运行时不再挖空生成，改为从构建期题库里取一道，并用自研计数器复核唯一解。
 * 复核是必要的：题库文件可能被手工改动，而 FR-GEN-003 要求「交付给玩家的题必须唯一解」。
 *
 * 题库按难度拆成独立 JSON，动态 import 后缓存——首屏不需要任何题库，点难度时才加载
 * （每档约 30–40 KB）。
 */

import { countSolutions } from "./counter";
import type { GeneratedPuzzle } from "./generator";
import { RATING_VERSION } from "./rater";
import type { Difficulty } from "./types";

interface PoolItem {
  readonly givens: string;
  readonly solution: string;
  readonly clues: number;
}

interface PoolFile {
  readonly difficulty: Difficulty;
  readonly ratingVersion: string;
  readonly symmetry: string;
  readonly puzzles: readonly PoolItem[];
}

interface PoolModule {
  readonly default: PoolFile;
}

const LOADERS: Readonly<Record<Difficulty, () => Promise<PoolModule>>> = {
  beginner: () => import("./fixtures/pool-beginner.json") as unknown as Promise<PoolModule>,
  easy: () => import("./fixtures/pool-easy.json") as unknown as Promise<PoolModule>,
  medium: () => import("./fixtures/pool-medium.json") as unknown as Promise<PoolModule>,
  hard: () => import("./fixtures/pool-hard.json") as unknown as Promise<PoolModule>,
  expert: () => import("./fixtures/pool-expert.json") as unknown as Promise<PoolModule>,
};

const cache = new Map<Difficulty, PoolFile>();

/** 取题失败时最多换几道（应对题库里有坏数据的情况）。 */
const MAX_TRIES = 8;
const VERIFY_DEADLINE_MS = 500;

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (const ch of seed) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export async function loadPool(difficulty: Difficulty): Promise<PoolFile> {
  const cached = cache.get(difficulty);
  if (cached !== undefined) return cached;

  const module = await LOADERS[difficulty]();
  cache.set(difficulty, module.default);
  return module.default;
}

export interface PickOptions {
  /** 给定时按种子确定性地选同一道题。 */
  readonly seed?: string;
  /** 本次会话已经出过的题，尽量避开。 */
  readonly exclude?: ReadonlySet<string>;
}

/**
 * 取一道该难度、已通过唯一解复核的题。
 *
 * @returns 题库缺失或全部复核失败时返回 `null`。
 */
export async function pickPuzzle(
  difficulty: Difficulty,
  options: PickOptions = {},
): Promise<GeneratedPuzzle | null> {
  const pool = await loadPool(difficulty);
  const total = pool.puzzles.length;
  if (total === 0) return null;

  const base = options.seed === undefined ? Math.floor(Math.random() * total) : hashSeed(options.seed) % total;

  for (let attempt = 0; attempt < Math.min(MAX_TRIES, total); attempt++) {
    const index = (base + attempt) % total;
    const item = pool.puzzles[index];
    if (item === undefined) continue;
    if (options.exclude?.has(item.givens) === true) continue;

    const check = countSolutions(item.givens, { limit: 2, deadlineMs: VERIFY_DEADLINE_MS });
    if (check.invalid || check.timedOut || check.count !== 1) continue;

    return {
      givens: item.givens,
      solution: item.solution,
      difficulty,
      requestedDifficulty: difficulty,
      ratingVersion: pool.ratingVersion,
      symmetry: "rotational",
      seed: options.seed ?? "-",
      clues: item.clues,
      elapsedMs: 0,
    };
  }

  return null;
}

/** 题库大小，用于首页展示与测试。 */
export async function poolSize(difficulty: Difficulty): Promise<number> {
  return (await loadPool(difficulty)).puzzles.length;
}

export { RATING_VERSION };
