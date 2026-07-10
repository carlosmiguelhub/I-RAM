"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";
import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Download,
  FileArchive,
  FileText,
  Folder,
  FolderArchive,
  FolderOpen,
  FolderPen,
  FolderPlus,
  Inbox,
  Loader2,
  MoreHorizontal,
  PackageOpen,
  Printer,
  Search,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";

type Folder = {
  id: number;
  name: string;
  description?: string | null;
  records_count: number;
};

type RecordFile = {
  id: number;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
};

type RecordItem = {
  id: number;
  record_code: string;
  title: string;
  description?: string | null;
  source?: string | null;
  remarks?: string | null;
  review_remarks?: string | null;
  correction_notes?: string | null;
  date_received?: string | null;
  archived_at?: string | null;
  storage_location?: string | null;
  category?: { name?: string | null } | null;
  department?: { name?: string | null } | null;
  creator?: { name?: string | null } | null;
  reviewer?: { name?: string | null } | null;
  archiver?: { name?: string | null } | null;
  archive_folder?: { id: number; name: string } | null;
  files?: RecordFile[];
};

export default function ArchivePage() {
  const router = useRouter();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [unfiledCount, setUnfiledCount] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);
  const [movingRecordId, setMovingRecordId] = useState<number | null>(null);

  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [openingRecordId, setOpeningRecordId] = useState<number | null>(null);
  const [recordModalError, setRecordModalError] = useState("");
  const [downloadingFileId, setDownloadingFileId] = useState<number | null>(
    null,
  );
  const [printingFileId, setPrintingFileId] = useState<number | null>(null);

  const selectedFolderName = useMemo(() => {
    if (selectedFolder === "unfiled") return "Unfiled";
    if (!selectedFolder) return "All Archived Records";
    return (
      folders.find((folder) => String(folder.id) === selectedFolder)?.name ||
      "Archive Folder"
    );
  }, [selectedFolder, folders]);

  async function loadFolders() {
    const data = await apiRequest("/archive/folders");
    setFolders(data.folders || []);
    setUnfiledCount(data.unfiled_count || 0);
  }

  async function loadRecords(folder = selectedFolder, searchValue = search) {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (folder) params.set("folder_id", folder);
      if (searchValue.trim()) params.set("search", searchValue.trim());

      const query = params.toString();
      const data = await apiRequest(
        query ? `/archive/records?${query}` : "/archive/records",
      );
      setRecords(data.data || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load archived records.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const meData = await apiRequest("/me");
        const role = meData.user?.role?.name;

        if (!["Admin", "Records Officer"].includes(role)) {
          router.replace("/dashboard");
          return;
        }

        await Promise.all([loadFolders(), loadRecords("", "")]);
      } catch {
        localStorage.removeItem("iram_token");
        localStorage.removeItem("iram_user");
        router.replace("/login");
      }
    }

    init();
  }, [router]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        openingRecordId === null &&
        downloadingFileId === null &&
        printingFileId === null
      ) {
        closeRecordModal();
      }
    }

    if (selectedRecord || openingRecordId !== null) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedRecord, openingRecordId, downloadingFileId, printingFileId]);

  async function openRecordModal(recordId: number) {
    setOpeningRecordId(recordId);
    setRecordModalError("");

    try {
      const data = await apiRequest(`/records/${recordId}`);
      setSelectedRecord(data.record);
    } catch (err: unknown) {
      setRecordModalError(
        err instanceof Error ? err.message : "Failed to load record details.",
      );
    } finally {
      setOpeningRecordId(null);
    }
  }

  function closeRecordModal() {
    if (
      openingRecordId !== null ||
      downloadingFileId !== null ||
      printingFileId !== null
    ) {
      return;
    }

    setSelectedRecord(null);
    setRecordModalError("");
  }

  async function fetchRecordFile(file: RecordFile) {
    const token = localStorage.getItem("iram_token");

    if (!token) {
      throw new Error("Your session has expired. Please log in again.");
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api"}/record-files/${file.id}/download`,
      {
        headers: {
          Accept: "application/octet-stream",
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      const contentType = response.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        const data = await response.json();
        throw new Error(data?.message || "Failed to retrieve the file.");
      }

      throw new Error(`File request failed with status ${response.status}.`);
    }

    return response.blob();
  }

  async function downloadFile(file: RecordFile) {
    setDownloadingFileId(file.id);
    setRecordModalError("");

    try {
      const blob = await fetchRecordFile(file);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = file.file_name || "archive-file";
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(objectUrl);
    } catch (err: unknown) {
      setRecordModalError(
        err instanceof Error ? err.message : "Failed to download the file.",
      );
    } finally {
      setDownloadingFileId(null);
    }
  }

  async function printFile(file: RecordFile) {
    setPrintingFileId(file.id);
    setRecordModalError("");

    try {
      if (!isBrowserPrintable(file)) {
        throw new Error(
          "This file type cannot be printed directly in the browser. Download it and print it from its application.",
        );
      }

      const blob = await fetchRecordFile(file);
      const objectUrl = URL.createObjectURL(blob);
      const printWindow = window.open(objectUrl, "_blank");

      if (!printWindow) {
        URL.revokeObjectURL(objectUrl);
        throw new Error(
          "The print window was blocked. Allow pop-ups and try again.",
        );
      }

      printWindow.addEventListener(
        "load",
        () => {
          printWindow.focus();
          printWindow.print();

          window.setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
          }, 60000);
        },
        { once: true },
      );
    } catch (err: unknown) {
      setRecordModalError(
        err instanceof Error ? err.message : "Failed to print the file.",
      );
    } finally {
      setPrintingFileId(null);
    }
  }

  function printRecordDetails() {
    if (!selectedRecord) return;

    const printWindow = window.open("", "_blank", "width=900,height=700");

    if (!printWindow) {
      setRecordModalError(
        "The print window was blocked. Allow pop-ups and try again.",
      );
      return;
    }

    const files = selectedRecord.files || [];

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(selectedRecord.record_code)} - Archive Record</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 40px; }
            h1 { margin: 0 0 4px; font-size: 24px; }
            .code { color: #64748b; margin-bottom: 24px; }
            .status { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #dcfce7; color: #166534; font-weight: 700; font-size: 12px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 24px; }
            .field { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
            .label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
            .value { margin-top: 4px; font-size: 14px; font-weight: 600; word-break: break-word; }
            .section { margin-top: 24px; }
            .section h2 { font-size: 16px; margin: 0 0 8px; }
            .section p { white-space: pre-wrap; line-height: 1.6; color: #334155; }
            ul { padding-left: 20px; }
            footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 11px; }
            @media print { body { margin: 18mm; } }
          </style>
        </head>
        <body>
          <span class="status">Archived</span>
          <h1>${escapeHtml(selectedRecord.title)}</h1>
          <div class="code">${escapeHtml(selectedRecord.record_code)}</div>

          <div class="grid">
            ${printField("Category", selectedRecord.category?.name || "N/A")}
            ${printField("Department", selectedRecord.department?.name || "N/A")}
            ${printField("Date Received", formatDate(selectedRecord.date_received))}
            ${printField("Archived Date", formatDate(selectedRecord.archived_at))}
            ${printField("Storage Location", selectedRecord.storage_location || "N/A")}
            ${printField("Archive Folder", selectedRecord.archive_folder?.name || "Unfiled")}
            ${printField("Source / Sender", selectedRecord.source || "N/A")}
            ${printField("Created By", selectedRecord.creator?.name || "N/A")}
            ${printField("Reviewed By", selectedRecord.reviewer?.name || "N/A")}
            ${printField("Archived By", selectedRecord.archiver?.name || "N/A")}
          </div>

          ${printSection("Description", selectedRecord.description)}
          ${printSection("Submission Remarks", selectedRecord.remarks)}
          ${printSection("Review Remarks", selectedRecord.review_remarks)}

          <div class="section">
            <h2>Attached Files (${files.length})</h2>
            ${
              files.length
                ? `<ul>${files
                    .map(
                      (file) =>
                        `<li>${escapeHtml(file.file_name)} (${escapeHtml(
                          formatFileSize(file.file_size),
                        )})</li>`,
                    )
                    .join("")}</ul>`
                : "<p>No attached files.</p>"
            }
          </div>

          <footer>
            Printed from IRAM on ${escapeHtml(
              new Date().toLocaleString("en-PH"),
            )}
          </footer>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  function chooseFolder(value: string) {
    setSelectedFolder(value);
    setSuccess("");
    loadRecords(value, search);
  }

  function openCreateFolder() {
    setEditingFolder(null);
    setFolderName("");
    setFolderDescription("");
    setShowFolderModal(true);
  }

  function openEditFolder(folder: Folder) {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderDescription(folder.description || "");
    setShowFolderModal(true);
  }

  async function saveFolder(event: React.FormEvent) {
    event.preventDefault();
    setSavingFolder(true);
    setError("");

    try {
      const endpoint = editingFolder
        ? `/archive/folders/${editingFolder.id}`
        : "/archive/folders";

      const data = await apiRequest(endpoint, {
        method: editingFolder ? "PATCH" : "POST",
        body: JSON.stringify({
          name: folderName.trim(),
          description: folderDescription.trim() || null,
        }),
      });

      setSuccess(data.message);
      setShowFolderModal(false);
      await loadFolders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save folder.");
    } finally {
      setSavingFolder(false);
    }
  }

  async function deleteFolder(folder: Folder) {
    const confirmed = window.confirm(
      `Delete "${folder.name}"? Archived records inside it will be moved to Unfiled.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const data = await apiRequest(`/archive/folders/${folder.id}`, {
        method: "DELETE",
      });

      const nextFolder =
        selectedFolder === String(folder.id) ? "unfiled" : selectedFolder;
      setSelectedFolder(nextFolder);
      setSuccess(data.message);
      await Promise.all([loadFolders(), loadRecords(nextFolder, search)]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete folder.");
    }
  }

  async function moveRecord(record: RecordItem, folderId: string) {
    setMovingRecordId(record.id);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest(`/archive/records/${record.id}/move`, {
        method: "PATCH",
        body: JSON.stringify({
          archive_folder_id: folderId ? Number(folderId) : null,
        }),
      });

      setSuccess(data.message);
      await Promise.all([loadFolders(), loadRecords(selectedFolder, search)]);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to move archived record.",
      );
    } finally {
      setMovingRecordId(null);
    }
  }

  return (
    <AppShell>
      <div className="w-full">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-7 sm:py-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-blue-100/70 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-emerald-100/60 blur-3xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-950/15 sm:flex">
                <Archive className="h-7 w-7" strokeWidth={1.8} />
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
                  <FolderArchive className="h-4 w-4" />
                  Archive Repository
                </div>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
                  Archived Documents
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-[15px]">
                  Organize completed records into folders while preserving their
                  official archived status and audit history.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openCreateFolder}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <FolderPlus className="h-4 w-4" />
              Create Folder
            </button>
          </div>
        </section>

        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <FolderOpen className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">
                      Archive Folders
                    </h2>
                    <p className="text-xs text-slate-500">
                      Organize stored records
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                  {folders.length}
                </span>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              <div className="mt-4 space-y-2">
                <FolderButton
                  active={selectedFolder === ""}
                  name="All Archived Records"
                  count={folders.reduce(
                    (total, folder) => total + folder.records_count,
                    unfiledCount,
                  )}
                  onClick={() => chooseFolder("")}
                />

                <FolderButton
                  active={selectedFolder === "unfiled"}
                  name="Unfiled"
                  count={unfiledCount}
                  onClick={() => chooseFolder("unfiled")}
                />

                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="rounded-xl border border-slate-200 p-2"
                  >
                    <button
                      type="button"
                      onClick={() => chooseFolder(String(folder.id))}
                      className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                        selectedFolder === String(folder.id)
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Folder
                          className={`h-4 w-4 shrink-0 ${selectedFolder === String(folder.id) ? "fill-blue-100 text-blue-600" : "text-slate-400 group-hover:text-blue-500"}`}
                        />
                        <span className="truncate">{folder.name}</span>
                      </span>
                      <span className="ml-3 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        {folder.records_count}
                      </span>
                    </button>

                    <div className="mt-1 flex items-center gap-1 px-1 pb-1">
                      <button
                        type="button"
                        onClick={() => openEditFolder(folder)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
                      >
<FolderPen className="h-3.5 w-3.5" />                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFolder(folder)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedFolderName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {records.length} record{records.length === 1 ? "" : "s"} on
                    this page
                  </p>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    loadRecords(selectedFolder, search);
                  }}
                  className="flex w-full gap-2 lg:max-w-md"
                >
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search title, code, category..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    />
                  </div>
                  <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
                    <Search className="h-4 w-4" />
                    <span className="hidden sm:inline">Search</span>
                  </button>
                </form>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              {loading ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/70 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    Loading archive records
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Retrieving the latest archived documents...
                  </p>
                </div>
              ) : records.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-10 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                    <PackageOpen className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 font-bold text-slate-900">
                    No archived records here
                  </h3>
                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    Archive a reviewed record, adjust your search, or select a
                    different folder.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {records.map((record) => (
                    <article
                      key={record.id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60"
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-emerald-500 opacity-0 transition group-hover:opacity-100" />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">
                            {record.title}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            {record.record_code}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200/70">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Archived
                        </span>
                      </div>

                      <div className="mt-4 space-y-2 text-xs text-slate-500">
                        <Info
                          label="Category"
                          value={record.category?.name || "N/A"}
                        />
                        <Info
                          label="Department"
                          value={record.department?.name || "N/A"}
                        />
                        <Info
                          label="Archived"
                          value={formatDate(record.archived_at)}
                        />
                        <Info
                          label="Files"
                          value={String(record.files?.length || 0)}
                        />
                      </div>

                      <div className="mt-5">
                        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          <ArchiveRestore className="h-3.5 w-3.5" />
                          Move to folder
                        </label>
                        <select
                          value={
                            record.archive_folder?.id
                              ? String(record.archive_folder.id)
                              : ""
                          }
                          disabled={movingRecordId === record.id}
                          onChange={(event) =>
                            moveRecord(record, event.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500"
                        >
                          <option value="">Unfiled</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => openRecordModal(record.id)}
                        disabled={openingRecordId !== null}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {openingRecordId === record.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />{" "}
                            Opening...
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4" /> Open Record{" "}
                            <ChevronRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </section>
      </div>

      {(selectedRecord || openingRecordId !== null) && (
        <ArchiveRecordModal
          record={selectedRecord}
          loading={openingRecordId !== null}
          error={recordModalError}
          downloadingFileId={downloadingFileId}
          printingFileId={printingFileId}
          onClose={closeRecordModal}
          onDownload={downloadFile}
          onPrintFile={printFile}
          onPrintDetails={printRecordDetails}
        />
      )}

      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={saveFolder}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                {editingFolder ? (
                  <FolderPen className="h-5 w-5" />
                ) : (
                  <FolderPlus className="h-5 w-5" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingFolder
                    ? "Edit Archive Folder"
                    : "Create Archive Folder"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {editingFolder
                    ? "Update this folder's name or description."
                    : "Create a folder to organize archived records."}
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Folder name
              <input
                autoFocus
                required
                maxLength={100}
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Description
              <textarea
                rows={4}
                maxLength={1000}
                value={folderDescription}
                onChange={(event) => setFolderDescription(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={savingFolder}
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingFolder
                  ? "Saving..."
                  : editingFolder
                    ? "Save Changes"
                    : "Create Folder"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function ArchiveRecordModal({
  record,
  loading,
  error,
  downloadingFileId,
  printingFileId,
  onClose,
  onDownload,
  onPrintFile,
  onPrintDetails,
}: {
  record: RecordItem | null;
  loading: boolean;
  error: string;
  downloadingFileId: number | null;
  printingFileId: number | null;
  onClose: () => void;
  onDownload: (file: RecordFile) => void;
  onPrintFile: (file: RecordFile) => void;
  onPrintDetails: () => void;
}) {
  const files = record?.files || [];
  const busy = loading || downloadingFileId !== null || printingFileId !== null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-record-title"
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[94vh] sm:max-w-6xl sm:rounded-3xl"
      >
        <header className="bg-gradient-to-r from-slate-950 to-slate-800 px-5 py-5 text-white sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-300">
                Archived Document
              </p>
              <h2
                id="archive-record-title"
                className="mt-1 truncate text-xl font-bold sm:text-2xl"
              >
                {record?.title || "Loading record..."}
              </h2>
              {record?.record_code && (
                <p className="mt-1 text-sm text-slate-300">
                  {record.record_code}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="Close archived record"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl font-semibold transition hover:bg-white/20 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {loading && !record ? (
            <div className="flex min-h-72 items-center justify-center rounded-2xl bg-slate-50 text-sm font-medium text-slate-500">
              Loading archived record...
            </div>
          ) : record ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <section className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Record Information
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Official metadata for this archived document.
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                      Archived
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ModalInfo
                      label="Category"
                      value={record.category?.name || "N/A"}
                    />
                    <ModalInfo
                      label="Department"
                      value={record.department?.name || "N/A"}
                    />
                    <ModalInfo
                      label="Date Received"
                      value={formatDate(record.date_received)}
                    />
                    <ModalInfo
                      label="Archived Date"
                      value={formatDate(record.archived_at)}
                    />
                    <ModalInfo
                      label="Storage Location"
                      value={record.storage_location || "N/A"}
                    />
                    <ModalInfo
                      label="Archive Folder"
                      value={record.archive_folder?.name || "Unfiled"}
                    />
                    <ModalInfo
                      label="Source / Sender"
                      value={record.source || "N/A"}
                    />
                    <ModalInfo
                      label="Created By"
                      value={record.creator?.name || "N/A"}
                    />
                    <ModalInfo
                      label="Reviewed By"
                      value={record.reviewer?.name || "N/A"}
                    />
                    <ModalInfo
                      label="Archived By"
                      value={record.archiver?.name || "N/A"}
                    />
                  </div>
                </section>

                <ModalTextSection
                  title="Description"
                  value={record.description}
                  emptyText="No description provided."
                />

                <ModalTextSection
                  title="Submission Remarks"
                  value={record.remarks}
                  emptyText="No submission remarks provided."
                />

                <ModalTextSection
                  title="Review Remarks"
                  value={record.review_remarks}
                  emptyText="No review remarks recorded."
                />
              </div>

              <aside className="space-y-5">
                <section className="rounded-2xl bg-slate-950 p-5 text-white">
                  <h3 className="text-lg font-bold">Archive Location</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    This record is filed under{" "}
                    <strong className="text-white">
                      {record.archive_folder?.name || "Unfiled"}
                    </strong>
                    .
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Storage location
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {record.storage_location || "Not specified"}
                  </p>
                </section>

                <section className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Documents
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Download or print attached files.
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {files.length}
                    </span>
                  </div>

                  {files.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">
                      No documents are attached to this record.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {files.map((file) => {
                        const downloading = downloadingFileId === file.id;
                        const printing = printingFileId === file.id;
                        const printable = isBrowserPrintable(file);

                        return (
                          <div
                            key={file.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">
                                {getFileExtension(file.file_name)}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p
                                  title={file.file_name}
                                  className="truncate text-sm font-semibold text-slate-900"
                                >
                                  {file.file_name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {formatFileSize(file.file_size)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => onDownload(file)}
                                disabled={busy}
                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                {downloading ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                                    Downloading...
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Download className="h-3.5 w-3.5" />{" "}
                                    Download
                                  </span>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => onPrintFile(file)}
                                disabled={busy || !printable}
                                title={
                                  printable
                                    ? "Print this file"
                                    : "Download this file and print it from its application"
                                }
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {printing ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                                    Opening...
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5">
                                    <Printer className="h-3.5 w-3.5" /> Print
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </aside>
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              The archived record could not be loaded.
            </div>
          )}
        </div>

        {record && (
          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              Close
            </button>

            <button
              type="button"
              onClick={onPrintDetails}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Print Record Details
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

function ModalInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function ModalTextSection({
  title,
  value,
  emptyText,
}: {
  title: string;
  value?: string | null;
  emptyText: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 p-5">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
        {value || emptyText}
      </p>
    </section>
  );
}

function isBrowserPrintable(file: RecordFile) {
  const type = (file.file_type || "").toLowerCase();
  const extension = file.file_name.split(".").pop()?.toLowerCase() || "";

  return (
    type === "application/pdf" ||
    type.startsWith("image/") ||
    ["pdf", "jpg", "jpeg", "png", "gif", "webp"].includes(extension)
  );
}

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toUpperCase() || "FILE";

  return extension.slice(0, 4);
}

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) {
    return "Unknown size";
  }

  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printField(label: string, value: string) {
  return `
    <div class="field">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
    </div>
  `;
}

function printSection(title: string, value?: string | null) {
  return `
    <div class="section">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(value || "None recorded.")}</p>
    </div>
  `;
}

function FolderButton({
  active,
  name,
  count,
  onClick,
}: {
  active: boolean;
  name: string;
  count: number;
  onClick: () => void;
}) {
  const Icon = name === "Unfiled" ? Inbox : FolderArchive;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${
        active
          ? "bg-slate-950 text-white shadow-md shadow-slate-950/15"
          : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon
          className={`h-4 w-4 shrink-0 ${active ? "text-blue-300" : "text-slate-400 group-hover:text-blue-600"}`}
        />
        <span className="truncate">{name}</span>
      </span>
      <span
        className={`ml-3 rounded-full px-2 py-0.5 text-xs font-bold ${active ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"}`}
      >
        {count}
      </span>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  const icons: Record<string, React.ElementType> = {
    Category: FileArchive,
    Department: UsersRound,
    Archived: CalendarDays,
    Files: FileText,
  };
  const Icon = icons[label] || MoreHorizontal;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="flex items-center gap-2 text-slate-500">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        {label}
      </span>
      <span className="max-w-[58%] truncate font-semibold text-slate-700">
        {value}
      </span>
    </div>
  );
}

function Alert({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "success";
}) {
  const Icon = tone === "error" ? CircleAlert : CheckCircle2;

  return (
    <div
      className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function formatDate(date?: string | null) {
  if (!date) return "N/A";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
