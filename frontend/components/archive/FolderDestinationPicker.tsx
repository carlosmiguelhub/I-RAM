"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderTree, Search } from "lucide-react";

export type FolderDestination = {
  id: number;
  name: string;
  path?: string;
  parent_id?: number | null;
  records_count?: number;
};

export default function FolderDestinationPicker({
  folders,
  value,
  onChange,
  disabled = false,
  allowUnfiled = false,
}: {
  folders: FolderDestination[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowUnfiled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = folders.find((folder) => String(folder.id) === value);
  const filteredFolders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...folders]
      .filter((folder) =>
        !query || (folder.path || folder.name).toLowerCase().includes(query)
      )
      .sort((left, right) =>
        (left.path || left.name).localeCompare(right.path || right.name)
      );
  }, [folders, search]);

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="relative mt-2">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-[#CFC4B1] bg-white px-3.5 py-2.5 text-left outline-none transition hover:border-[#9FBFAD] focus:border-[#075A3A] focus:ring-4 focus:ring-[#E6F2EC] disabled:cursor-not-allowed disabled:bg-[#F0ECE4] disabled:opacity-60"
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[#E6F2EC] text-[#075A3A]" : "bg-[#F0ECE4] text-[#766F63]"}`}>
          <FolderTree className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block break-words text-sm font-semibold [overflow-wrap:anywhere] ${selected ? "text-[#252A27]" : "text-[#766F63]"}`}>
            {selected?.name || (allowUnfiled && value === "" ? "Unfiled records" : "Choose a destination")}
          </span>
          <span className="mt-0.5 block break-words text-[11px] text-[#928875] [overflow-wrap:anywhere]">
            {selected?.path || (allowUnfiled && value === "" ? "Outside all archive folders" : "Select a folder or subfolder")}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#766F63] transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-xl border border-[#CFC4B1] bg-white shadow-lg">
          <div className="border-b border-[#E3DCCE] bg-[#FCFAF5] p-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A09582]" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
                placeholder="Search folders and subfolders..."
                className="min-h-10 w-full rounded-lg border border-[#E3DCCE] bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-[#075A3A] focus:ring-3 focus:ring-[#E6F2EC]"
              />
            </div>
          </div>
          <div role="listbox" className="max-h-64 overflow-y-auto p-1.5">
            {allowUnfiled && (
              <DestinationOption
                name="Unfiled records"
                path="Outside all archive folders"
                root
                selected={value === ""}
                onClick={() => choose("")}
              />
            )}
            {filteredFolders.map((folder) => (
              <DestinationOption
                key={folder.id}
                name={folder.name}
                path={folder.path || folder.name}
                root={!folder.parent_id}
                selected={String(folder.id) === value}
                count={folder.records_count}
                onClick={() => choose(String(folder.id))}
              />
            ))}
            {filteredFolders.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-[#766F63]">No matching folders.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DestinationOption({
  name,
  path,
  root,
  selected,
  count,
  onClick,
}: {
  name: string;
  path: string;
  root: boolean;
  selected: boolean;
  count?: number;
  onClick: () => void;
}) {
  const segments = path.split(" / ");
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${selected ? "bg-[#E6F2EC]" : "hover:bg-[#F8F5EE]"}`}
    >
      <Folder className={`mt-0.5 h-5 w-5 shrink-0 ${root ? "fill-[#D9961A] text-[#A66B00]" : "fill-[#CFE0D6] text-[#075A3A]"}`} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-start gap-2">
          <span className="min-w-0 flex-1 break-words text-sm font-semibold text-[#252A27] [overflow-wrap:anywhere]">{name}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${root ? "bg-[#FFF3D6] text-[#8B5A00]" : "bg-[#E6F2EC] text-[#075A3A]"}`}>
            {root ? "Folder" : "Subfolder"}
          </span>
        </span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-0.5 gap-y-1 text-[10px] text-[#766F63]">
          {segments.map((segment, index) => (
            <span key={`${segment}-${index}`} className="flex min-w-0 items-center gap-0.5">
              {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-[#B1A795]" />}
              <span className="break-words [overflow-wrap:anywhere]">{segment}</span>
            </span>
          ))}
        </span>
      </span>
      {typeof count === "number" && <span className="shrink-0 text-[10px] font-medium text-[#A09582]">{count} records</span>}
    </button>
  );
}
