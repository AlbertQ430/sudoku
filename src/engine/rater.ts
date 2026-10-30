/**
 * 难度评级：把 sudoku-core 的技巧体系映射到 SRS 3.5 的五档。
 *
 * 为什么不直接用 sudoku-core 的 L1–L10：
 * - 它的分档与本产品的五档不是一一对应（例：Y-Wing 在它那里是 L8，
 *   SRS 把 XY-Wing 放在「中等」）；
 * - 一旦把 L 档写进数据模型，将来调整评级就会污染已收藏题目。
 *
 * 因此这里维护一张显式的 TACTIC_ID → 五档映射表，并带 `ratingVersion`。
 * 改动映射表或判定逻辑必须递增版本号（SRS 3.5 第 2 条）。
 */

import { analyze, TACTICS } from "sudoku-core";
import type { Difficulty, Grid81 } from "./types";
import { cluesOf } from "./parser";

/** 评级规则版本；任何影响结果的改动都要递增。 */
export const RATING_VERSION = "1.0.0";

export const DIFFICULTY_ORDER: readonly Difficulty[] = ["beginner", "easy", "medium", "hard", "expert"];

/**
 * 技巧 → 五档（对应 SRS 3.5 的表）。
 *
 * 分档依据是「引入该技巧时玩家需要跨过的那道坎」，不是实现难度：
 * - 入门：单位内唯一候选；
 * - 简单：区块排除与数对；
 * - 中等：三数集、X-Wing、XY-Wing；
 * - 困难：唯一矩形、剑鱼、简单链、翼类；
 * - 专家：更长的链、鱼、强制链与试错。
 */
const TACTIC_TIER: Readonly<Record<string, Difficulty>> = {
  "open-singles": "beginner",
  "naked-single": "beginner",
  "hidden-single": "beginner",

  "pointing-elimination": "easy",
  "naked-pair": "easy",
  "hidden-pair": "easy",

  "naked-triple": "medium",
  "hidden-triple": "medium",
  "naked-quad": "medium",
  "hidden-quad": "medium",
  "hidden-groups": "medium",
  "x-wing": "medium",
  "y-wing": "medium",

  swordfish: "hard",
  "unique-rectangle": "hard",
  skyscraper: "hard",
  "two-string-kite": "hard",
  crane: "hard",
  "x-chain": "hard",
  "simple-colouring": "hard",
  "empty-rectangle": "hard",
  "w-wing": "hard",
  "xyz-wing": "hard",
  "wxyz-wing": "hard",
  "finned-x-wing": "hard",

  jellyfish: "expert",
  "finned-swordfish": "expert",
  "finned-jellyfish": "expert",
  "bug-plus-one": "expert",
  "xy-chain": "expert",
  "3d-medusa": "expert",
  aic: "expert",
  nishio: "expert",
};

export interface UsedTechnique {
  readonly id: string;
  readonly title: string;
  readonly count: number;
}

export interface Rating {
  readonly difficulty: Difficulty;
  readonly ratingVersion: string;
  /** 决定档位的那个技巧的 id；题目已完成或无技巧时为 null。 */
  readonly hardestTactic: string | null;
  readonly usedTechniques: readonly UsedTechnique[];
  readonly clues: number;
  /** 解是否唯一（来自 sudoku-core 的唯一性校验，与自研计数器互为交叉验证）。 */
  readonly hasUniqueSolution: boolean;
  /** 人类逻辑解不出来、只能靠试错时的标记（SRS 3.5 第 4 条）。 */
  readonly requiresGuessing: boolean;
}

/** 81 位字符串转 sudoku-core 需要的 `(number | null)[]`。 */
function toBoard(givens: Grid81): Array<number | null> | null {
  if (givens.length !== 81) return null;
  const board: Array<number | null> = [];
  for (let i = 0; i < 81; i++) {
    const ch = givens.charAt(i);
    if (ch === "0") {
      board.push(null);
    } else if (ch >= "1" && ch <= "9") {
      board.push(ch.charCodeAt(0) - 48);
    } else {
      return null;
    }
  }
  return board;
}

/**
 * 评级一道题。
 *
 * @returns 无解或输入非法时返回 `null`；评级失败不抛异常。
 */
export function ratePuzzle(givens: Grid81): Rating | null {
  const board = toBoard(givens);
  if (board === null) return null;

  const analysis = analyze(board);
  if (!analysis.hasSolution) return null;

  const used = analysis.usedStrategies ?? [];
  const usedTechniques: UsedTechnique[] = [];
  let bestTier = -1;
  let hardestTactic: string | null = null;

  for (const { title, freq } of used) {
    const tactic = TACTICS.find((candidate) => candidate.title === title);
    const id = tactic?.id ?? title;
    // 未知技巧按最难处理，宁可高估也不漏判
    const tier = TACTIC_TIER[id] ?? "expert";
    const tierIndex = DIFFICULTY_ORDER.indexOf(tier);

    usedTechniques.push({ id, title, count: freq });

    if (tierIndex > bestTier) {
      bestTier = tierIndex;
      hardestTactic = id;
    }
  }

  // 逻辑解不出来：按专家处理，并标记需要试错
  const requiresGuessing = analysis.usedStrategies === undefined;
  const difficulty = requiresGuessing
    ? "expert"
    : (DIFFICULTY_ORDER[Math.max(bestTier, 0)] ?? "beginner");

  return {
    difficulty,
    ratingVersion: RATING_VERSION,
    hardestTactic: requiresGuessing ? null : hardestTactic,
    usedTechniques,
    clues: cluesOf(givens),
    hasUniqueSolution: analysis.hasUniqueSolution === true,
    requiresGuessing,
  };
}
