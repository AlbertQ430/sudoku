/**
 * 主题应用（SRS FR-SET：浅色 / 深色 / 跟随系统）。
 *
 * 只负责在 `<html>` 上切 `dark` 类；具体配色在 `shared/styles/index.css` 里集中覆盖。
 * 不依赖 React，方便在应用挂载前先跑一次，避免首屏闪白。
 */

export type ThemePreference = "system" | "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function prefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY).matches
    : false;
}

/** 把偏好解析成实际主题。 */
export function resolveTheme(theme: ThemePreference): "light" | "dark" {
  if (theme === "system") return prefersDark() ? "dark" : "light";
  return theme;
}

/** 应用到文档；非浏览器环境静默跳过。 */
export function applyTheme(theme: ThemePreference): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
}

/**
 * 跟随系统：仅在 `theme === "system"` 时监听系统深色切换。
 *
 * @returns 取消订阅函数。
 */
export function watchSystemTheme(theme: ThemePreference, onChange?: (resolved: "light" | "dark") => void): () => void {
  if (theme !== "system" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }

  const media = window.matchMedia(DARK_QUERY);
  const listener = (): void => {
    applyTheme("system");
    onChange?.(resolveTheme("system"));
  };

  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
