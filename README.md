# 数独

标准 9×9 数独 PWA：打开即玩、无需注册、数据只存在本机。

**在线玩：https://sudoku-qzy.netlify.app**

需求基线见 [`数独软件需求规格说明书.md`](./数独软件需求规格说明书.md)（V1.6），架构与实现说明见 [`技术方案.md`](./技术方案.md)、[`软件结构.md`](./软件结构.md)。使用说明见 [`docs/用户指南.md`](./docs/用户指南.md)，许可证见 [MIT](./LICENSE)。

---

## 环境

- Node.js ≥ 20（开发时用 24 / 26 都验证过）
- pnpm ≥ 10 或 npm ≥ 10，**二选一即可**

## 安装

```bash
pnpm install
# 或
npm install
```

首次安装后如需跑 E2E，再装一次浏览器：

```bash
pnpm exec playwright install chromium
# 或
npx playwright install chromium
```

## 包管理器

两个都支持，命令一一对应：

| 操作 | pnpm | npm |
|---|---|---|
| 安装 | `pnpm install` | `npm install` |
| 开发 | `pnpm dev` | `npm run dev` |
| 构建 | `pnpm build` | `npm run build` |
| 测试 | `pnpm test` | `npm test` |
| E2E | `pnpm test:e2e` | `npm run test:e2e` |

几点须知：

- 仓库只维护 `pnpm-lock.yaml`。**用 npm 时没有锁文件保证**，可能装到略新的次要版本；如果长期用 npm，建议改用 `npm install` 后提交 `package-lock.json`（两者不要同时提交，会漂移）。
- npm 若报 peer 依赖冲突，在 `.npmrc` 里加 `legacy-peer-deps=true`。
- `pnpm-workspace.yaml` 是 pnpm 专用文件，npm 会忽略它。
- `.npmrc` 里的 `store-dir`、`node-linker` 等只对 pnpm 生效，npm 静默忽略。
- `scripts/patch-vite.mjs`（`postinstall`）给 vite 打一个 Windows 补丁，与包管理器无关，两者都会执行。

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 开发服务器（HMR），默认 http://localhost:5173 |
| `pnpm build` | 类型检查 + 生产构建，输出到 `dist/` |
| `pnpm preview` | 预览构建产物（PWA 只能在这里验证） |
| `pnpm test` | 单元 / 组件测试（Vitest） |
| `pnpm test:cov` | 带覆盖率，引擎阈值 90% |
| `pnpm typecheck` | 只做类型检查 |
| `pnpm lint` | ESLint，零警告 |
| `pnpm test:e2e` | Playwright 端到端（会先构建再起 preview） |
| `pnpm test:e2e:ui` | Playwright 交互模式 |
| `pnpm exec playwright test e2e/a11y.spec.ts` | 只跑 axe 无障碍扫描（8 个页面，含深色模式） |
| `pnpm pool:build` | 扩充题库，见下节 |
| `pnpm bench` | 引擎基准（五档生成耗时与成功率） |
| `pnpm perf` | 性能基准，产出引擎层耗时表（详见 `docs/PERFORMANCE.md`） |

## 题库

题目不再是运行时生成的：构建期已生成 1000 道（每档 200 道），存在
`src/engine/fixtures/pool-<difficulty>.json`，运行时按难度动态加载并复核唯一解（SRS V1.4 / D11）。

**扩充题库**：

```bash
# 把「简单」补到 400 道（默认 200）
pnpm pool:build --target=easy --count=400

# 每档都加
for d in beginner easy medium hard expert; do pnpm pool:build --target=$d --count=400; done
```

脚本会跳过已存在的题，只补差额；每生成一道就落盘，中途崩溃不会丢进度。
`--minutes` 控制单次运行时长（默认 5 分钟），到点退出，再跑一次即可接着补。

> 中等/专家档生成时 Node 进程会偶发 `0xC0000005` 崩溃（`sudoku-core` 内部问题）。
> 因为每道题单独落盘，重跑即可继续，不需要手工清理。

## E2E

用例在 [`e2e/`](./e2e)，按 SRS 的验收编号组织：

| 文件 | 覆盖 |
|---|---|
| `gameplay.spec.ts` | AC-01 开局、AC-02 输入与撤销、AC-03 冲突、AC-04 完成判定、AC-09 进度恢复 |
| `solver.spec.ts` | AC-05 求解当前题、AC-06 独立求解器 |
| `custom.spec.ts` | AC-07 自定义题校验 |
| `favorites.spec.ts` | AC-08 收藏、重新打开、删除撤销 |
| `backup.spec.ts` | AC-11 导出导入、坏文件拒绝 |
| `pwa.spec.ts` | manifest 与图标（离线能力已取消，见 SRS V1.3） |
| `a11y.spec.ts` | AC-12 axe 扫描 8 个页面（含深色模式） |

跑法：

```bash
pnpm test:e2e
```

失败时的截图、视频和 trace 在 `test-results/`，HTML 报告在 `playwright-report/`（两者都已 gitignore）。

> 首次运行会构建一次并启动 `vite preview`（端口 4173），整个套件大约 1–2 分钟。

## 目录

```
src/
├─ engine/      纯算法：解析、冲突、解数统计、求解、评级、题库取题、Worker
├─ domain/      领域逻辑：棋盘状态、撤销栈、判定、状态机、计时、统计、备份格式
├─ storage/     Dexie 六表、仓储、迁移、备份导入导出
├─ stores/      Zustand：对局状态与持久化接线
├─ features/    棋盘、数字键盘、状态栏、结果区、取题流程
├─ pages/       首页、对局、自定义、求解器、收藏、统计、设置、关于
└─ shared/      样式、主题、测试 setup
```

分层规则由 ESLint 强制：`engine` 不得依赖 React / DOM / 存储。

## 部署

纯静态站点，`pnpm build` 后把 `dist/` 整个丢给任意静态托管即可，不需要服务端。

仓库里已经带了两份平台无关的配置，构建时会复制到 `dist/`：

| 文件 | 作用 |
|---|---|
| `public/_headers` | 安全响应头（CSP、nosniff、frame-ancestors）与缓存策略 |
| `public/_redirects` | SPA 回退，所有路径都交给 `index.html` |

Netlify / Cloudflare Pages 原生支持这两个文件。Vercel 需要在 `vercel.json` 里配
`rewrites` 和 `headers`，内容照抄 `_headers` 即可。

几个容易踩的点：

- **`index.html` 不能长缓存**，否则新版本发不出去。
- 站点走 HTTPS 时才能「添加到主屏幕」，localhost 也可。
- 项目**不使用 Service Worker**（SRS V1.3 取消了离线能力）。如果曾经部署过带 SW 的版本，`src/main.tsx` 里保留了注销旧 SW 的逻辑，避免它一直返回旧缓存。

## 已知限制

- **不做离线**：SRS V1.3 取消了原 AC-10。`manifest` 仍在，可以「添加到主屏幕」，但断网打不开。
- **不做分级提示、多解练习模式、英文界面**：SRS V1.6 取消，`assisted` 与 `hintCount` 字段保留但恒为 false/0。
- 多解自定义题一律阻止开始，没有练习模式入口。

