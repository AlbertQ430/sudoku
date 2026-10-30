import type { GeneratedPuzzle } from "../engine/generator";
import type { Puzzle } from "./types";

/** 把生成结果转成可入库的题目实体（SRS 6.2.1）。 */
export function puzzleFromGenerated(generated: GeneratedPuzzle, id: string, now: string): Puzzle {
  return {
    id,
    canonicalKey: generated.givens,
    givens: generated.givens,
    solution: generated.solution,
    difficulty: generated.difficulty,
    ratingVersion: generated.ratingVersion,
    source: "generated",
    symmetry: generated.symmetry,
    seed: generated.seed,
    title: "",
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}
