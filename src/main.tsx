import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./shared/styles/index.css";
import { applyTheme } from "./shared/theme";
import { SCHEMA_VERSION, settingsRepo } from "./storage/runtime";

// 先跟随系统，避免读库期间闪白；读到用户偏好后再覆盖
applyTheme("system");

const container = document.getElementById("root");
if (!container) {
  throw new Error("找不到挂载节点 #root");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void settingsRepo
  .get(SCHEMA_VERSION)
  .then((settings) => applyTheme(settings.theme))
  .catch(() => undefined);

// V1.3 取消了离线能力。如果曾经加载过带 Service Worker 的版本，它会一直驻留并
// 拦截请求、返回旧缓存，表现为「改了代码但页面不更新」，所以这里主动注销。
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined);
}
