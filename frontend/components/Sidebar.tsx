"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
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
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Tags,
  Trash2,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import type { AuthUser } from "@/lib/types";

type SidebarItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
};

const allRoles = ["Admin", "Records Officer", "Staff"];
const managerRoles = ["Admin", "Records Officer"];

const workspaceItems: SidebarItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Gauge,
    roles: allRoles,
  },
  {
    name: "My Document Records",
    href: "/records",
    icon: FileUser,
    roles: ["Staff"],
  },
  {
    name: "My Document Requests",
    href: "/document-requests",
    icon: ClipboardList,
    roles: ["Staff"],
  },
  {
    name: "Document Requests",
    href: "/document-requests",
    icon: ClipboardList,
    roles: managerRoles,
  },
  {
    name: "Archive Repository",
    href: "/archive",
    icon: FolderArchive,
    roles: managerRoles,
  },
  {
    name: "For Disposal",
    href: "/disposal",
    icon: Trash2,
    roles: managerRoles,
  },
];

const repositoryItems: SidebarItem[] = [
  {
    name: "Archive Catalog",
    href: "/archive-catalog",
    icon: BookOpen,
    roles: ["Staff"],
  },
];

const personalItems: SidebarItem[] = [
  {
    name: "My Submissions",
    href: "/records?scope=mine",
    icon: FileUser,
    roles: managerRoles,
  },
];

const recordsItems: SidebarItem[] = [
  {
    name: "All Records",
    href: "/records",
    icon: Files,
    roles: managerRoles,
  },
  {
    name: "Add Record",
    href: "/records/create",
    icon: FilePlus2,
    roles: managerRoles,
  },
  {
    name: "Under Review",
    href: "/records?status=under_review",
    icon: ClipboardCheck,
    roles: managerRoles,
  },
];

const administrationItems: SidebarItem[] = [
  {
    name: "Audit Trail",
    href: "/audit-trail",
    icon: History,
    roles: managerRoles,
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
    name: "System Settings",
    href: "/admin/settings",
    icon: Settings,
    roles: ["Admin"],
  },
];

export default function Sidebar({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
}: {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [administrationOpen, setAdministrationOpen] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedUser = localStorage.getItem("iram_user");

      if (!storedUser) {
        setUser(null);
        return;
      }

      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const roleName = user?.role?.name || "";
  const visibleWorkspaceItems = useMemo(
    () =>
      workspaceItems.filter((item) =>
        item.roles.includes(roleName)
      ),
    [roleName]
  );
  const visibleRecordsItems = useMemo(
    () =>
      recordsItems.filter((item) =>
        item.roles.includes(roleName)
      ),
    [roleName]
  );
  const visibleRepositoryItems = useMemo(
    () =>
      repositoryItems.filter((item) =>
        item.roles.includes(roleName)
      ),
    [roleName]
  );
  const visiblePersonalItems = useMemo(
    () =>
      personalItems.filter((item) =>
        item.roles.includes(roleName)
      ),
    [roleName]
  );
  const visibleAdministrationItems = useMemo(
    () =>
      administrationItems.filter((item) =>
        item.roles.includes(roleName)
      ),
    [roleName]
  );

  const currentStatus = searchParams.get("status");
  const currentScope = searchParams.get("scope");
  const primaryAction =
    roleName === "Staff" ? "New Submission" : "Add New Record";

  function isActive(href: string) {
    const [itemPath, queryString] = href.split("?");

    if (pathname !== itemPath) {
      return !queryString && pathname.startsWith(`${itemPath}/`);
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

  return (
    <>
      {open && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[#15231D]/45 backdrop-blur-[2px] lg:hidden"
          aria-label="Close navigation overlay"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-[#E0D9CC] bg-[#F7F5F1] shadow-2xl transition-[width,transform] duration-300 ease-out dark:border-[#26354A] dark:bg-[#0D1728] lg:translate-x-0 lg:shadow-none ${
          collapsed ? "lg:w-[4.75rem]" : "lg:w-64"
        } ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="absolute -right-3.5 top-5 hidden h-7 w-7 items-center justify-center rounded-full border border-[#DAD4C9] bg-white text-[#676D68] shadow-md transition hover:scale-105 hover:border-[#075A3A] hover:text-[#075A3A] dark:border-[#33445E] dark:bg-[#172337] dark:text-[#B9C5D5] lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" />
          )}
        </button>

        <div
          className={`border-b border-[#E2DED6] p-3 dark:border-[#26354A] ${
            collapsed ? "lg:px-2" : ""
          }`}
        >
          <div className="flex items-center gap-1">
            <Link
              href="/profile"
              onClick={onClose}
              title={collapsed ? user?.name || "Profile" : undefined}
              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl p-1.5 transition hover:bg-white dark:hover:bg-white/5 ${
                collapsed ? "lg:justify-center" : ""
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#075A3A] text-xs font-extrabold uppercase text-white">
                {initials(user?.name)}
              </span>
              <span
                className={`min-w-0 overflow-hidden transition-[opacity,width] duration-200 ${
                  collapsed
                    ? "lg:w-0 lg:opacity-0"
                    : "lg:w-auto lg:opacity-100"
                }`}
              >
                <span className="block truncate text-sm font-bold text-[#252A27]">
                  {user?.name || "IRAM User"}
                </span>
                <span className="block truncate text-[11px] text-[#817B72]">
                  {roleName || "Records Management"}
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6B0F2B] hover:bg-white lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <Link
            href="/records/create"
            onClick={onClose}
            title={collapsed ? primaryAction : undefined}
            className={`mt-3 flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#571023] hover:shadow-md ${
              collapsed ? "lg:px-0" : "px-3"
            }`}
          >
            <FilePlus2 className="h-4 w-4 shrink-0" />
            <span
              className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${
                collapsed
                  ? "lg:max-w-0 lg:opacity-0"
                  : "lg:max-w-40 lg:opacity-100"
              }`}
            >
              {primaryAction}
            </span>
          </Link>
        </div>

        <nav
          className={`flex-1 overflow-x-hidden overflow-y-auto py-3 ${
            collapsed ? "px-3 lg:px-2" : "px-3"
          }`}
        >
          <MenuSection label="Workspace" collapsed={collapsed}>
            {visibleWorkspaceItems.map((item) => (
              <NavigationItem
                key={item.name}
                item={item}
                active={isActive(item.href)}
                collapsed={collapsed}
                onClick={onClose}
              />
            ))}
          </MenuSection>

          {visibleRepositoryItems.length > 0 && (
            <MenuSection
              label="Records Repository"
              collapsed={collapsed}
            >
              {visibleRepositoryItems.map((item) => (
                <NavigationItem
                  key={item.name}
                  item={item}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                  onClick={onClose}
                />
              ))}
            </MenuSection>
          )}

          {visiblePersonalItems.length > 0 && (
            <MenuSection label="My Activity" collapsed={collapsed}>
              {visiblePersonalItems.map((item) => (
                <NavigationItem
                  key={item.name}
                  item={item}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                  onClick={onClose}
                />
              ))}
            </MenuSection>
          )}

          {visibleRecordsItems.length > 0 && (
            <MenuSection label="Records" collapsed={collapsed}>
              {visibleRecordsItems.map((item) => (
                <NavigationItem
                  key={item.name}
                  item={item}
                  active={isActive(item.href)}
                  collapsed={collapsed}
                  onClick={onClose}
                />
              ))}
            </MenuSection>
          )}

          {visibleAdministrationItems.length > 0 && (
            <section className="mb-5 last:mb-0">
              <button
                type="button"
                onClick={() =>
                  setAdministrationOpen((current) => !current)
                }
                aria-expanded={administrationOpen}
                title={
                  collapsed ? "Administration" : undefined
                }
                className={`mb-1 flex min-h-8 w-full items-center rounded-lg px-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9A9388] transition hover:bg-white hover:text-[#075A3A] dark:hover:bg-white/5 ${
                  collapsed
                    ? "lg:justify-center lg:px-0"
                    : "justify-between"
                }`}
              >
                <span className={collapsed ? "lg:hidden" : ""}>
                  Administration
                </span>
                {collapsed ? (
                  <Settings className="hidden h-4 w-4 lg:block" />
                ) : (
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      administrationOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              <div
                className={`grid transition-[grid-template-rows,opacity] duration-250 ease-out ${
                  administrationOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-0.5">
                    {visibleAdministrationItems.map((item) => (
                      <NavigationItem
                        key={item.name}
                        item={item}
                        active={isActive(item.href)}
                        collapsed={collapsed}
                        onClick={onClose}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
        </nav>

        <div
          className={`border-t border-[#E2DED6] p-3 dark:border-[#26354A] ${
            collapsed ? "lg:px-2" : ""
          }`}
        >
          <Link
            href="/profile"
            onClick={onClose}
            title={collapsed ? "Profile & Security" : undefined}
            className={`flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 text-sm font-semibold transition ${
              collapsed ? "lg:justify-center lg:px-0" : ""
            } ${
              pathname === "/profile"
                ? "bg-[#E8E5DF] text-[#075A3A] dark:bg-[#1C2A40] dark:text-[#78D6A7]"
                : "text-[#555C57] hover:bg-white hover:text-[#075A3A] dark:text-[#B9C5D5] dark:hover:bg-white/5"
            }`}
          >
            <UserCircle2 className="h-[1.1rem] w-[1.1rem] shrink-0" />
            <span
              className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${
                collapsed
                  ? "lg:max-w-0 lg:opacity-0"
                  : "lg:max-w-40 lg:opacity-100"
              }`}
            >
              Profile & Security
            </span>
          </Link>
          <p
            className={`mt-3 px-2.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#A49D91] ${
              collapsed ? "lg:hidden" : ""
            }`}
          >
            IRAM Records System
          </p>
        </div>
      </aside>
    </>
  );
}

function MenuSection({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 last:mb-0">
      <p
        className={`mb-1.5 px-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#9A9388] ${
          collapsed ? "lg:hidden" : ""
        }`}
      >
        {label}
      </p>
      {collapsed && (
        <div className="mx-auto mb-2 hidden h-px w-7 bg-[#DDD7CC] dark:bg-[#33445E] lg:block" />
      )}
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function NavigationItem({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: SidebarItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.name : undefined}
      aria-label={collapsed ? item.name : undefined}
      className={`group flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold transition hover:translate-x-0.5 ${
        collapsed ? "lg:justify-center lg:px-0" : ""
      } ${
        active
          ? "bg-[#E4E2DE] text-[#075A3A] dark:bg-[#1C2A40] dark:text-[#78D6A7]"
          : "text-[#4F5651] hover:bg-white hover:text-[#075A3A] dark:text-[#B9C5D5] dark:hover:bg-white/5 dark:hover:text-[#78D6A7]"
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition ${
          active
            ? "bg-white text-[#6B0F2B] shadow-sm dark:bg-[#273750] dark:text-[#F1C768]"
            : "text-[#727973] group-hover:text-[#075A3A]"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span
        className={`truncate whitespace-nowrap transition-[max-width,opacity] duration-200 ${
          collapsed
            ? "lg:max-w-0 lg:opacity-0"
            : "lg:max-w-40 lg:opacity-100"
        }`}
      >
        {item.name}
      </span>
      {active && (
        <span
          className={`ml-auto h-1.5 w-1.5 rounded-full bg-[#D9961A] ${
            collapsed ? "lg:hidden" : ""
          }`}
        />
      )}
    </Link>
  );
}

function initials(name?: string | null) {
  const parts = (name || "User").trim().split(/\s+/);

  return `${parts[0]?.[0] || "U"}${parts[1]?.[0] || ""}`.toUpperCase();
}
