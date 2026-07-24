"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const savedState = localStorage.getItem(
        "iram_sidebar_collapsed"
      );
      setSidebarCollapsed(savedState === "true");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      localStorage.setItem("iram_sidebar_collapsed", String(next));
      return next;
    });
  }

  return (
    <div className="iram-shell min-h-screen w-full overflow-x-hidden bg-[#FBFAF8] transition-colors dark:bg-[#07101F]">
      <Suspense fallback={null}>
        <Sidebar
          open={sidebarOpen}
          collapsed={sidebarCollapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={toggleSidebar}
        />
      </Suspense>

      <div
        className={`min-h-screen w-full transition-[padding] duration-300 ease-out ${
          sidebarCollapsed ? "lg:pl-[4.75rem]" : "lg:pl-64"
        }`}
      >
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="w-full max-w-full overflow-x-hidden px-4 py-5 sm:px-6 lg:px-7 lg:py-6 xl:px-8">
          <div key={pathname} className="iram-page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
