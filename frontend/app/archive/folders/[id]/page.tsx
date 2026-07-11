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

  const [folder, setFolder] = useState<FolderItem | null>(
    null
  );
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [records, setRecords] = useState<RecordCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<number | null>(
    null
  );

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
        apiRequest(
          `/archive/records?${queryParams.toString()}`
        ),
      ]);

      const allFolders = folderData.folders || [];
      const currentFolder = allFolders.find(
        (item: FolderItem) =>
          String(item.id) === folderId
      );

      if (!currentFolder) {
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

      setSuccess(
        data.message || "Record moved successfully."
      );
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
      <div className="mx-auto w-full max-w-7xl">
        <header>
          <Link
            href="/archive/folders"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Archive Folders
          </Link>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            {folder?.name || "Archive Folder"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {folder?.description ||
              "Browse and manage records stored in this archive folder."}
          </p>
        </header>

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
                  placeholder="Search records in this folder..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
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
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-slate-50">
                <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                <p className="mt-3 text-sm font-medium text-slate-500">
                  Loading folder records...
                </p>
              </div>
            ) : records.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
                <FolderInput className="h-8 w-8 text-slate-400" />
                <h2 className="mt-4 font-bold text-slate-900">
                  This folder is empty
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Move a record here from the Unfiled Records
                  page.
                </p>
              </div>
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
                        <p className="mt-1 text-xs text-slate-500">
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

                    <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Move record
                      <select
                        value={
                          record.archive_folder?.id || folderId
                        }
                        disabled={movingId === record.id}
                        onChange={(event) =>
                          moveRecord(
                            record,
                            event.target.value
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none focus:border-blue-500"
                      >
                        <option value="">Unfiled</option>
                        {folders.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => openRecord(record.id)}
                      disabled={openingRecordId !== null}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
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
    </AppShell>
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
