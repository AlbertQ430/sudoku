/**
 * 设置页（SRS 4.11）。
 *
 * 开关即时保存；「清除数据」会删掉整个 IndexedDB 并刷新页面。
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Settings } from "../domain/types";
import {
  BackupError,
  backupFileName,
  exportBackup,
  importBackup,
  parseBackup,
  serializeBackup,
  type BackupPayload,
} from "../storage/backup";
import { db, SCHEMA_VERSION, settingsRepo } from "../storage/runtime";
import { applyTheme, type ThemePreference } from "../shared/theme";

interface ToggleRowProps {
  readonly label: string;
  readonly hint: string;
  readonly checked: boolean;
  readonly onChange: (value: boolean) => void;
}

function ToggleRow(props: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <span className="flex flex-col">
        <span className="font-medium text-slate-900">{props.label}</span>
        <span className="text-xs text-slate-500">{props.hint}</span>
      </span>
      <input
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onChange(event.target.checked)}
        className="h-5 w-5"
      />
    </label>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<BackupPayload | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

  useEffect(() => {
    void settingsRepo.get(SCHEMA_VERSION).then(setSettings);
  }, []);

  async function update(patch: Partial<Settings>): Promise<void> {
    if (settings === null) return;
    const next: Settings = { ...settings, ...patch };
    setSettings(next);

    // 主题要立即生效，不能等存库完成
    if (patch.theme !== undefined) applyTheme(patch.theme);

    try {
      await settingsRepo.save(next);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1_500);
    } catch {
      setError("设置保存失败，请重试。");
    }
  }

  async function handleExport(): Promise<void> {
    setBackupMessage(null);
    try {
      const text = serializeBackup(await exportBackup(db));
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = backupFileName();
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupMessage("备份已导出");
    } catch {
      setError("导出失败，请检查浏览器是否允许下载。");
    }
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    setError(null);
    setBackupMessage(null);

    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;

    try {
      setPending(parseBackup(await file.text()));
    } catch (cause) {
      setPending(null);
      setError(cause instanceof BackupError ? cause.message : "读取备份文件失败。");
    }
  }

  async function handleImport(mode: "merge" | "replace"): Promise<void> {
    if (pending === null) return;

    if (mode === "replace") {
      const confirmed = window.confirm("替换会用备份内容覆盖当前全部数据，确定吗？");
      if (!confirmed) return;
    }

    try {
      const summary = await importBackup(db, pending, mode);
      setPending(null);
      setBackupMessage(
        `${mode === "replace" ? "已替换" : "已合并"}：${summary.puzzles} 道题、` +
          `${summary.favorites} 个收藏、${summary.sessions} 个对局` +
          (summary.conflicts > 0 ? `，跳过 ${summary.conflicts} 条较旧记录` : ""),
      );
      void settingsRepo.get(SCHEMA_VERSION).then(setSettings);
    } catch {
      setError("导入失败，数据未改动。");
    }
  }

  async function handleClear(): Promise<void> {
    const confirmed = window.confirm(
      "会删除全部收藏、对局记录和设置，且无法恢复。确定要清除吗？",
    );
    if (!confirmed) return;

    try {
      await db.delete();
      window.location.reload();
    } catch {
      setError("清除失败，请关闭其他标签页后重试。");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-3 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">设置</h1>
        <p className="text-sm text-slate-600">所有数据只保存在这台设备上。</p>
      </header>

      {settings === null ? (
        <p className="text-sm text-slate-600">读取中…</p>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
            <span className="flex flex-col">
              <span className="font-medium text-slate-900">主题</span>
              <span className="text-xs text-slate-500">跟随系统时会随系统深色切换自动变化</span>
            </span>
            <select
              value={settings.theme}
              onChange={(event) => void update({ theme: event.target.value as ThemePreference })}
              className="min-h-11 rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
            >
              <option value="system">跟随系统</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </label>

          <ToggleRow
            label="填入后自动清理候选数"
            hint="清除同行、同列、同宫里的该数字候选"
            checked={settings.autoRemoveNotes}
            onChange={(value) => void update({ autoRemoveNotes: value })}
          />
          <ToggleRow
            label="高亮同行列宫"
            hint="选中格子时淡化所在行、列、宫"
            checked={settings.highlightPeers}
            onChange={(value) => void update({ highlightPeers: value })}
          />
          <ToggleRow
            label="高亮相同数字"
            hint="选中已填数字时标出棋盘上其它相同数字"
            checked={settings.highlightSameNumber}
            onChange={(value) => void update({ highlightSameNumber: value })}
          />
          <ToggleRow
            label="实时冲突提示"
            hint="同行、同列、同宫出现重复时立即标记"
            checked={settings.showConflicts}
            onChange={(value) => void update({ showConflicts: value })}
          />
          <ToggleRow
            label="显示计时"
            hint="关闭后状态栏不显示用时，成绩照常记录"
            checked={settings.showTimer}
            onChange={(value) => void update({ showTimer: value })}
          />
          <ToggleRow
            label="暂停时遮住棋盘"
            hint="避免暂停时偷看"
            checked={settings.hideBoardOnPause}
            onChange={(value) => void update({ hideBoardOnPause: value })}
          />
          <ToggleRow
            label="减少动态效果"
            hint="关闭过渡与动画"
            checked={settings.reducedMotion}
            onChange={(value) => void update({ reducedMotion: value })}
          />
        </div>
      )}

      {saved ? (
        <p role="status" className="text-sm text-green-700">
          已保存
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <section className="mt-4 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-900">备份</h2>
        <p className="text-sm text-slate-600">
          导出为 JSON 文件保存到本机。数据只存在浏览器里，清理站点数据会丢，建议定期备份。
        </p>

        <button
          type="button"
          onClick={() => void handleExport()}
          className="min-h-11 rounded-lg bg-slate-100 px-4 font-medium text-slate-900"
        >
          导出备份
        </button>

        <label className="min-h-11 cursor-pointer rounded-lg bg-slate-100 px-4 text-center font-medium leading-[2.75rem] text-slate-900">
          选择备份文件导入
          <input type="file" accept=".json,application/json" onChange={(e) => void handleFile(e)} className="hidden" />
        </label>

        {pending !== null ? (
          <div className="flex flex-col gap-2 rounded-lg bg-blue-50 p-3">
            <p className="text-sm text-blue-900">
              将导入 {pending.puzzles.length} 道题、{pending.favorites.length} 个收藏、
              {pending.sessions.length} 个对局。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleImport("merge")}
                className="min-h-11 flex-1 rounded-lg bg-blue-600 px-3 text-white"
              >
                合并导入
              </button>
              <button
                type="button"
                onClick={() => void handleImport("replace")}
                className="min-h-11 flex-1 rounded-lg bg-white px-3 text-red-700 ring-1 ring-red-300"
              >
                替换导入
              </button>
            </div>
          </div>
        ) : null}

        {backupMessage !== null ? (
          <p role="status" className="text-sm text-green-700">
            {backupMessage}
          </p>
        ) : null}
      </section>

      <section className="mt-4 flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
        <h2 className="font-medium text-red-900">清除数据</h2>
        <p className="text-sm text-red-800">
          会删除收藏、对局记录和设置。浏览器清除站点数据也会造成同样的结果。
        </p>
        <button
          type="button"
          onClick={() => void handleClear()}
          className="min-h-11 rounded-lg bg-red-600 px-4 font-medium text-white"
        >
          清除全部数据
        </button>
      </section>

      <footer className="mt-auto flex flex-col gap-1 text-xs text-slate-500">
        <p>MVP 开发版 · 数据不加密，也不上传。</p>
        <div className="flex gap-4">
          <Link to="/about" className="text-blue-700 underline">
            关于与许可
          </Link>
          <Link to="/" className="text-blue-700 underline">
            返回首页
          </Link>
        </div>
      </footer>
    </main>
  );
}
