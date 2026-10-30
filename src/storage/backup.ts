/**
 * 备份导出与导入（SRS 6.5 / FR-DAT-003~006 / AC-11）。
 *
 * 原则：
 * - 只按固定 schema 读取，不执行文件里的任何表达式（NFR-SEC-004）；
 * - 逐条校验，任何一条不合格就整体失败（导入前不写库，导入中走事务）；
 * - 导入使用单个 Dexie 事务，失败自动回滚，不留半份数据（FR-DAT-006）。
 */

import type { SudokuDB } from "./db";
import { SINGLETON_KEY } from "./schema";
import type { Favorite, GameSession, Puzzle, Settings, Stats } from "../domain/types";

export const BACKUP_FORMAT = "sudoku-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const APP_VERSION = "0.0.0";

export interface BackupPayload {
  readonly format: typeof BACKUP_FORMAT;
  readonly version: number;
  readonly exportedAt: string;
  readonly appVersion: string;
  readonly puzzles: readonly Puzzle[];
  readonly favorites: readonly Favorite[];
  readonly sessions: readonly GameSession[];
  readonly settings: Settings | null;
  readonly stats: Stats | null;
}

export interface ImportSummary {
  readonly mode: "merge" | "replace";
  readonly puzzles: number;
  readonly favorites: number;
  readonly sessions: number;
  /** merge 模式下因已有较新记录而跳过的条数。 */
  readonly conflicts: number;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new BackupError(`字段 ${field} 缺失或类型不对`);
  }
  return value;
}

function grid81(value: unknown, field: string): string {
  const result = text(value, field);
  if (result.length !== 81) throw new BackupError(`字段 ${field} 不是 81 位`);
  return result;
}

function numeric(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BackupError(`字段 ${field} 缺失或类型不对`);
  }
  return value;
}

function validatePuzzle(raw: unknown, index: number): Puzzle {
  if (!isRecord(raw)) throw new BackupError(`puzzles[${index}] 不是对象`);
  return {
    id: text(raw.id, `puzzles[${index}].id`),
    canonicalKey: text(raw.canonicalKey, `puzzles[${index}].canonicalKey`),
    givens: grid81(raw.givens, `puzzles[${index}].givens`),
    solution: grid81(raw.solution, `puzzles[${index}].solution`),
    difficulty: text(raw.difficulty, `puzzles[${index}].difficulty`) as Puzzle["difficulty"],
    ratingVersion: text(raw.ratingVersion, `puzzles[${index}].ratingVersion`),
    source: text(raw.source, `puzzles[${index}].source`) as Puzzle["source"],
    symmetry: text(raw.symmetry, `puzzles[${index}].symmetry`) as Puzzle["symmetry"],
    seed: typeof raw.seed === "string" ? raw.seed : null,
    title: typeof raw.title === "string" ? raw.title : "",
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === "string") : [],
    createdAt: text(raw.createdAt, `puzzles[${index}].createdAt`),
    updatedAt: text(raw.updatedAt, `puzzles[${index}].updatedAt`),
  };
}

function validateFavorite(raw: unknown, index: number): Favorite {
  if (!isRecord(raw)) throw new BackupError(`favorites[${index}] 不是对象`);
  const snapshot = raw.puzzleSnapshot;
  if (!isRecord(snapshot)) throw new BackupError(`favorites[${index}].puzzleSnapshot 缺失`);

  return {
    id: text(raw.id, `favorites[${index}].id`),
    puzzleId: text(raw.puzzleId, `favorites[${index}].puzzleId`),
    puzzleSnapshot: {
      givens: grid81(snapshot.givens, `favorites[${index}].puzzleSnapshot.givens`),
      solution: grid81(snapshot.solution, `favorites[${index}].puzzleSnapshot.solution`),
      difficulty: text(snapshot.difficulty, `favorites[${index}].puzzleSnapshot.difficulty`) as Puzzle["difficulty"],
      ratingVersion: text(snapshot.ratingVersion, `favorites[${index}].puzzleSnapshot.ratingVersion`),
    },
    title: typeof raw.title === "string" ? raw.title : "",
    note: typeof raw.note === "string" ? raw.note : "",
    tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === "string") : [],
    createdAt: text(raw.createdAt, `favorites[${index}].createdAt`),
    lastOpenedAt: typeof raw.lastOpenedAt === "string" ? raw.lastOpenedAt : null,
    bestTimeMs: typeof raw.bestTimeMs === "number" ? raw.bestTimeMs : null,
    lastSessionId: typeof raw.lastSessionId === "string" ? raw.lastSessionId : null,
  };
}

function validateSession(raw: unknown, index: number): GameSession {
  if (!isRecord(raw)) throw new BackupError(`sessions[${index}] 不是对象`);
  const snapshot = raw.puzzleSnapshot;
  if (!isRecord(snapshot)) throw new BackupError(`sessions[${index}].puzzleSnapshot 缺失`);

  const notes = raw.notes;
  if (!Array.isArray(notes) || notes.length !== 81) {
    throw new BackupError(`sessions[${index}].notes 必须是 81 个数字`);
  }

  return {
    id: text(raw.id, `sessions[${index}].id`),
    puzzleId: text(raw.puzzleId, `sessions[${index}].puzzleId`),
    puzzleSnapshot: {
      givens: grid81(snapshot.givens, `sessions[${index}].puzzleSnapshot.givens`),
      solution: grid81(snapshot.solution, `sessions[${index}].puzzleSnapshot.solution`),
      difficulty: text(snapshot.difficulty, `sessions[${index}].puzzleSnapshot.difficulty`) as Puzzle["difficulty"],
      ratingVersion: text(snapshot.ratingVersion, `sessions[${index}].puzzleSnapshot.ratingVersion`),
    },
    currentGrid: grid81(raw.currentGrid, `sessions[${index}].currentGrid`),
    notes: notes.map((value) => numeric(value, `sessions[${index}].notes`)),
    status: text(raw.status, `sessions[${index}].status`) as GameSession["status"],
    isPractice: raw.isPractice === true,
    elapsedMs: numeric(raw.elapsedMs, `sessions[${index}].elapsedMs`),
    assisted: raw.assisted === true,
    machineSolved: raw.machineSolved === true,
    hintCount: numeric(raw.hintCount, `sessions[${index}].hintCount`),
    checkCount: numeric(raw.checkCount, `sessions[${index}].checkCount`),
    startedAt: text(raw.startedAt, `sessions[${index}].startedAt`),
    updatedAt: text(raw.updatedAt, `sessions[${index}].updatedAt`),
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
  };
}

function arrayOf(raw: unknown, field: string): unknown[] {
  if (!Array.isArray(raw)) throw new BackupError(`字段 ${field} 必须是数组`);
  return raw;
}

/** 解析并校验备份文本；任何一条不合格都会抛出 `BackupError`。 */
export function parseBackup(input: string): BackupPayload {
  if (input.length > MAX_BACKUP_BYTES) {
    throw new BackupError(`备份文件超过 ${Math.round(MAX_BACKUP_BYTES / 1024 / 1024)} MB`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new BackupError("不是合法的 JSON 文件");
  }

  if (!isRecord(parsed)) throw new BackupError("备份文件顶层必须是对象");
  if (parsed.format !== BACKUP_FORMAT) throw new BackupError("不是本应用导出的备份文件");

  const version = numeric(parsed.version, "version");
  if (version > BACKUP_VERSION) {
    throw new BackupError(`备份版本 ${version} 高于当前支持的 ${BACKUP_VERSION}，请升级应用`);
  }

  const puzzles = arrayOf(parsed.puzzles, "puzzles").map(validatePuzzle);
  const favorites = arrayOf(parsed.favorites, "favorites").map(validateFavorite);
  const sessions = arrayOf(parsed.sessions, "sessions").map(validateSession);

  // 引用完整性：收藏和对局引用的题目必须能通过快照自洽
  const puzzleIds = new Set(puzzles.map((item) => item.id));
  for (const favorite of favorites) {
    if (!puzzleIds.has(favorite.puzzleId)) {
      // 允许：题目已删但快照还在（SRS 6.2 允许收藏独立于题目）
      continue;
    }
  }

  return {
    format: BACKUP_FORMAT,
    version,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    appVersion: typeof parsed.appVersion === "string" ? parsed.appVersion : APP_VERSION,
    puzzles,
    favorites,
    sessions,
    settings: isRecord(parsed.settings) ? (parsed.settings as unknown as Settings) : null,
    stats: isRecord(parsed.stats) ? (parsed.stats as unknown as Stats) : null,
  };
}

/** 导出全部用户数据。 */
export async function exportBackup(db: SudokuDB): Promise<BackupPayload> {
  const [puzzles, favorites, sessions, settingsRows, statsRows] = await Promise.all([
    db.puzzles.toArray(),
    db.favorites.toArray(),
    db.sessions.toArray(),
    db.settings.toArray(),
    db.stats.toArray(),
  ]);

  const settingsRow = settingsRows[0];
  const statsRow = statsRows[0];

  let settings: Settings | null = null;
  if (settingsRow !== undefined) {
    const { key: _key, ...rest } = settingsRow;
    settings = rest;
  }

  let stats: Stats | null = null;
  if (statsRow !== undefined) {
    const { key: _key, ...rest } = statsRow;
    stats = rest;
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    puzzles,
    favorites,
    sessions,
    settings,
    stats,
  };
}

/** 把备份写成文件用的 JSON 文本。 */
export function serializeBackup(payload: BackupPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** 导出文件名：sudoku-backup-YYYYMMDD-HHmm.json（SRS 7.4）。 */
export function backupFileName(now: Date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `sudoku-backup-${date}-${time}.json`;
}

function isNewerOrEqual(incoming: string, existing: string): boolean {
  return incoming >= existing;
}

/**
 * 导入备份。
 *
 * @param mode `merge` 按 id 去重、保留较新记录；`replace` 清空后写入。
 */
export async function importBackup(
  db: SudokuDB,
  payload: BackupPayload,
  mode: "merge" | "replace",
): Promise<ImportSummary> {
  let conflicts = 0;
  let puzzleCount = 0;
  let favoriteCount = 0;
  let sessionCount = 0;

  await db.transaction("rw", [db.puzzles, db.favorites, db.sessions, db.settings, db.stats], async () => {
    if (mode === "replace") {
      await Promise.all([db.puzzles.clear(), db.favorites.clear(), db.sessions.clear()]);
    }

    for (const puzzle of payload.puzzles) {
      if (mode === "merge") {
        const existing = await db.puzzles.get(puzzle.id);
        if (existing !== undefined && !isNewerOrEqual(puzzle.updatedAt, existing.updatedAt)) {
          conflicts += 1;
          continue;
        }
      }
      await db.puzzles.put(puzzle);
      puzzleCount += 1;
    }

    for (const favorite of payload.favorites) {
      if (mode === "merge") {
        const existing = await db.favorites.get(favorite.id);
        if (existing !== undefined && !isNewerOrEqual(favorite.createdAt, existing.createdAt)) {
          conflicts += 1;
          continue;
        }
      }
      await db.favorites.put(favorite);
      favoriteCount += 1;
    }

    for (const session of payload.sessions) {
      if (mode === "merge") {
        const existing = await db.sessions.get(session.id);
        if (existing !== undefined && !isNewerOrEqual(session.updatedAt, existing.updatedAt)) {
          conflicts += 1;
          continue;
        }
      }
      await db.sessions.put(session);
      sessionCount += 1;
    }

    if (payload.settings !== null) {
      await db.settings.put({ ...payload.settings, key: SINGLETON_KEY });
    }
    if (payload.stats !== null) {
      await db.stats.put({ ...payload.stats, key: SINGLETON_KEY });
    }
  });

  return { mode, puzzles: puzzleCount, favorites: favoriteCount, sessions: sessionCount, conflicts };
}
