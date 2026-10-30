import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AboutPage } from "./pages/AboutPage";
import { CustomPage } from "./pages/CustomPage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { GamePage } from "./pages/GamePage";
import { HomePage } from "./pages/HomePage";
import { SettingsPage } from "./pages/SettingsPage";
import { SolverPage } from "./pages/SolverPage";
import { StatsPage } from "./pages/StatsPage";
import { applyTheme, watchSystemTheme } from "./shared/theme";
import { SCHEMA_VERSION, settingsRepo } from "./storage/runtime";

export default function App() {
  // 「跟随系统」时要响应系统深色切换；用户显式选了浅/深则不需要监听
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    void settingsRepo
      .get(SCHEMA_VERSION)
      .then((settings) => {
        applyTheme(settings.theme);
        unsubscribe = watchSystemTheme(settings.theme);
      })
      .catch(() => undefined);

    return () => unsubscribe?.();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/play" element={<GamePage />} />
        <Route path="/custom" element={<CustomPage />} />
        <Route path="/solver" element={<SolverPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
