"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarItem = {
  name: string;
  href: string;
  icon: string;
  roles: string[];
};

const menuItems: SidebarItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: "▦",
    roles: ["Admin", "Records Officer", "Staff"],
  },
  {
    name: "All Records",
    href: "/records",
    icon: "□",
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "My Records",
    href: "/records",
    icon: "□",
    roles: ["Staff"],
  },
  {
    name: "Add Record",
    href: "/records/create",
    icon: "+",
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "New Submission",
    href: "/records/create",
    icon: "+",
    roles: ["Staff"],
  },
  {
    name: "Under Review",
    href: "/records?status=under_review",
    icon: "◷",
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "Archived",
    href: "/records?status=archived",
    icon: "▣",
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "For Disposal",
    href: "/records?status=for_disposal",
    icon: "!",
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "Audit Trail",
    href: "#",
    icon: "◎",
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "User Management",
    href: "/admin/users",
    icon: "♙",
    roles: ["Admin"],
  },
  {
    name: "Departments",
    href: "#",
    icon: "⌂",
    roles: ["Admin"],
  },
  {
    name: "Categories",
    href: "#",
    icon: "◇",
    roles: ["Admin"],
  },
  {
    name: "Profile",
    href: "/profile",
    icon: "◉",
    roles: ["Admin", "Records Officer", "Staff"],
  },
  {
    name: "Settings",
    href: "#",
    icon: "⚙",
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

  return (
    <>
      {open && (
        <button
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-72 border-r border-slate-200 bg-white px-4 py-5 transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">
              I
            </div>

            <div>
              <h1 className="text-sm font-bold text-slate-900">
                IRAM Archive
              </h1>
              <p className="text-xs text-slate-500">
                {roleName || "Records Management"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="mt-8 max-h-[calc(100vh-190px)] space-y-1 overflow-y-auto pb-4">
          {visibleMenuItems.map((item) => {
            const active =
              pathname === item.href.split("?")[0];

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-sm">
                  {item.icon}
                </span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-5 left-4 right-4">
          <Link
            href="/records/create"
            onClick={onClose}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            + {primaryAction}
          </Link>
        </div>
      </aside>
    </>
  );
}
