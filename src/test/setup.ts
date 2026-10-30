import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest 未开启 globals，RTL 的自动清理不会注册，这里显式挂上
afterEach(() => {
  cleanup();
});
