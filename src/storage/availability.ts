/**
 * IndexedDB 可用性探测与降级（SRS 5.4：禁用 IndexedDB 时允许临时游玩但不承诺持久化）。
 */

import Dexie from "dexie";
import { SudokuDB } from "./db";

/** 探测能否真正打开并写入一个临时库；只看 `typeof indexedDB` 不够（隐私模式下会抛错）。 */
export async function isIndexedDbAvailable(): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;

  const name = `__sudoku_probe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const probe = new SudokuDB(name);

  try {
    await probe.open();
    // 真正写一次，确认不是只读或配额为 0
    await probe.meta.put({ key: "probe", value: true });
    return true;
  } catch {
    return false;
  } finally {
    probe.close();
    await Dexie.delete(name).catch(() => undefined);
  }
}

export type StorageMode = "persistent" | "memory";

export interface StorageStatus {
  readonly mode: StorageMode;
  readonly reason?: string;
}

export async function detectStorage(): Promise<StorageStatus> {
  const available = await isIndexedDbAvailable();
  return available ? { mode: "persistent" } : { mode: "memory", reason: "IndexedDB 不可用" };
}
