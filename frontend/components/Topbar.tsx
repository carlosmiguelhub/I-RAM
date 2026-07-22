"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleHelp, Menu } from "lucide-react";
import { apiRequest, clearStoredAuth } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedUser = localStorage.getItem("iram_user");

      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {
          setUser(null);
        }
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await apiRequest("/logout", {
        method: "POST",
        acceptedStatuses: [401],
      });
    } catch {
      // Local credentials are cleared even if the API is unreachable.
    } finally {
      clearStoredAuth();
      setUser(null);
      router.replace("/login");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur transition-colors dark:border-[#403C35] dark:bg-[#22201C]/92 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition-colors hover:bg-slate-100 dark:border-[#49443B] dark:bg-[#2C2923] dark:text-[#D9D3C8] dark:hover:bg-[#373229] lg:hidden"
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-slate-900 sm:text-base">
            Document Archive
          </h2>
          <p className="hidden truncate text-xs text-slate-500 sm:block">
            Record Acquisition and Archiving Management
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        <div className="hidden w-64 items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 xl:flex xl:w-80">
          <span className="text-sm text-slate-400">Search archive...</span>
        </div>

        <NotificationBell />

        {user?.role?.name === "Staff" && (
          <Link
            href="/staff-guide"
            aria-label="Open Staff Help and Guidelines"
            title="Staff Help and Guidelines"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D7CDBB] bg-white text-[#075A3A] shadow-sm transition-colors hover:border-[#D9961A] hover:bg-[#FFF9EA] hover:text-[#6B0F2B] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/20 dark:border-[#49443B] dark:bg-[#2C2923] dark:text-[#89B79D] dark:hover:bg-[#373229] dark:hover:text-[#E8C77F]"
          >
            <CircleHelp className="h-5 w-5" />
          </Link>
        )}

        <ThemeToggle compact />

        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition hover:bg-slate-100 dark:hover:bg-white/5 sm:px-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold uppercase text-white">
            {user?.name?.charAt(0) || "U"}
          </div>

          <div className="hidden md:block">
            <p className="max-w-32 truncate text-sm font-semibold text-slate-900">
              {user?.name || "IRAM User"}
            </p>
            <p className="max-w-32 truncate text-xs text-slate-500">
              {user?.role?.name || "Account"}
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-xl bg-slate-950 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-sm"
        >
          {loggingOut ? "..." : "Logout"}
        </button>
      </div>
    </header>
  );
}
