/**
 * 生成基准（技术方案第 17 章的 POC）。
 *
 * 注意：V1.4 起运行时不再挖空生成，本基准测的 `generatePuzzle` 现在只服务于
 * `scripts/build-pool.ts`（扩充题库）。它反映的是「题库扩充有多快」，
 * 不再代表用户开局的等待时间——那个路径见 `scripts/perf-report.ts`。
 *
 * 默认跳过，避免拖慢日常测试。跑法（注意内存限制）：
 *   NODE_OPTIONS=--max-old-space-size=4096 BENCH=1 BENCH_RUNS=20 \
 *   BENCH_ONLY=beginner,easy,medium pnpm exec vitest run src/engine/bench.test.ts -t "五档各"
 *
 * 单进程连续生成约 40 次后 Node 会因内存耗尽崩溃（sudoku-core 的 analyze 分配较大），
 * 因此要分 2–3 批跑，每批不超过 60 次生成。
 */

import { describe, it } from "vitest";
import { countSolutions } from "./counter";
import { generatePuzzle } from "./generator";
import type { Difficulty } from "./types";

const ENABLED = process.env.BENCH === "1";
const RUNS = Number(process.env.BENCH_RUNS ?? 30);
const ALL_DIFFICULTIES: readonly Difficulty[] = ["beginner", "easy", "medium", "hard", "expert"];
const ONLY = process.env.BENCH_ONLY;
const DIFFICULTIES: readonly Difficulty[] =
  ONLY === undefined
    ? ALL_DIFFICULTIES
    : ALL_DIFFICULTIES.filter((item) => ONLY.split(",").includes(item));

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

describe.skipIf(!ENABLED)("生成基准", () => {
  it(
    `五档各 ${RUNS} 次`,
    () => {
      const rows: Record<string, string | number>[] = [];

      for (const difficulty of DIFFICULTIES) {
        const times: number[] = [];
        const clues: number[] = [];
        let ok = 0;
        let mismatch = 0;

        for (let i = 0; i < RUNS; i++) {
          const started = performance.now();
          const result = generatePuzzle({ difficulty, seed: `bench-${difficulty}-${i}` });
          times.push(performance.now() - started);

          if (result.ok) {
            ok++;
            clues.push(result.puzzle.clues);
            if (result.puzzle.difficulty !== difficulty) mismatch++;
          }
        }

        const sorted = [...times].sort((a, b) => a - b);
        rows.push({
          难度: difficulty,
          成功率: `${Math.round((ok / RUNS) * 100)}%`,
          p50: `${percentile(sorted, 50).toFixed(0)}ms`,
          p95: `${percentile(sorted, 95).toFixed(0)}ms`,
          p99: `${percentile(sorted, 99).toFixed(0)}ms`,
          max: `${(sorted[sorted.length - 1] ?? 0).toFixed(0)}ms`,
          提示数: clues.length === 0 ? "-" : `${Math.min(...clues)}/${median(clues)}/${Math.max(...clues)}`,
          评级偏差: mismatch,
        });
      }

      console.log("\n=== 生成基准 ===");
      console.table(rows);
    },
    600_000,
  );

  it(
    "解数统计耗时",
    () => {
      const samples: number[] = [];
      let worst = 0;
      let worstClues = 0;

      for (let i = 0; i < RUNS; i++) {
        const generated = generatePuzzle({ difficulty: "expert", seed: `count-bench-${i}` });
        if (!generated.ok) continue;

        const started = performance.now();
        const check = countSolutions(generated.puzzle.givens, { limit: 2 });
        const elapsed = performance.now() - started;

        samples.push(elapsed);
        if (elapsed > worst) {
          worst = elapsed;
          worstClues = generated.puzzle.clues;
        }
        if (check.count !== 1) {
          console.log(`警告：seed=count-bench-${i} 的解数为 ${check.count}`);
        }
      }

      const sorted = [...samples].sort((a, b) => a - b);
      console.log("\n=== 解数统计（专家题） ===");
      console.log(
        `n=${samples.length} p50=${percentile(sorted, 50).toFixed(2)}ms ` +
          `p95=${percentile(sorted, 95).toFixed(2)}ms max=${worst.toFixed(2)}ms（提示数 ${worstClues}）`,
      );

      // 空盘是多解的极端情况：应当立即停在 2 个解
      const started = performance.now();
      countSolutions("0".repeat(81), { limit: 2 });
      console.log(`空盘 count(limit=2) = ${(performance.now() - started).toFixed(2)}ms`);
    },
    600_000,
  );
});
