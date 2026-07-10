"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("iram_user");

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        setUser(null);
      }
    }
  }, []);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await apiRequest("/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error(error);
    } finally {
      localStorage.removeItem("iram_token");
      localStorage.removeItem("iram_user");
      router.replace("/login");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm lg:hidden"
          aria-label="Open sidebar"
        >
          ☰
        </button>

        <div>
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">
            Document Archive
          </h2>
          <p className="hidden text-xs text-slate-500 sm:block">
            Record Acquisition and Archiving Management
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden w-64 items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 xl:flex xl:w-80">
          <span className="text-sm text-slate-400">Search archive...</span>
        </div>

        <button className="relative hidden rounded-full p-2 text-slate-500 hover:bg-slate-100 sm:block">
          🔔
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"></span>
        </button>

        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-slate-100"
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
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:text-sm"
        >
          {loggingOut ? "..." : "Logout"}
        </button>
      </div>
    </header>
  );
}