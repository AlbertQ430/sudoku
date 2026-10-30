import { Link } from "react-router-dom";

interface Dependency {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly url: string;
}

const RUNTIME: readonly Dependency[] = [
  { name: "React", version: "18.3", license: "MIT", url: "https://github.com/facebook/react/blob/main/LICENSE" },
  {
    name: "React Router",
    version: "7",
    license: "MIT",
    url: "https://github.com/remix-run/react-router/blob/main/LICENSE.md",
  },
  { name: "Zustand", version: "5", license: "MIT", url: "https://github.com/pmndrs/zustand/blob/main/LICENSE" },
  { name: "Dexie", version: "4", license: "Apache-2.0", url: "https://github.com/dexie/Dexie.js/blob/master/LICENSE" },
  {
    name: "sudoku-core",
    version: "4.1",
    license: "MIT",
    url: "https://github.com/komeilmehranfar/sudoku-core/blob/main/LICENSE",
  },
];

const TOOLING: readonly Dependency[] = [
  { name: "Vite", version: "8", license: "MIT", url: "https://github.com/vitejs/vite/blob/main/LICENSE" },
  { name: "Tailwind CSS", version: "3.4", license: "MIT", url: "https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE" },
  { name: "TypeScript", version: "5.9", license: "Apache-2.0", url: "https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt" },
  { name: "Vitest", version: "5", license: "MIT", url: "https://github.com/vitest-dev/vitest/blob/main/LICENSE" },
  {
    name: "Playwright",
    version: "1.x",
    license: "Apache-2.0",
    url: "https://github.com/microsoft/playwright/blob/main/LICENSE",
  },
];

function DependencyList(props: { readonly items: readonly Dependency[] }) {
  return (
    <ul className="flex flex-col divide-y divide-slate-100">
      {props.items.map((item) => (
        <li key={item.name} className="flex items-center justify-between gap-3 py-2 text-sm">
          <a href={item.url} className="text-blue-700 underline" rel="noreferrer noopener" target="_blank">
            {item.name}
          </a>
          <span className="text-slate-500">
            {item.version} · {item.license}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AboutPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">关于</h1>
        <p className="text-sm text-slate-600">数独 · MVP 开发版</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-900">隐私</h2>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-sm text-slate-600">
          <li>不需要账号，不收集姓名、手机号、邮箱。</li>
          <li>题目、答案、进度、收藏只保存在这台设备的浏览器里，不上传。</li>
          <li>没有广告、第三方统计或追踪脚本。</li>
          <li>清除浏览器站点数据会同时删除全部记录，无法恢复。</li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-900">运行时依赖</h2>
        <DependencyList items={RUNTIME} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-900">构建与测试工具</h2>
        <p className="mt-1 text-xs text-slate-500">这些工具只在开发和构建时使用，不进最终产物。</p>
        <DependencyList items={TOOLING} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-medium text-slate-900">题目来源</h2>
        <p className="mt-1 text-sm text-slate-600">
          所有标准题由本应用在本地按技巧评级实时生成，不复用任何受版权保护的题库。
          自定义题目由用户自行确认使用权。
        </p>
      </section>

      <Link to="/settings" className="min-h-11 text-center leading-[2.75rem] text-blue-700">
        返回设置
      </Link>
    </main>
  );
}
