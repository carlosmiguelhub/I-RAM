"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ChevronRight,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Grid2X2,
  List,
  Loader2,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import ArchiveRecordModal, {
  type ArchiveRecord,
} from "@/components/archive/ArchiveRecordModal";
import { apiRequest } from "@/lib/api";

type FolderItem = {
  id: number;
  parent_id?: number | null;
  name: string;
  description?: string | null;
  path?: string;
  records_count: number;
  children_count?: number;
  updated_at?: string;
};

type ViewMode = "grid" | "list";

export default function ArchiveFolderBrowser({
  folderId,
}: {
  folderId?: string;
}) {
  const router = useRouter();
  const numericFolderId = folderId ? Number(folderId) : null;
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "list";
    return window.localStorage.getItem("archive-folder-view") === "grid"
      ? "grid"
      : "list";
  });
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [viewRecord, setViewRecord] = useState<ArchiveRecord | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const currentFolder = useMemo(
    () => folders.find((folder) => folder.id === numericFolderId) || null,
    [folders, numericFolderId]
  );

  const childFolders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return folders.filter((folder) => {
      const correctParent = numericFolderId
        ? folder.parent_id === numericFolderId
        : folder.parent_id == null;
      return (
        correctParent &&
        (!query ||
          folder.name.toLowerCase().includes(query) ||
          (folder.description || "").toLowerCase().includes(query))
      );
    });
  }, [folders, numericFolderId, search]);

  const breadcrumbs = useMemo(() => {
    if (!currentFolder) return [];
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const result: FolderItem[] = [];
    let cursor: FolderItem | undefined = currentFolder;
    const visited = new Set<number>();
    while (cursor && !visited.has(cursor.id)) {
      result.unshift(cursor);
      visited.add(cursor.id);
      cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
    }
    return result;
  }, [currentFolder, folders]);

  async function loadPage(searchValue = search) {
    setLoading(true);
    setError("");
    try {
      const meData = await apiRequest("/me");
      if (!["Admin", "Records Officer"].includes(meData.user?.role?.name)) {
        router.replace("/dashboard");
        return;
      }

      const requests: Promise<unknown>[] = [apiRequest("/archive/folders")];
      if (numericFolderId) {
        const query = new URLSearchParams({ folder_id: String(numericFolderId) });
        if (searchValue.trim()) query.set("search", searchValue.trim());
        requests.push(apiRequest(`/archive/records?${query.toString()}`));
      }
      const responses = await Promise.all(requests);
      const folderData = responses[0] as { folders?: FolderItem[] };
      const recordData = responses[1] as { data?: ArchiveRecord[] } | undefined;
      const nextFolders = folderData.folders || [];
      setFolders(nextFolders);
      setRecords(recordData?.data || []);
      if (numericFolderId && !nextFolders.some((item: FolderItem) => item.id === numericFolderId)) {
        setError("Archive folder not found.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load the archive folders.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPage(""), 0);
    return () => window.clearTimeout(timer);
  }, [folderId]);

  function changeView(mode: ViewMode) {
    setViewMode(mode);
    window.localStorage.setItem("archive-folder-view", mode);
  }

  function openCreate() {
    setEditingFolder(null);
    setName("");
    setDescription("");
    setError("");
    setShowFolderModal(true);
  }

  function openEdit(folder: FolderItem) {
    setEditingFolder(folder);
    setName(folder.name);
    setDescription(folder.description || "");
    setError("");
    setShowFolderModal(true);
  }

  async function saveFolder(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const data = await apiRequest(
        editingFolder ? `/archive/folders/${editingFolder.id}` : "/archive/folders",
        {
          method: editingFolder ? "PATCH" : "POST",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            ...(!editingFolder ? { parent_id: numericFolderId } : {}),
          }),
        }
      );
      setShowFolderModal(false);
      setSuccess(data.message || "Folder saved successfully.");
      await loadPage();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save the folder.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFolder(folder: FolderItem) {
    const contents = `${folder.children_count || 0} subfolder(s) and ${folder.records_count} record(s)`;
    if (!window.confirm(`Delete "${folder.name}"? It currently contains ${contents}.`)) return;
    setDeletingId(folder.id);
    setError("");
    try {
      const data = await apiRequest(`/archive/folders/${folder.id}`, { method: "DELETE" });
      setSuccess(data.message || "Folder deleted.");
      await loadPage();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete the folder.");
    } finally {
      setDeletingId(null);
    }
  }

  async function moveRecord(record: ArchiveRecord, destination: string) {
    setMovingId(record.id);
    setError("");
    try {
      const data = await apiRequest(`/archive/records/${record.id}/move`, {
        method: "PATCH",
        body: JSON.stringify({ archive_folder_id: destination ? Number(destination) : null }),
      });
      setSuccess(data.message || "Record moved successfully.");
      await loadPage();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to move the record.");
    } finally {
      setMovingId(null);
    }
  }

  async function openRecord(recordId: number) {
    setOpeningId(recordId);
    try {
      const data = await apiRequest(`/records/${recordId}`);
      setViewRecord(data.record);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to open the record.");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl pb-8">
        <header className="overflow-hidden rounded-xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-4 py-4 text-white shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#F4C25E]">Archive Repository</p>
              <h1 className="mt-1 text-xl font-extrabold">{currentFolder?.name || "Archive Folders"}</h1>
              <p className="mt-1 text-xs text-[#E5DDCC]">{currentFolder?.description || "Organize official records using folders and nested subfolders."}</p>
            </div>
            <button type="button" onClick={openCreate} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#6B0F2B] px-4 text-xs font-bold text-white hover:bg-[#571023]">
              <FolderPlus className="h-4 w-4" />
              {numericFolderId ? "New Subfolder" : "New Folder"}
            </button>
          </div>
        </header>

        <nav aria-label="Folder breadcrumb" className="mt-3 flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-[#E3DCCE] bg-white px-3 py-2 text-sm">
          <Link href="/archive/folders" className="shrink-0 font-semibold text-[#075A3A] hover:underline">Archive Folders</Link>
          {breadcrumbs.map((folder) => (
            <span key={folder.id} className="flex min-w-0 items-center gap-1">
              <ChevronRight className="h-4 w-4 shrink-0 text-[#A09582]" />
              <Link href={`/archive/folders/${folder.id}`} className="max-w-48 shrink-0 truncate font-medium text-[#514D46] hover:text-[#075A3A]">{folder.name}</Link>
            </span>
          ))}
        </nav>

        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <section className="mt-3 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#DED5C5]">
          <div className="flex flex-col gap-2 border-b border-[#E3DCCE] bg-[#FCFAF5] p-3 sm:flex-row sm:items-center">
            <form onSubmit={(event) => { event.preventDefault(); void loadPage(search); }} className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A09582]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder={numericFolderId ? "Search this folder..." : "Search folders..."} className="min-h-10 w-full rounded-lg border border-[#CFC4B1] bg-white py-2 pl-10 pr-3 text-sm font-medium text-[#252A27] caret-[#075A3A] outline-none placeholder:font-normal placeholder:text-[#766F63] focus:border-[#075A3A] focus:ring-4 focus:ring-[#E6F2EC]" />
            </form>
            <div className="flex rounded-lg border border-[#D7CDBB] bg-white p-1" aria-label="View options">
              <ViewButton active={viewMode === "list"} label="List view" onClick={() => changeView("list")}><List className="h-4 w-4" /></ViewButton>
              <ViewButton active={viewMode === "grid"} label="Grid view" onClick={() => changeView("grid")}><Grid2X2 className="h-4 w-4" /></ViewButton>
            </div>
          </div>

          <div className="p-3">
            {loading ? <LoadingState /> : (
              <>
                {childFolders.length > 0 && (
                  <div className={viewMode === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" : "overflow-x-auto rounded-lg border border-[#E3DCCE]"}>
                    {viewMode === "list" && <ListHeader />}
                    {childFolders.map((folder) => <FolderEntry key={folder.id} folder={folder} viewMode={viewMode} deleting={deletingId === folder.id} onEdit={() => openEdit(folder)} onDelete={() => void deleteFolder(folder)} />)}
                  </div>
                )}

                {numericFolderId && records.length > 0 && (
                  <div className={`${childFolders.length ? "mt-5" : ""} ${viewMode === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" : "overflow-x-auto rounded-lg border border-[#E3DCCE]"}`}>
                    {viewMode === "list" && <ListHeader records />}
                    {records.map((record) => <RecordEntry key={record.id} record={record} folders={folders} viewMode={viewMode} moving={movingId === record.id} opening={openingId === record.id} onMove={(destination) => void moveRecord(record, destination)} onOpen={() => void openRecord(record.id)} />)}
                  </div>
                )}

                {childFolders.length === 0 && records.length === 0 && <EmptyState nested={Boolean(numericFolderId)} onCreate={openCreate} />}
              </>
            )}
          </div>
        </section>
      </div>

      {showFolderModal && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-[#17231E]/70 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && !saving && setShowFolderModal(false)}>
          <form onSubmit={saveFolder} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-wider text-[#D9961A]">Folder Management</p><h2 className="mt-1 text-xl font-bold text-[#252A27]">{editingFolder ? "Rename Folder" : numericFolderId ? "Create Subfolder" : "Create Folder"}</h2></div>
              <button type="button" aria-label="Close" onClick={() => setShowFolderModal(false)} disabled={saving} className="rounded-lg p-2 text-[#766F63] hover:bg-[#F0ECE4]"><X className="h-5 w-5" /></button>
            </div>
            {!editingFolder && numericFolderId && <p className="mt-3 rounded-lg bg-[#F0F7F3] px-3 py-2 text-sm text-[#075A3A]">Location: {currentFolder?.path || currentFolder?.name}</p>}
            <label className="mt-5 block text-sm font-semibold text-[#514D46]">Folder name<input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter a clear folder name" className="mt-2 min-h-11 w-full rounded-lg border border-[#CFC4B1] bg-[#F8F5EE] px-3 font-medium text-[#252A27] caret-[#075A3A] outline-none placeholder:font-normal placeholder:text-[#766F63] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC]" /></label>
            <label className="mt-4 block text-sm font-semibold text-[#514D46]">Description (optional)<textarea rows={3} maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe what belongs in this folder" className="mt-2 w-full resize-none rounded-lg border border-[#CFC4B1] bg-[#F8F5EE] p-3 text-[#252A27] caret-[#075A3A] outline-none placeholder:text-[#766F63] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC]" /></label>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowFolderModal(false)} disabled={saving} className="rounded-lg border border-[#CFC4B1] bg-white px-4 py-2 text-sm font-semibold text-[#514D46] hover:bg-[#F8F5EE]">Cancel</button><button type="submit" disabled={saving || !name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#6B0F2B] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Saving..." : "Save Folder"}</button></div>
          </form>
        </div>
      )}

      {viewRecord && <ArchiveRecordModal record={viewRecord} loading={false} error="" onClose={() => setViewRecord(null)} onRecordUpdated={(updated) => { setViewRecord(updated); setRecords((items) => items.map((item) => item.id === updated.id ? updated : item)); }} />}
    </AppShell>
  );
}

function ViewButton({ active, label, onClick, children }: { active: boolean; label: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={active} onClick={onClick} className={`flex h-8 w-9 items-center justify-center rounded-md transition ${active ? "bg-[#D9EEF8] text-[#075A3A]" : "text-[#766F63] hover:bg-[#F0ECE4]"}`}>{children}</button>;
}

function ListHeader({ records = false }: { records?: boolean }) {
  return <div className="grid min-w-[720px] grid-cols-[minmax(240px,1fr)_130px_150px_220px_44px] border-b border-[#E3DCCE] bg-[#F8F5EE] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#766F63]"><span>Name</span><span>Type</span><span>Modified</span><span>{records ? "Move to" : "Contents"}</span><span /></div>;
}

function FolderEntry({ folder, viewMode, deleting, onEdit, onDelete }: { folder: FolderItem; viewMode: ViewMode; deleting: boolean; onEdit: () => void; onDelete: () => void }) {
  if (viewMode === "grid") return <article className="rounded-xl border border-[#E3DCCE] p-4 hover:border-[#B9D5C5] hover:shadow-sm"><div className="flex items-start justify-between"><Link href={`/archive/folders/${folder.id}`} className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E6F2EC] text-[#D9961A]"><FolderOpen className="h-6 w-6" /></Link><FolderActions deleting={deleting} onEdit={onEdit} onDelete={onDelete} /></div><Link href={`/archive/folders/${folder.id}`} className="mt-3 block truncate font-bold text-[#252A27] hover:text-[#075A3A]">{folder.name}</Link><p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-[#766F63]">{folder.description || "No description"}</p><p className="mt-3 text-xs font-medium text-[#A09582]">{folder.children_count || 0} folders · {folder.records_count} records</p></article>;
  return <div className="grid min-w-[720px] grid-cols-[minmax(240px,1fr)_130px_150px_220px_44px] items-center border-b border-[#EEE8DD] px-3 py-2.5 text-sm last:border-0 hover:bg-[#FCFAF5]"><Link href={`/archive/folders/${folder.id}`} className="flex min-w-0 items-center gap-3 font-semibold text-[#252A27] hover:text-[#075A3A]"><Folder className="h-5 w-5 shrink-0 fill-[#D9961A] text-[#A66B00]" /><span className="truncate">{folder.name}</span></Link><span className="text-[#766F63]">Folder</span><span className="text-[#766F63]">{formatDate(folder.updated_at)}</span><span className="text-[#766F63]">{folder.children_count || 0} folders, {folder.records_count} records</span><FolderActions deleting={deleting} onEdit={onEdit} onDelete={onDelete} /></div>;
}

function FolderActions({ deleting, onEdit, onDelete }: { deleting: boolean; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return <div className="relative"><button type="button" aria-label="Folder actions" title="Folder actions" onClick={() => setOpen(!open)} disabled={deleting} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D7CDBB] bg-white text-[#3F4541] shadow-sm transition hover:border-[#075A3A] hover:bg-[#E6F2EC] hover:text-[#075A3A] focus:outline-none focus:ring-4 focus:ring-[#E6F2EC]">{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-5 w-5 stroke-[2.5]" />}</button>{open && <div className="absolute right-0 top-10 z-20 w-36 rounded-lg border border-[#CFC4B1] bg-white p-1.5 text-[#252A27] shadow-xl"><button type="button" onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#3F4541] hover:bg-[#F8F5EE]"><Pencil className="h-3.5 w-3.5 text-[#075A3A]" />Rename</button><button type="button" onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" />Delete</button></div>}</div>;
}

function RecordEntry({ record, folders, viewMode, moving, opening, onMove, onOpen }: { record: ArchiveRecord; folders: FolderItem[]; viewMode: ViewMode; moving: boolean; opening: boolean; onMove: (id: string) => void; onOpen: () => void }) {
  const select = <select value={record.archive_folder?.id ? String(record.archive_folder.id) : ""} disabled={moving} onChange={(event) => onMove(event.target.value)} className="min-h-9 w-full rounded-lg border border-[#CFC4B1] bg-white px-2 text-xs font-medium text-[#252A27] outline-none focus:border-[#075A3A] focus:ring-4 focus:ring-[#E6F2EC] disabled:bg-[#F0ECE4] disabled:text-[#766F63]"><option value="">Unfiled</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.path || folder.name}</option>)}</select>;
  if (viewMode === "grid") return <article className="rounded-xl border border-[#E3DCCE] p-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F8E9EE] text-[#6B0F2B]"><FileText className="h-6 w-6" /></div><h3 className="mt-3 line-clamp-2 min-h-10 font-bold text-[#252A27]">{record.title}</h3><p className="mt-1 text-xs text-[#766F63]">{record.record_code}</p><div className="mt-3">{select}</div><button type="button" onClick={onOpen} disabled={opening || moving} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#6B0F2B] text-xs font-bold text-white disabled:opacity-50">{opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}View Record</button></article>;
  return <div className="grid min-w-[720px] grid-cols-[minmax(240px,1fr)_130px_150px_220px_44px] items-center border-b border-[#EEE8DD] px-3 py-2.5 text-sm last:border-0 hover:bg-[#FCFAF5]"><button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-3 text-left font-semibold text-[#252A27] hover:text-[#075A3A]"><FileText className="h-5 w-5 shrink-0 text-[#6B0F2B]" /><span className="min-w-0"><span className="block truncate">{record.title}</span><span className="block truncate text-[11px] font-normal text-[#766F63]">{record.record_code}</span></span></button><span className="text-[#766F63]">Record</span><span className="text-[#766F63]">{formatDate(record.archived_at)}</span><div>{select}</div><button type="button" aria-label="View record" title="View record" onClick={onOpen} disabled={opening} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#D7CDBB] bg-white text-[#6B0F2B] shadow-sm transition hover:border-[#6B0F2B] hover:bg-[#F8E9EE] focus:outline-none focus:ring-4 focus:ring-[#F8E9EE] disabled:opacity-50">{opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-5 w-5 stroke-[2.5]" />}</button></div>;
}

function LoadingState() { return <div className="flex min-h-56 flex-col items-center justify-center rounded-xl bg-[#F8F5EE]"><Loader2 className="h-7 w-7 animate-spin text-[#075A3A]" /><p className="mt-3 text-sm text-[#766F63]">Loading archive contents...</p></div>; }
function EmptyState({ nested, onCreate }: { nested: boolean; onCreate: () => void }) { return <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-[#D7CDBB] bg-[#F8F5EE] px-5 text-center"><Archive className="h-8 w-8 text-[#A09582]" /><h2 className="mt-3 font-bold text-[#252A27]">{nested ? "This folder is empty" : "No archive folders yet"}</h2><p className="mt-1 text-sm text-[#766F63]">Create {nested ? "a subfolder" : "your first folder"} to begin organizing records.</p><button type="button" onClick={onCreate} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#075A3A] px-4 py-2 text-sm font-bold text-white"><FolderPlus className="h-4 w-4" />Create {nested ? "Subfolder" : "Folder"}</button></div>; }
function Alert({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) { return <div role={tone === "error" ? "alert" : "status"} className={`mt-3 rounded-xl border px-4 py-3 text-sm font-medium ${tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{children}</div>; }
function formatDate(date?: string | null) { if (!date) return "—"; const parsed = new Date(date); return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }); }
