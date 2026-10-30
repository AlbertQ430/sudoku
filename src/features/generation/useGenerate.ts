import { useCallback, useState } from "react";
import type { GeneratedPuzzle } from "../../engine/generator";
import { pickPuzzle } from "../../engine/pool";
import type { Difficulty } from "../../engine/types";

export interface UseGenerateResult {
  readonly busy: boolean;
  readonly error: string | null;
  readonly generate: (difficulty: Difficulty) => Promise<GeneratedPuzzle | null>;
}

/**
 * 取题（SRS V1.4 / D11）。
 *
 * 运行时不再挖空生成：从构建期题库里取一道，`pickPuzzle` 内部会用计数器复核唯一解。
 * 题库按难度分包，首次点某个难度时才加载那一份（约 40 KB）。
 */
export function useGenerate(): UseGenerateResult {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (difficulty: Difficulty): Promise<GeneratedPuzzle | null> => {
    setBusy(true);
    setError(null);

    try {
      const puzzle = await pickPuzzle(difficulty);
      if (puzzle === null) {
        setError("题库暂时取不到这个难度，请重试");
        return null;
      }
      return puzzle;
    } catch {
      setError("读取题库失败，请刷新后重试");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, generate };
}
