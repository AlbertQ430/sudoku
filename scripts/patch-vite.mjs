/**
 * 安装后补丁：让 Vite 在受限沙箱里也能启动。
 *
 * Vite 在 Windows 上首次解析真实路径时会执行 `net use` 探测网络驱动器。
 * 本环境的沙箱禁止带管道的子进程，`spawn` 抛 EPERM 并中断配置加载。
 * 这里把该调用包进 try/catch —— 失败时退回原生 realpath，功能不受影响。
 *
 * 幂等：已打过补丁则直接退出。仅影响本地开发/测试。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MARKER = "受限环境禁止子进程";
const target = fileURLToPath(new URL("../node_modules/vite/dist/node/chunks/node.js", import.meta.url));

if (!existsSync(target)) {
  console.warn("[patch-vite] 未找到 vite，跳过");
  process.exit(0);
}

const source = readFileSync(target, "utf8");
if (source.includes(MARKER)) {
  process.exit(0);
}

const pattern = /\texec\("net use", \{ windowsHide: true \}, \(error, stdout\) => \{[\s\S]*?\n\t\}\);\n\}/;

if (!pattern.test(source)) {
  console.warn("[patch-vite] 未匹配到目标代码，可能是 vite 版本变化；跳过");
  process.exit(0);
}

const patched = source.replace(
  pattern,
  [
    "\ttry {",
    '\t\texec("net use", { windowsHide: true }, (error, stdout) => {',
    "\t\t\tif (error) return;",
    '\t\t\tconst lines = stdout.split("\\n");',
    "\t\t\tfor (const line of lines) {",
    "\t\t\t\tconst m = parseNetUseRE.exec(line);",
    "\t\t\t\tif (m) windowsNetworkMap.set(m[2], m[1]);",
    "\t\t\t}",
    "\t\t\tif (windowsNetworkMap.size === 0) safeRealpathSync = fs.realpathSync.native;",
    "\t\t\telse safeRealpathSync = windowsMappedRealpathSync;",
    "\t\t});",
    "\t} catch {",
    `\t\t// ${MARKER}：退回原生 realpath，不影响正确性，仅失去网络驱动器映射`,
    "\t}",
    "}",
  ].join("\n"),
);

writeFileSync(target, patched, "utf8");
console.warn("[patch-vite] 已应用沙箱兼容补丁");
