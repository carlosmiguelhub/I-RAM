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
        <header className="relative min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-5 py-6 text-white shadow-xl shadow-[#075A3A]/20 sm:px-7 sm:py-7">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#6B0F2B]/30 blur-3xl" />

          <div className="relative min-w-0">
            <Link
              href="/archive/folders"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-[#E5DDCC] transition hover:text-[#F4C25E] focus:outline-none focus:ring-4 focus:ring-white/10"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="break-words">Back to Archive Folders</span>
            </Link>

            <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#F4C25E]">
              Archive Repository
            </p>

            <h1 className="mt-2 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">
              {folder?.name || "Archive Folder"}
            </h1>

            <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-[#E5DDCC]">
              {folder?.description ||
                "Browse and manage records stored in this archive folder."}
            </p>
          </div>
        </header>

        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <section className="relative mt-5 min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DED5C5] sm:mt-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#D9961A]" />
          <div className="border-b border-[#E3DCCE] bg-[#FCFAF5] p-3 pt-5 sm:p-5 sm:pt-6">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                loadPage(search);
              }}
              className="flex min-w-0 flex-col gap-3 sm:flex-row"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A09582]" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Search records in this folder..."
                  className="min-h-12 w-full min-w-0 rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] py-3 pl-12 pr-4 text-base text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#075A3A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#043D28] focus:outline-none focus:ring-4 focus:ring-[#CFE0D6] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
                      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E3DCCE] bg-white p-4 transition hover:border-[#CFE0D6] hover:shadow-md sm:p-5"
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#075A3A] via-[#D9961A] to-[#6B0F2B]" />
                      <div className="flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                        <div className="min-w-0 flex-1">
                          <h2
                            className="break-words text-base font-bold leading-6 text-[#252A27] sm:text-lg"
                            title={record.title}
                          >
                            {record.title}
                          </h2>

                          <p className="mt-1 break-all text-xs font-medium text-[#766F63]">
                            {record.record_code}
                          </p>
                        </div>

                        <span className="w-fit shrink-0 rounded-full bg-[#E6F2EC] px-2.5 py-1 text-[11px] font-bold text-[#075A3A] ring-1 ring-[#CFE0D6]">
                          Archived
                        </span>
                      </div>

                      <div className="mt-4 min-w-0 space-y-3 rounded-xl bg-[#FCFAF5] p-3 text-xs ring-1 ring-[#E8E0D4] sm:p-4">
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
                          className="block text-xs font-bold uppercase tracking-[0.14em] text-[#A09582]"
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
                            className="min-h-12 w-full min-w-0 appearance-none rounded-xl border border-[#E3DCCE] bg-white px-3 py-2.5 pr-10 text-base font-medium normal-case tracking-normal text-[#514D46] outline-none transition focus:border-[#075A3A] focus:ring-4 focus:ring-[#E6F2EC] disabled:cursor-not-allowed disabled:bg-[#F0ECE4] disabled:opacity-70 sm:text-sm"
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
                            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#075A3A]" />
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openRecord(record.id)}
                        disabled={openingRecordId !== null || isMoving}
                        className="mt-3 inline-flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 disabled:cursor-not-allowed disabled:opacity-50"
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
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-[#F8F5EE] px-5 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-[#075A3A]" />

      <p className="mt-3 text-sm font-medium text-[#766F63]">
        Loading folder records...
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#D7CDBB] bg-[#F8F5EE] px-5 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3D6] text-[#A66B00] shadow-sm ring-1 ring-[#EBCF8F]">
        <FolderInput className="h-7 w-7" />
      </div>

      <h2 className="mt-4 font-bold text-[#2D332F]">
        This folder is empty
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-[#766F63]">
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
      <span className="text-[#A09582]">{label}</span>

      <span className="min-w-0 break-words text-right font-semibold leading-5 text-[#514D46]">
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