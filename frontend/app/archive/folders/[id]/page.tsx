"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  FolderInput,
  Loader2,
  Search,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import ArchiveRecordModal, {
  type ArchiveRecord,
} from "@/components/archive/ArchiveRecordModal";
import { apiRequest } from "@/lib/api";

type FolderItem = {
  id: number;
  name: string;
  description?: string | null;
  records_count: number;
};

type RecordCard = ArchiveRecord;

export default function ArchiveFolderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const folderId = params.id;

  const [folder, setFolder] = useState<FolderItem | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [records, setRecords] = useState<RecordCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<number | null>(null);

  const [viewRecord, setViewRecord] =
    useState<ArchiveRecord | null>(null);
  const [openingRecordId, setOpeningRecordId] =
    useState<number | null>(null);
  const [viewError, setViewError] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

      const queryParams = new URLSearchParams({
        folder_id: folderId,
      });

      if (searchValue.trim()) {
        queryParams.set("search", searchValue.trim());
      }

      const [folderData, recordData] = await Promise.all([
        apiRequest("/archive/folders"),
        apiRequest(`/archive/records?${queryParams.toString()}`),
      ]);

      const allFolders = folderData.folders || [];

      const currentFolder = allFolders.find(
        (item: FolderItem) => String(item.id) === folderId
      );

      if (!currentFolder) {
        setFolder(null);
        setRecords([]);
        setError("Archive folder not found.");
        return;
      }

      setFolders(allFolders);
      setFolder(currentFolder);
      setRecords(recordData.data || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load archive folder."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage("");
  }, [folderId]);

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

  async function moveRecord(
    record: RecordCard,
    targetFolderId: string
  ) {
    setMovingId(record.id);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest(
        `/archive/records/${record.id}/move`,
        {
          method: "PATCH",
          body: JSON.stringify({
            archive_folder_id: targetFolderId
              ? Number(targetFolderId)
              : null,
          }),
        }
      );

      setSuccess(data.message || "Record moved successfully.");
      await loadPage(search);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to move archived record."
      );
    } finally {
      setMovingId(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full min-w-0 max-w-7xl overflow-x-hidden pb-8">
        <header className="min-w-0">
          <Link
            href="/archive/folders"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-slate-500 transition hover:text-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="break-words">Back to Archive Folders</span>
          </Link>

          <h1 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-950 sm:mt-3 sm:text-3xl">
            {folder?.name || "Archive Folder"}
          </h1>

          <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-slate-500">
            {folder?.description ||
              "Browse and manage records stored in this archive folder."}
          </p>
        </header>

        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <section className="mt-5 min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 sm:mt-6">
          <div className="border-b border-slate-200 p-3 sm:p-5">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                loadPage(search);
              }}
              className="flex min-w-0 flex-col gap-3 sm:flex-row"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Search records in this folder..."
                  className="min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 sm:text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
            </form>
          </div>

          <div className="min-w-0 p-3 sm:p-5">
            {loading ? (
              <LoadingState />
            ) : records.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {records.map((record) => {
                  const isOpening =
                    openingRecordId === record.id;
                  const isMoving = movingId === record.id;

                  return (
                    <article
                      key={record.id}
                      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-md sm:p-5"
                    >
                      <div className="flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                        <div className="min-w-0 flex-1">
                          <h2
                            className="break-words text-base font-bold leading-6 text-slate-950 sm:text-lg"
                            title={record.title}
                          >
                            {record.title}
                          </h2>

                          <p className="mt-1 break-all text-xs font-medium text-slate-500">
                            {record.record_code}
                          </p>
                        </div>

                        <span className="w-fit shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                          Archived
                        </span>
                      </div>

                      <div className="mt-4 min-w-0 space-y-3 rounded-xl bg-slate-50 p-3 text-xs sm:p-4">
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
                          value={String(record.files?.length || 0)}
                        />
                      </div>

                      <div className="mt-4 min-w-0">
                        <label
                          htmlFor={`move-record-${record.id}`}
                          className="block text-xs font-semibold uppercase tracking-wide text-slate-400"
                        >
                          Move record
                        </label>

                        <div className="relative mt-2 min-w-0">
                          <select
                            id={`move-record-${record.id}`}
                            value={
                              record.archive_folder?.id
                                ? String(record.archive_folder.id)
                                : folderId
                            }
                            disabled={isMoving}
                            onChange={(event) =>
                              moveRecord(record, event.target.value)
                            }
                            className="min-h-12 w-full min-w-0 appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-base font-medium normal-case tracking-normal text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 sm:text-sm"
                          >
                            <option value="">Unfiled</option>

                            {folders.map((item) => (
                              <option
                                key={item.id}
                                value={String(item.id)}
                              >
                                {item.name}
                              </option>
                            ))}
                          </select>

                          {isMoving && (
                            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-600" />
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openRecord(record.id)}
                        disabled={openingRecordId !== null || isMoving}
                        className="mt-3 inline-flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isOpening ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4 shrink-0" />
                        )}

                        <span className="truncate">
                          {isOpening ? "Loading..." : "View Record"}
                        </span>
                      </button>
                    </article>
                  );
                })}
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
    </AppShell>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-slate-50 px-5 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-blue-600" />

      <p className="mt-3 text-sm font-medium text-slate-500">
        Loading folder records...
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <FolderInput className="h-7 w-7" />
      </div>

      <h2 className="mt-4 font-bold text-slate-900">
        This folder is empty
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        Move a record here from the Unfiled Records page.
      </p>
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
    <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-start gap-3">
      <span className="text-slate-400">{label}</span>

      <span className="min-w-0 break-words text-right font-semibold leading-5 text-slate-700">
        {value}
      </span>
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
      role={tone === "error" ? "alert" : "status"}
      className={`mt-5 break-words rounded-2xl border px-4 py-3 text-sm font-medium ${
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