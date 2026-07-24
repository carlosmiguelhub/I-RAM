"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function getCurrentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("iram-theme-change", onStoreChange);
  return () => window.removeEventListener("iram-theme-change", onStoreChange);
}

function getServerTheme(): Theme {
  return "light";
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeToTheme, getCurrentTheme, getServerTheme);

  function toggleTheme() {
    const nextTheme: Theme = getCurrentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("iram_theme", nextTheme);
    window.dispatchEvent(new Event("iram-theme-change"));
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`group inline-flex items-center justify-center rounded-xl border border-[#D7CDBB] bg-white/90 text-[#514D46] shadow-sm backdrop-blur transition-colors duration-200 hover:border-[#B98529] hover:bg-[#FFF9EA] hover:text-[#075A3A] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/20 dark:border-[#33445E] dark:bg-[#172337]/95 dark:text-[#D9E2EE] dark:hover:border-[#C99B42] dark:hover:bg-[#223149] dark:hover:text-[#F1C768] ${
        compact ? "h-9 w-9" : "h-10 gap-2 px-3"
      }`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && (
        <span className="text-xs font-bold">{isDark ? "Light" : "Dark"}</span>
      )}
    </button>
  );
}
