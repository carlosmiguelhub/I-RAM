"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ChevronDown,
  CircleHelp,
  FileText,
  LogOut,
  Menu,
  Search,
} from "lucide-react";
import { apiRequest, clearStoredAuth } from "@/lib/api";
import type { AuthUser } from "@/lib/types";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

export default function Topbar({
  onMenuClick,
}: {
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const pageTitle = getPageTitle(pathname);

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
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#E7E3DC] bg-white/95 px-4 backdrop-blur-md transition-colors dark:border-[#26354A] dark:bg-[#0D1728]/95 sm:px-6 lg:px-7 xl:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DDD7CC] bg-white text-[#4F5651] shadow-sm transition hover:bg-[#F7F5F1] hover:text-[#075A3A] dark:border-[#33445E] dark:bg-[#172337] dark:text-[#D9E2EE] lg:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F7F3] text-[#075A3A] sm:flex">
          {pathname.startsWith("/archive") ? (
            <Archive className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </span>

        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-[#202622] sm:text-[15px]">
            {pageTitle}
          </p>
          <p className="hidden truncate text-[11px] text-[#8A847B] sm:block">
            IRAM · Record Acquisition and Archiving Management
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="hidden h-9 w-48 items-center gap-2 rounded-xl border border-[#E2DED6] bg-[#FAF9F7] px-3 text-[#989289] xl:flex">
          <Search className="h-4 w-4" />
          <span className="text-xs">Search archive...</span>
        </div>

        {user?.role?.name === "Staff" && (
          <Link
            href="/staff-guide"
            aria-label="Open Staff Help and Guidelines"
            title="Staff Help and Guidelines"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#59605B] transition hover:bg-[#F4F2EE] hover:text-[#075A3A] dark:text-[#A9B6C8] dark:hover:bg-white/5 dark:hover:text-[#78D6A7]"
          >
            <CircleHelp className="h-[1.15rem] w-[1.15rem]" />
          </Link>
        )}

        <NotificationBell />
        <ThemeToggle compact />

        <Link
          href="/profile"
          className="ml-0.5 flex min-w-0 items-center gap-2 rounded-xl p-1 transition hover:bg-[#F4F2EE] dark:hover:bg-white/5"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#075A3A] text-[10px] font-extrabold uppercase text-white">
            {initials(user?.name)}
          </span>
          <span className="hidden min-w-0 lg:block">
            <span className="block max-w-28 truncate text-xs font-bold text-[#252A27]">
              {user?.name || "IRAM User"}
            </span>
            <span className="block max-w-28 truncate text-[10px] text-[#8A847B]">
              {user?.role?.name || "Account"}
            </span>
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-[#8A847B] lg:block" />
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="ml-0.5 flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#E2DED6] px-2.5 text-xs font-bold text-[#6B0F2B] transition hover:border-[#D4B9C2] hover:bg-[#FBF3F5] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#33445E] dark:hover:bg-white/5 sm:px-3"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">
            {loggingOut ? "Signing out..." : "Logout"}
          </span>
        </button>
      </div>
    </header>
  );
}

function getPageTitle(pathname: string) {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/archive-catalog")) return "Archive Catalog";
  if (pathname.startsWith("/archive/folders")) return "Archive Folders";
  if (pathname.startsWith("/archive")) return "Archive Repository";
  if (pathname.startsWith("/disposal")) return "For Disposal";
  if (pathname.startsWith("/document-requests")) {
    return "Document Requests";
  }
  if (pathname.startsWith("/records/create")) return "New Record";
  if (pathname.startsWith("/records")) return "Records";
  if (pathname.startsWith("/audit-trail")) return "Audit Trail";
  if (pathname.startsWith("/admin/users")) return "User Management";
  if (pathname.startsWith("/admin/departments")) return "Departments";
  if (pathname.startsWith("/admin/categories")) return "Categories";
  if (pathname.startsWith("/admin/settings")) return "System Settings";
  if (pathname.startsWith("/staff-guide")) return "Help & Guidelines";
  if (pathname.startsWith("/profile")) return "Profile & Security";
  return "Document Archive";
}

function initials(name?: string | null) {
  const parts = (name || "User").trim().split(/\s+/);

  return `${parts[0]?.[0] || "U"}${parts[1]?.[0] || ""}`.toUpperCase();
}
