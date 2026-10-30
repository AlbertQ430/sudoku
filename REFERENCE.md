# 数独项目参考实现调研

> 调研日期：2026-10-29
> 目的：为《数独软件需求规格说明书》V1.1 的技术方案与核心算法选型提供可对标的开源实现
> 方法：GitHub 仓库检索 → 浅克隆到 `refs\` → 实读源码（非只看 README）
> 结论只针对 SRS 的 MVP（P0）范围

---

## 1. 结论速览

| 仓库 | 技术栈 | 许可证 | 规模 | 参考价值 | 主要用途 |
|---|---|---|---|---|---|
| [komeilmehranfar/sudoku-core](https://github.com/komeilmehranfar/sudoku-core) | TypeScript 库，零依赖 | MIT | 技巧层 ~3000 行 + 测试 ~1800 行，13 kB | ★★★★★ | 求解器 / 唯一解统计 / 难度评级器 |
| [TN1ck/super-sudoku](https://github.com/TN1ck/super-sudoku) | React 18 + Vite + TS + PWA | MIT | 完整 Web 应用 | ★★★★☆ | 界面、对局交互、PWA、快捷键 |
| [petewritescode/sudoku-gen](https://github.com/petewritescode/sudoku-gen) | TypeScript 库 | MIT | 小 | ★★☆☆☆ | 对称变换、种子化出题速度 |
| [SudokuStudio/SudokuStudio](https://github.com/SudokuStudio/SudokuStudio) | Svelte + pnpm monorepo + SAT | **GPL-3.0** | 大型 | ★☆☆☆☆ | 只看思路，禁止抄代码 |
| [stephenostermiller/qqwing](https://github.com/stephenostermiller/qqwing) | C++ | 未核实 | 中 | ★★☆☆☆ | 五档难度打分模型的备选参考 |
| [ogarcia/opensudoku](https://github.com/ogarcia/opensudoku) | Android / Kotlin | 未核实 | 中 | ★★☆☆☆ | 收藏、统计、导入导出的产品形态 |

`refs\` 下已克隆前四个。

**一句话结论**：算法层直接用 `sudoku-core`（MIT，可安装、可改源码）打底，UI 层参考 `super-sudoku` 的交互与工程结构；**数据持久化、无障碍、多标签页三块没有现成可抄的参考**，必须自建。

---

## 2. sudoku-core（最值得用的一个）

### 2.1 它有什么

- 31 种人类解题技巧，每种一个文件、一个 `rank`，按 rank 排序成注册表：

  `refs\sudoku-core\src\tactics\registry.ts`

  ```
  openSingles 1.0 → hiddenSingle 1.5 → nakedSingle 2.3 → pointing 2.6 →
  nakedPair 3.0 → xWing 3.2 → hiddenPair 3.4 → hiddenGroup 3.5 →
  nakedTriple 3.6 → nakedQuad 3.8 → swordfish 3.8 → skyscraper/kite 4.0 →
  crane 4.1 → yWing 4.2 → wWing 4.3 → xyzWing 4.4 → colouring 4.5 →
  emptyRectangle 4.6 → finnedXWing 4.7 → uniqueRectangle 4.8 →
  wxyzWing 4.8 → finnedSwordfish 5.0 → bugPlusOne 5.1 → jellyfish 5.2 →
  finnedJellyfish 5.4 → xChain 6.6 → xyChain 6.8 → medusa 7.2 →
  AIC 7.5 → nishio 7.9
  ```

- 难度评级 = 实际用到的**最难技巧 rank**，再用累计 `score` 做一档微调：

  `refs\sudoku-core\src\rate\difficulty.ts`

  这正是 SRS 6.2「按技巧和回溯综合评级」想要的模型，且带 `hardestTechnique`、`hardestRank`、`usedStrategies`、`tedium`，可直接对应 SRS 的 `ratingVersion` 需求。

- 解数统计：MRV 回溯，`limit=2` 提前退出：

  `refs\sudoku-core\src\uniqueness\count-solutions.ts`

  `countSolutions(board, 2)` / `isUniqueSolution` / `hasAnySolution` / `getUniqueSolution`，接口形态与 SRS 6.3、6.5 的解数统计要求一致（最多 2 个解即停）。

- 生成器：满盘 → 随机顺序逐格挖空 → 每次挖空后校验「唯一解 + 人类可解 + 不超过目标档」→ 超过就回填：

  `refs\sudoku-core\src\generate\generate.ts`

  这是 SRS 6.1「完整终盘 → 挖空 → 每次挖空后唯一解校验 → 难度评级」的现成实现，连 `maxAttempts`、`timeoutMs`、`seed` 都做好了。

- 提示与教学 API：`hint()`、`teachHint()` 返回要高亮的格、要划掉的候选数、中文/英文讲解，正好对上 P1 的「分级提示与技巧说明」。

### 2.2 与 SRS 的差距（必须自己补）

| SRS 要求 | sudoku-core 现状 | 处理方式 |
|---|---|---|
| 五档难度 | 十档 L1–L10 | 自建 L→五档映射表，随 `ratingVersion` 固化 |
| 技巧分组与 SRS 6.2 不完全一致 | XY-Wing 在 L8，SRS 放在「中等」 | 必须重排 rank，不能照搬 |
| 专家档允许有限试错 | 纯逻辑，解不动返回 `NEEDS_GUESSING` | 自己加回溯兜底 + 试错计分 |
| 提示数范围 22–50 | `CLUE_TARGET` L1=42 … L10=20 | 加提示数约束，超范围重试 |
| 180° 旋转对称 | 无 | 自己实现对称挖空（可参考 `sudoku-gen` 的 `rotate-layout-180`） |
| Web Worker 封装 | 无 | 自己做 worker 协议 |

### 2.3 能不能直接当依赖用

可以。但它把「技巧库 + 评级 + 生成」捆在一起，而 SRS 要求核心算法可单元测试、`ratingVersion` 可追踪、且将来要调 rank。建议：

- 方案 A（快）：`npm i sudoku-core`，外面包一层 `engine/` 适配器，把 L1–L10 映射成五档，用自己的 `ratingVersion` 存快照。
- 方案 B（可控）：把 `src/tactics`、`src/rate`、`src/uniqueness` 拷进来改（MIT 允许，保留版权声明），重排 rank、加试错兜底。

MVP 阶段推荐 A，等评级需要按 SRS 调档时再转 B。

---

## 3. super-sudoku（工程与交互参考）

### 3.1 值得抄的部分

- **工程骨架**：Vite + React 18 + TS + Tailwind + `@tanstack/react-router` + i18next，`vite-plugin-pwa` 一条配置搞定离线与 manifest：`refs\super-sudoku\vite.config.ts`
- **对局状态机**：`RUNNING` / `PAUSED` + `won` 布尔，reducer 拆分清晰：`refs\super-sudoku\src\context\GameContext.tsx`
- **撤销/重做**：整盘快照数组 + `historyIndex`，实现简单：`refs\super-sudoku\src\context\SudokuContext.tsx`（第 99–190 行）
- **冲突检测**：按行/列/宫分组找重复，返回冲突格与连线路径：`refs\super-sudoku\src\lib\game\SudokuGame.ts`（`conflictingFields` / `getPathsFromConflicting`）
- **快捷键**：`hotkeys-js` + 分 scope（棋盘 / 菜单）：`refs\super-sudoku\src\pages\Game\shortcuts\`
- **测试组合**：vitest 单测 + Playwright e2e（`e2e\sudoku.e2e.ts`）

### 3.2 明确不要抄的部分

| 问题 | 证据 | 对 SRS 的影响 |
|---|---|---|
| 难度用 AC3 求解迭代次数衡量 | `src\lib\engine\generate.ts` 第 36–50 行 `DIFFICULTY_GOALS` | 衡量的是搜索成本，不是人类技巧；SRS 6.2 明确要求按技巧评级 |
| 题库是离线预生成 | `scripts\generate_sudokus.ts` 生成 3000 题存 `sudokus\` | SRS 要求运行时生成 + 展示前校验 |
| 存储全是 localStorage | `src\lib\database\` 下三个 repository 全部走 localStorage，无 IndexedDB | SRS 要求 IndexedDB + schemaVersion + 迁移 |
| 无障碍只做了零散 aria-label | 全项目仅 9 处 `aria-*` / `role` / `tabIndex` | SRS 把 WCAG 2.1 AA 列为 MVP 验收，这块等于没有 |
| Worker 无取消、无并发 | `src\utils\useSudokuUniqueWorker.ts` 只有请求-响应 | SRS 要求生成可取消、专家题有时间预算 |
| 撤销栈无上限 | 快照数组只增不减 | SRS 要求至少 100 步，需要环形缓冲 |

---

## 4. sudoku-gen（对称与速度）

思路是「预置种子题 + 数学变换」：旋转 0/90/180/270、重排 band/stack/行列、9! 换数字，单题变换空间 2.4 万亿，因此运行时**零生成成本**。

- 变换实现：`refs\sudoku-gen\src\utils\layout\`（`rotate-layout-180.util.ts` 可直接借鉴 180° 对称的坐标映射）
- 难度：只是 `easy/medium/hard/expert` 四个种子池，**没有评级**，`src\constants\difficulty-levels.constant.ts` 只定义了枚举

可借用的只有两点：180° 对称挖空的坐标变换；「用种子保证可复现」的思路（SRS 的每日挑战、回归测试都用得上）。生成算法本身不符合 SRS。

---

## 5. SudokuStudio（只可远观）

- Svelte + pnpm monorepo，`packages/solver-sat` 用 SAT 求解，支持大量变体（杀手、箭头等），远超 SRS 范围。
- Web Worker 封装可看结构：`packages\web\src\lib\js\solver\satSolverWorker.ts`
- **许可证是 GPL-3.0**：任何代码进入本项目都会导致整个项目必须 GPL。只能读思路，不能复制。

---

## 6. 按 SRS 模块的落点建议

| SRS 模块 | 现成参考 | 结论 |
|---|---|---|
| 81 位解析/规范化（6.5） | 无专门实现 | 自己写，注意全角数字、`.`/`_`/`0`、分隔符 |
| 冲突检测（6.3 第 1 层） | super-sudoku `SudokuGame.conflictingFields` | 可直接改写 |
| 唯一解校验（6.1） | sudoku-core `countSolutions(board, 2)` | 直接用 |
| 求解器（6.3 第 3 层 / 独立求解器） | sudoku-core `getUniqueSolution` | 直接用 |
| 生成器（6.1） | sudoku-core `generatePuzzle` + 自加对称/提示数约束 | 改造 |
| 难度评级（6.2） | sudoku-core `rateSteps` + `mapDifficulty` | 改造，重排 rank |
| 检查答案 / 完成判定（6.3） | super-sudoku `isSolved`（只判合法与填满） | 需按 SRS 增加「与唯一解一致」分支 |
| 对局状态 `playing/paused/completed/solved/abandoned` | super-sudoku 只有 running/paused/won | 自建，注意 `solved` ≠ `completed` |
| 撤销/重做 ≥100 步 | super-sudoku 快照法 | 改成定长环形缓冲 |
| IndexedDB + schemaVersion + 迁移 | **无参考** | Dexie.js，自己写迁移 |
| 多标签页只读/接管 | **无参考** | `BroadcastChannel` + `navigator.locks` |
| 收藏 / 统计 / 导出导入 | **无参考** | 自建 |
| PWA 离线 | super-sudoku `vite-plugin-pwa` 配置 | 直接照抄结构 |
| 键盘操作 | super-sudoku 快捷键体系 | 参考，但需补 roving tabindex |
| 屏幕阅读器 / axe | **无参考**，super-sudoku 只有 9 处 aria | 自建，纳入 e2e |
| 核心算法单测 / 属性测试 | sudoku-core 的 `tests\`（1794 行 + curated fixture） | 强烈建议照抄测试组织方式 |

---

## 7. 给技术方案的直接建议

1. **技术栈**：Vite + React 18 + TypeScript + Tailwind，与 super-sudoku 一致；状态用 reducer + Context，不引入重型状态库。
2. **算法**：`sudoku-core` 起步，包一层 `engine/`，worker 只暴露 `generate / solve / countSolutions / rate` 四个消息。
3. **Worker 协议**：必须带 `requestId` + `cancel(requestId)`，worker 内部按时间片检查取消（super-sudoku 没做，是它最大的工程缺口）。
4. **难度**：自己维护 `TECHNIQUE → 五档` 的映射表和 `ratingVersion`，不要让 sudoku-core 的 L 档直接外泄到数据模型——否则将来改评级会污染已收藏题目。
5. **数据层**：Dexie.js + 每个 store 带 `schemaVersion`；对局自动保存用「变更即写、节流 500ms」，别用 localStorage。
6. **测试**：先照 sudoku-core 的方式建 `fixtures/`（已知唯一解/多解/无解/17 提示数边界），再做属性测试。

---

## 8. 许可证与风险

- `sudoku-core`、`super-sudoku`、`sudoku-gen`：MIT，可商用、可改、需保留版权声明。
- `SudokuStudio`：GPL-3.0，**只读思路**。
- `qqwing`、`opensudoku`：许可证未核实，用前先确认；`qqwing` 是 C++ 命令行工具，只能参考其难度打分模型。
- 所有参考实现都**没有**覆盖 SRS 的：IndexedDB 迁移、多标签页、无障碍验收、`solved`/`completed` 区分、收藏去重。这五项是自研成本的主要来源。
