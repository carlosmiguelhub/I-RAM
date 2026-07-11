"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Eye,
  Folder,
  FolderInput,
  FolderOpen,
  Loader2,
  Search,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import ArchiveRecordModal, {
  type ArchiveRecord,
} from "@/components/archive/ArchiveRecordModal";
import { apiRequest } from "@/lib/api";

type FolderItem = {
  id: number;
  name: string;
  records_count: number;
};

type RecordCard = ArchiveRecord;

export default function ArchiveUnfiledPage() {
  const router = useRouter();

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [records, setRecords] = useState<RecordCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [moveRecordItem, setMoveRecordItem] =
    useState<RecordCard | null>(null);
  const [targetFolderId, setTargetFolderId] = useState("");
  const [moving, setMoving] = useState(false);

  const [viewRecord, setViewRecord] =
    useState<ArchiveRecord | null>(null);
  const [openingRecordId, setOpeningRecordId] =
    useState<number | null>(null);
  const [viewError, setViewError] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const totalFoldered = useMemo(
    () =>
      folders.reduce(
        (sum, folder) => sum + folder.records_count,
        0
      ),
    [folders]
  );

  async function loadPage(searchValue = search) {
    setLoading(true);
    setError("");

    try {
      const meData = await apiRequest("/me");
      const role = meData.user?.role?.name;

      if (!["Admin", "Records Officer"].includes(role)) {
        router.replace("/dashboard");
        return;
      }

      const params = new URLSearchParams({
        folder_id: "unfiled",
      });

      if (searchValue.trim()) {
        params.set("search", searchValue.trim());
      }

      const [folderData, recordData] = await Promise.all([
        apiRequest("/archive/folders"),
        apiRequest(`/archive/records?${params.toString()}`),
      ]);

      setFolders(folderData.folders || []);
      setRecords(recordData.data || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load the archive repository."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage("");
  }, []);

  async function openRecord(recordId: number) {
    setOpeningRecordId(recordId);
    setViewRecord(null);
    setViewError("");

    try {
      const data = await apiRequest(`/records/${recordId}`);
      setViewRecord(data.record);
    } catch (err: unknown) {
      setViewError(
        err instanceof Error
          ? err.message
          : "Failed to load archived record details."
      );
    } finally {
      setOpeningRecordId(null);
    }
  }

  function closeRecordModal() {
    if (openingRecordId !== null) return;

    setViewRecord(null);
    setViewError("");
  }

  function openMoveModal(record: RecordCard) {
    setMoveRecordItem(record);
    setTargetFolderId("");
    setError("");
    setSuccess("");
  }

  function closeMoveModal() {
    if (moving) return;

    setMoveRecordItem(null);
    setTargetFolderId("");
  }

  async function moveRecord() {
    if (!moveRecordItem || !targetFolderId) {
      setError("Choose an archive folder first.");
      return;
    }

    setMoving(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest(
        `/archive/records/${moveRecordItem.id}/move`,
        {
          method: "PATCH",
          body: JSON.stringify({
            archive_folder_id: Number(targetFolderId),
          }),
        }
      );

      setSuccess(
        data.message || "Record moved successfully."
      );
      setMoveRecordItem(null);
      setTargetFolderId("");
      await loadPage(search);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to move the archived record."
      );
    } finally {
      setMoving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Archive Repository
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Unfiled Records
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Newly archived records appear here until they are
              organized into an archive folder.
            </p>
          </div>

          <Link
            href="/archive/folders"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
          >
            <FolderOpen className="h-4 w-4" />
            Manage Folders
          </Link>
        </header>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Unfiled"
            value={records.length}
            icon={<Archive className="h-5 w-5" />}
          />
          <SummaryCard
            label="Folders"
            value={folders.length}
            icon={<Folder className="h-5 w-5" />}
          />
          <SummaryCard
            label="Records in Folders"
            value={totalFoldered}
            icon={<FolderInput className="h-5 w-5" />}
          />
        </section>

        {error && <Alert tone="error">{error}</Alert>}
        {success && (
          <Alert tone="success">{success}</Alert>
        )}

        <section className="mt-5 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                loadPage(search);
              }}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search title, record code, category..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />
              </div>

              <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>
          </div>

          <div className="p-4 sm:p-5">
            {loading ? (
              <LoadingState />
            ) : records.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {records.map((record) => (
                  <article
                    key={record.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-bold text-slate-950">
                          {record.title}
                        </h2>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {record.record_code}
                        </p>
                      </div>

                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                        Archived
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
                      <InfoLine
                        label="Category"
                        value={record.category?.name || "N/A"}
                      />
                      <InfoLine
                        label="Department"
                        value={record.department?.name || "N/A"}
                      />
                      <InfoLine
                        label="Archived"
                        value={formatDate(record.archived_at)}
                      />
                      <InfoLine
                        label="Files"
                        value={String(
                          record.files?.length || 0
                        )}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openRecord(record.id)}
                        disabled={openingRecordId !== null}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {openingRecordId === record.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        {openingRecordId === record.id
                          ? "Loading"
                          : "View Record"}
                      </button>

                      <button
                        type="button"
                        onClick={() => openMoveModal(record)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        <FolderInput className="h-4 w-4" />
                        Organize
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {(viewRecord || openingRecordId !== null) && (
        <ArchiveRecordModal
          record={viewRecord}
          loading={openingRecordId !== null}
          error={viewError}
          onClose={closeRecordModal}
        />
      )}

      {moveRecordItem && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMoveModal();
            }
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-600">
                  Organize Record
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Move to folder
                </h2>
              </div>

              <button
                type="button"
                onClick={closeMoveModal}
                disabled={moving}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">
                {moveRecordItem.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {moveRecordItem.record_code}
              </p>
            </div>

            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Archive folder
              <select
                value={targetFolderId}
                onChange={(event) =>
                  setTargetFolderId(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
              >
                <option value="">Choose a folder</option>
                {folders.map((folder) => (
                  <option
                    key={folder.id}
                    value={folder.id}
                  >
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>

            {folders.length === 0 && (
              <p className="mt-3 text-sm text-amber-700">
                No folders exist yet. Create one from Folder
                Management first.
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeMoveModal}
                disabled={moving}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={moveRecord}
                disabled={moving || !targetFolderId}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {moving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {moving ? "Moving..." : "Move Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">
          {label}
        </p>
        <p className="mt-0.5 text-xl font-bold text-slate-950">
          {value}
        </p>
      </div>
    </div>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="truncate font-semibold text-slate-700">
        {value}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-slate-50">
      <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
      <p className="mt-3 text-sm font-medium text-slate-500">
        Loading unfiled records...
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
      <Archive className="h-8 w-8 text-slate-400" />
      <h3 className="mt-4 font-bold text-slate-900">
        No unfiled records
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Newly archived records will appear here before they are
        assigned to a folder.
      </p>
    </div>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-medium ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {children}
    </div>
  );
}

function formatDate(date?: string | null) {
  if (!date) return "N/A";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
