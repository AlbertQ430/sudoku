import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * E2E 配置（SRS 9.1 / 附录 D 第 6 条）。
 *
 * 生成任务较重，worker 固定为 1，避免多个浏览器上下文同时生成把 CPU 打满。
 * `webServer` 会先构建再起 preview，所以用例跑的是生产产物（含 Service Worker）。
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  // Chromium 渲染进程偶发 Target crashed（与用例无关，见 README）。保持单 worker：
  // 崩溃可能来自内存压力，增加并发只会让峰值更高。
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 1,
  // 填满棋盘要逐格操作，30s 的默认超时不够
  timeout: 90_000,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    launchOptions: {
      // headless 下用不到 GPU，关掉能减少 Chromium 在 Windows 上的崩溃
      args: ["--disable-gpu"],
    },
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // 三条要求一次说清：
    // 1. 必须带 build，否则测的是上一次的 dist（改了代码看不到效果）
    // 2. 直接调 vite，不经过包管理器——pnpm/npm 会把脚本里的 && 解析成 &
    // 3. 显式绑定 IPv4，vite preview 默认只监听 localhost（Windows 上可能是 ::1）
    command: `node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
