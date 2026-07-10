"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Archive,
  Building2,
  ClipboardCheck,
  FilePlus2,
  Files,
  FolderArchive,
  Gauge,
  History,
  LayoutGrid,
  Settings,
  Tags,
  Trash2,
  UserCircle2,
  Users,
  X,
} from "lucide-react";

type SidebarItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  roles: string[];
};

const menuItems: SidebarItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Gauge,
    roles: ["Admin", "Records Officer", "Staff"],
  },
  {
    name: "All Records",
    href: "/records",
    icon: Files,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "My Records",
    href: "/records",
    icon: Files,
    roles: ["Staff"],
  },
  {
    name: "Add Record",
    href: "/records/create",
    icon: FilePlus2,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "New Submission",
    href: "/records/create",
    icon: FilePlus2,
    roles: ["Staff"],
  },
  {
    name: "Under Review",
    href: "/records?status=under_review",
    icon: ClipboardCheck,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "Archive Repository",
    href: "/archive",
    icon: FolderArchive,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "For Disposal",
    href: "/records?status=for_disposal",
    icon: Trash2,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "Audit Trail",
    href: "/audit-trail",
    icon: History,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "User Management",
    href: "/admin/users",
    icon: Users,
    roles: ["Admin"],
  },
  {
    name: "Departments",
    href: "/admin/departments",
    icon: Building2,
    roles: ["Admin"],
  },
  {
    name: "Categories",
    href: "/admin/categories",
    icon: Tags,
    roles: ["Admin"],
  },
  {
    name: "Profile",
    href: "/profile",
    icon: UserCircle2,
    roles: ["Admin", "Records Officer", "Staff"],
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
    roles: ["Admin"],
  },
];

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [roleName, setRoleName] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("iram_user");

    if (!storedUser) return;

    try {
      const user = JSON.parse(storedUser);
      setRoleName(user?.role?.name || "");
    } catch {
      setRoleName("");
    }
  }, []);

  const visibleMenuItems = useMemo(() => {
    if (!roleName) return [];

    return menuItems.filter((item) =>
      item.roles.includes(roleName)
    );
  }, [roleName]);

  const primaryAction =
    roleName === "Staff"
      ? "New Submission"
      : "Add New Record";

  function isActive(href: string) {
    const [itemPath, queryString] = href.split("?");

    if (queryString) {
      const expectedParams = new URLSearchParams(queryString);

      if (pathname !== itemPath) {
        return false;
      }

      return Array.from(expectedParams.entries()).every(
        ([key, value]) => searchParams.get(key) === value
      );
    }

    if (itemPath === "/records") {
      return pathname === "/records" && !searchParams.get("status");
    }

    return (
      pathname === itemPath ||
      pathname.startsWith(`${itemPath}/`)
    );
  }

  return (
    <>
      {open && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden"
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-slate-200 bg-white px-4 py-5 shadow-xl shadow-slate-950/5 transition-transform duration-300 lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm">
              <Archive className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-slate-900">
                IRAM Archive
              </h1>

              <p className="truncate text-xs text-slate-500">
                {roleName || "Records Management"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-7 flex-1 space-y-1 overflow-y-auto pb-5">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                    active
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-blue-600 group-hover:ring-1 group-hover:ring-slate-200"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>

                <span className="truncate">
                  {item.name}
                </span>

                {active && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-blue-600" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 pt-4">
          <Link
            href="/records/create"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            <FilePlus2 className="h-4 w-4" />
            {primaryAction}
          </Link>
        </div>
      </aside>
    </>
  );
}