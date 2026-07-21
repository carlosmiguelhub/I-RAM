"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Grid2X2, List } from "lucide-react";

export type ViewMode = "grid" | "list";

export function usePersistentViewMode(
  storageKey: string,
  defaultMode: ViewMode
) {
  const eventName = `view-mode:${storageKey}`;
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange);
    window.addEventListener(eventName, onStoreChange);
    return () => {
      window.removeEventListener("storage", onStoreChange);
      window.removeEventListener(eventName, onStoreChange);
    };
  }, [eventName]);
  const getSnapshot = useCallback((): ViewMode => {
    const savedMode = window.localStorage.getItem(storageKey);
    return savedMode === "grid" || savedMode === "list"
      ? savedMode
      : defaultMode;
  }, [defaultMode, storageKey]);
  const getServerSnapshot = useCallback(
    (): ViewMode => defaultMode,
    [defaultMode]
  );
  const viewMode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  function changeView(mode: ViewMode) {
    window.localStorage.setItem(storageKey, mode);
    window.dispatchEvent(new Event(eventName));
  }

  return [viewMode, changeView] as const;
}

export default function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 items-center rounded-lg border border-[#D7CDBB] bg-white p-1 shadow-sm"
      role="group"
      aria-label="Choose how records are displayed"
    >
      <ViewButton
        active={value === "list"}
        label="List view"
        onClick={() => onChange("list")}
      >
        <List className="h-4 w-4" />
      </ViewButton>
      <ViewButton
        active={value === "grid"}
        label="Grid view"
        onClick={() => onChange("grid")}
      >
        <Grid2X2 className="h-4 w-4" />
      </ViewButton>
    </div>
  );
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#CFE0D6] ${
        active
          ? "bg-[#E6F2EC] text-[#075A3A]"
          : "text-[#766F63] hover:bg-[#F0ECE4]"
      }`}
    >
      {children}
      <span className="hidden sm:inline">{label.replace(" view", "")}</span>
    </button>
  );
}
