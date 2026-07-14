"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Archive,
  BookOpen,
  Building2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  FileUser,
  Files,
  FolderArchive,
  Gauge,
  History,
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

const mainMenuItems: SidebarItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Gauge,
    roles: ["Admin", "Records Officer", "Staff"],
  },
  {
    name: "My Submissions",
    href: "/records?scope=mine",
    icon: FileUser,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "My Records",
    href: "/records",
    icon: FileUser,
    roles: ["Staff"],
  },
  {
    name: "New Submission",
    href: "/records/create",
    icon: FilePlus2,
    roles: ["Staff"],
  },
  {
    name: "Archive Catalog",
    href: "/archive-catalog",
    icon: BookOpen,
    roles: ["Staff"],
  },
  {
    name: "Document Requests",
    href: "/document-requests",
    icon: ClipboardList,
    roles: ["Admin", "Records Officer", "Staff"],
  },
  {
    name: "Archive Repository",
    href: "/archive",
    icon: FolderArchive,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "Audit Trail",
    href: "/audit-trail",
    icon: History,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "Profile",
    href: "/profile",
    icon: UserCircle2,
    roles: ["Records Officer", "Staff"],
  },
];

const recordSubmenuItems: SidebarItem[] = [
  {
    name: "All Records",
    href: "/records",
    icon: Files,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "Add Record",
    href: "/records/create",
    icon: FilePlus2,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "Under Review",
    href: "/records?status=under_review",
    icon: ClipboardCheck,
    roles: ["Admin", "Records Officer"],
  },
  {
    name: "For Disposal",
    href: "/records?status=for_disposal",
    icon: Trash2,
    roles: ["Admin", "Records Officer"],
  },
];

const settingsSubmenuItems: SidebarItem[] = [
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
    roles: ["Admin"],
  },
  {
    name: "System Settings",
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
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("iram_user");

    if (!storedUser) {
      setRoleName("");
      return;
    }

    try {
      const user = JSON.parse(storedUser);
      setRoleName(user?.role?.name || "");
    } catch {
      setRoleName("");
    }
  }, []);

  const visibleMainItems = useMemo(() => {
    if (!roleName) return [];

    return mainMenuItems.filter((item) =>
      item.roles.includes(roleName)
    );
  }, [roleName]);

  const visibleRecordItems = useMemo(() => {
    if (!roleName) return [];

    return recordSubmenuItems.filter((item) =>
      item.roles.includes(roleName)
    );
  }, [roleName]);

  const visibleSettingsItems = useMemo(() => {
    if (!roleName) return [];

    return settingsSubmenuItems.filter((item) =>
      item.roles.includes(roleName)
    );
  }, [roleName]);

  const canSeeRecordsGroup =
    roleName === "Admin" || roleName === "Records Officer";

  const canSeeSettingsGroup = roleName === "Admin";

  const currentStatus = searchParams.get("status");
  const currentScope = searchParams.get("scope");

  const recordsSectionActive =
    canSeeRecordsGroup &&
    pathname.startsWith("/records") &&
    currentScope !== "mine";

  const settingsSectionActive =
    canSeeSettingsGroup &&
    (pathname.startsWith("/admin/") ||
      pathname === "/profile");

  useEffect(() => {
    if (recordsSectionActive) {
      setRecordsOpen(true);
    }
  }, [recordsSectionActive]);

  useEffect(() => {
    if (settingsSectionActive) {
      setSettingsOpen(true);
    }
  }, [settingsSectionActive]);

  const primaryAction =
    roleName === "Staff"
      ? "New Submission"
      : "Add New Record";

  function isActive(href: string) {
    const [itemPath, queryString] = href.split("?");

    if (pathname !== itemPath) {
      if (!queryString) {
        return pathname.startsWith(`${itemPath}/`);
      }

      return false;
    }

    if (queryString) {
      const expectedParams = new URLSearchParams(queryString);

      return Array.from(expectedParams.entries()).every(
        ([key, value]) => searchParams.get(key) === value
      );
    }

    if (itemPath === "/records") {
      return !currentStatus && !currentScope;
    }

    return true;
  }

  function isRecordChildActive(href: string) {
    const [itemPath, queryString] = href.split("?");

    if (queryString) {
      if (pathname !== itemPath) return false;

      const expectedParams = new URLSearchParams(queryString);

      return Array.from(expectedParams.entries()).every(
        ([key, value]) => searchParams.get(key) === value
      );
    }

    if (href === "/records") {
      return (
        pathname === "/records" &&
        !currentStatus &&
        !currentScope
      );
    }

    if (href === "/records/create") {
      return pathname === "/records/create";
    }

    return pathname === itemPath;
  }

  function isSettingsChildActive(href: string) {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  }

  function renderMenuItem(item: SidebarItem) {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={onClose}
        className={`group relative flex min-h-10 items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 ${
          active
            ? "bg-[#6B0F2B] text-white shadow-md shadow-[#6B0F2B]/15"
            : "text-[#4B5563] hover:bg-white hover:text-[#075A3A] hover:shadow-sm hover:ring-1 hover:ring-[#DED5C5]"
        }`}
      >
        {active && (
          <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#D9961A]" />
        )}

        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all duration-200 ${
            active
              ? "bg-white/15 text-[#F4C25E]"
              : "bg-[#EAE5D9] text-[#075A3A] group-hover:bg-[#075A3A] group-hover:text-[#F4C25E]"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>

        <span className="truncate">{item.name}</span>

        {active && (
          <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#F4C25E] shadow-[0_0_0_3px_rgba(244,194,94,0.18)]" />
        )}
      </Link>
    );
  }

  function renderSubmenuItem(
    item: SidebarItem,
    active: boolean
  ) {
    const Icon = item.icon;

    return (
      <Link
        key={item.name}
        href={item.href}
        onClick={onClose}
        className={`group flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
          active
            ? "bg-[#FFF3D6] text-[#6B0F2B] ring-1 ring-[#E7C77F]"
            : "text-[#667085] hover:bg-white hover:text-[#075A3A]"
        }`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 transition-colors ${
            active
              ? "text-[#B87510]"
              : "text-[#8C938F] group-hover:text-[#075A3A]"
          }`}
        />

        <span className="truncate">{item.name}</span>

        {active && (
          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#D9961A]" />
        )}
      </Link>
    );
  }

  return (
    <>
      {open && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#17231E]/55 backdrop-blur-sm lg:hidden"
          aria-label="Close sidebar overlay"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-dvh w-[min(16.5rem,86vw)] flex-col border-r border-[#DED5C5] bg-[#F8F5EE] px-3 py-3.5 shadow-2xl shadow-black/10 transition-transform duration-300 lg:h-screen lg:w-64 lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-br from-[#075A3A] to-[#043D28] p-2.5 shadow-md shadow-[#075A3A]/15">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#D9961A]/15" />
            <div className="absolute -bottom-10 right-8 h-20 w-20 rounded-full border border-white/10" />

            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D9961A] text-white shadow-sm shadow-black/10 ring-1 ring-white/20">
              <Archive className="h-5 w-5" />
            </div>

            <div className="relative min-w-0">
              <h1 className="truncate text-xs font-extrabold tracking-wide text-white">
                IRAM Archive
              </h1>

              <p className="mt-0.5 truncate text-[10px] font-medium text-[#E7DDBE]">
                {roleName || "Records Management"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6B0F2B] transition hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-[#DED5C5] lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 px-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#9B8F7C]">
            Main Navigation
          </span>

          <span className="h-px flex-1 bg-gradient-to-r from-[#D7CDBB] to-transparent" />
        </div>

        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pb-3 pr-0.5">
          {visibleMainItems.map((item, index) => (
            <div key={item.name}>
              {index === 1 && canSeeRecordsGroup && (
                <div className="mb-1">
                  <button
                    type="button"
                    onClick={() =>
                      setRecordsOpen((current) => !current)
                    }
                    aria-expanded={recordsOpen}
                    className={`group relative flex min-h-10 w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 ${
                      recordsSectionActive
                        ? "bg-[#6B0F2B] text-white shadow-md shadow-[#6B0F2B]/15"
                        : "text-[#4B5563] hover:bg-white hover:text-[#075A3A] hover:shadow-sm hover:ring-1 hover:ring-[#DED5C5]"
                    }`}
                  >
                    {recordsSectionActive && (
                      <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#D9961A]" />
                    )}

                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all duration-200 ${
                        recordsSectionActive
                          ? "bg-white/15 text-[#F4C25E]"
                          : "bg-[#EAE5D9] text-[#075A3A] group-hover:bg-[#075A3A] group-hover:text-[#F4C25E]"
                      }`}
                    >
                      <Files className="h-4 w-4" />
                    </span>

                    <span className="truncate">Records</span>

                    <ChevronDown
                      className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${
                        recordsOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <div
                    className={`grid transition-all duration-200 ${
                      recordsOpen
                        ? "mt-1 grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="ml-4 space-y-0.5 border-l border-[#D7CDBB] pl-2.5">
                        {visibleRecordItems.map((recordItem) =>
                          renderSubmenuItem(
                            recordItem,
                            isRecordChildActive(recordItem.href)
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {renderMenuItem(item)}
            </div>
          ))}

          {canSeeSettingsGroup && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() =>
                  setSettingsOpen((current) => !current)
                }
                aria-expanded={settingsOpen}
                className={`group relative flex min-h-10 w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-all duration-200 ${
                  settingsSectionActive
                    ? "bg-[#6B0F2B] text-white shadow-md shadow-[#6B0F2B]/15"
                    : "text-[#4B5563] hover:bg-white hover:text-[#075A3A] hover:shadow-sm hover:ring-1 hover:ring-[#DED5C5]"
                }`}
              >
                {settingsSectionActive && (
                  <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#D9961A]" />
                )}

                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all duration-200 ${
                    settingsSectionActive
                      ? "bg-white/15 text-[#F4C25E]"
                      : "bg-[#EAE5D9] text-[#075A3A] group-hover:bg-[#075A3A] group-hover:text-[#F4C25E]"
                  }`}
                >
                  <Settings className="h-4 w-4" />
                </span>

                <span className="truncate">Settings</span>

                <ChevronDown
                  className={`ml-auto h-4 w-4 shrink-0 transition-transform duration-200 ${
                    settingsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <div
                className={`grid transition-all duration-200 ${
                  settingsOpen
                    ? "mt-1 grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="ml-4 space-y-0.5 border-l border-[#D7CDBB] pl-2.5">
                    {visibleSettingsItems.map((settingsItem) =>
                      renderSubmenuItem(
                        settingsItem,
                        isSettingsChildActive(
                          settingsItem.href
                        )
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </nav>

        <div className="border-t border-[#D7CDBB] pt-3">
          <Link
            href="/records/create"
            onClick={onClose}
            className="group flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#6B0F2B] to-[#7C1735] px-3 py-2 text-xs font-bold text-white shadow-md shadow-[#6B0F2B]/15 transition-all duration-200 hover:from-[#571023] hover:to-[#6B0F2B] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/25"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#D9961A] text-white transition-transform duration-200 group-hover:rotate-6">
              <FilePlus2 className="h-4 w-4" />
            </span>

            {primaryAction}
          </Link>

          <p className="mt-2 text-center text-[9px] font-medium uppercase tracking-[0.12em] text-[#A09582]">
            Record Acquisition & Archiving
          </p>
        </div>
      </aside>
    </>
  );
}