"use client";

import { useEffect, useState } from "react";

export default function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("iram_user");
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm lg:hidden"
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

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden w-64 items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 md:flex xl:w-80">
          <span className="text-sm text-slate-400">Search archive...</span>
        </div>

        <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100">
          🔔
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"></span>
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
            {user?.name?.charAt(0) || "A"}
          </div>

          <div className="hidden md:block">
            <p className="text-sm font-semibold text-slate-900">
              {user?.name || "IRAM User"}
            </p>
            <p className="text-xs text-slate-500">
              {user?.role?.name || "Admin"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}