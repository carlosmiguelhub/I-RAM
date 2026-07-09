"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: "▦" },
  { name: "All Records", href: "/records", icon: "□" },
  { name: "Add Record", href: "/records/create", icon: "+" },
  { name: "Under Review", href: "/records?status=under_review", icon: "◷" },
  { name: "Archived", href: "/records?status=archived", icon: "▣" },
  { name: "For Disposal", href: "/records?status=for_disposal", icon: "!" },
  { name: "Audit Trail", href: "#", icon: "◎" },
];

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

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
              <h1 className="text-sm font-bold text-slate-900">IRAM Archive</h1>
              <p className="text-xs text-slate-500">Records Management</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="mt-8 space-y-1">
          {menuItems.map((item) => {
            const active = pathname === item.href.split("?")[0];

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
            + Add New Record
          </Link>
        </div>
      </aside>
    </>
  );
}