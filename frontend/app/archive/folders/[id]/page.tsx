"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  FolderInput,
  Loader2,
  Search,
  ShieldCheck,
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
    const timeoutId = window.setTimeout(() => {
      void loadPage("");
    }, 0);

    return () => window.clearTimeout(timeoutId);
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
        <header className="relative min-w-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-4 py-3.5 text-white shadow-md shadow-[#075A3A]/10">
          <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <div className="absolute -bottom-16 left-1/3 h-32 w-32 rounded-full bg-[#6B0F2B]/30 blur-3xl" />

          <div className="relative min-w-0">
            <Link
              href="/archive/folders"
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#E5DDCC] transition hover:text-[#F4C25E] focus:outline-none focus:ring-4 focus:ring-white/10"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="break-words">Back to Archive Folders</span>
            </Link>

            <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#F4C25E]">
              Archive Repository
            </p>

            <h1 className="mt-0.5 break-words text-lg font-extrabold tracking-tight sm:text-xl">
              {folder?.name || "Archive Folder"}
            </h1>

            <p className="mt-0.5 max-w-2xl break-words text-[11px] leading-4 text-[#E5DDCC] sm:text-xs">
              {folder?.description ||
                "Browse and manage records stored in this archive folder."}
            </p>
          </div>
        </header>

        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <section className="relative mt-3 min-w-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#DED5C5]">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#D9961A]" />
          <div className="border-b border-[#E3DCCE] bg-[#FCFAF5] p-3 pt-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                loadPage(search);
              }}
              className="flex min-w-0 flex-col gap-2 sm:flex-row"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A09582]" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="Search records in this folder..."
                  className="min-h-10 w-full min-w-0 rounded-lg border border-[#E3DCCE] bg-[#F8F5EE] py-2 pl-10 pr-3 text-sm text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#075A3A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#043D28] focus:outline-none focus:ring-4 focus:ring-[#CFE0D6] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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

          <div className="min-w-0 p-3">
            {loading ? (
              <LoadingState />
            ) : records.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
                {records.map((record) => {
                  const isOpening =
                    openingRecordId === record.id;
                  const isMoving = movingId === record.id;

                  return (
                    <article
                      key={record.id}
                      className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#E3DCCE] bg-white p-3.5 transition hover:border-[#CFE0D6] hover:shadow-sm"
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#075A3A] via-[#D9961A] to-[#6B0F2B]" />
                      <div className="flex min-w-0 flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                        <div className="min-w-0 flex-1">
                          <h2
                            className="break-words text-sm font-bold leading-5 text-[#252A27]"
                            title={record.title}
                          >
                            {record.title}
                          </h2>

                          <p className="mt-1 break-all text-xs font-medium text-[#766F63]">
                            {record.record_code}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-col items-start gap-1.5 min-[420px]:items-end">
                          <span className="w-fit rounded-full bg-[#E6F2EC] px-2.5 py-1 text-[11px] font-bold text-[#075A3A] ring-1 ring-[#CFE0D6]">
                            Archived
                          </span>

                          <AccessLevelBadge
                            accessLevel={record.access_level}
                          />

                          <StaffVisibilityBadge
                            staffVisible={Boolean(record.staff_visible)}
                          />
                        </div>
                      </div>

                      <div className="mt-3 min-w-0 space-y-2 rounded-lg bg-[#FCFAF5] p-2.5 text-[11px] ring-1 ring-[#E8E0D4]">
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

                      <div className="mt-3 min-w-0">
                        <label
                          htmlFor={`move-record-${record.id}`}
                          className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[#A09582]"
                        >
                          Move record
                        </label>

                        <div className="relative mt-1.5 min-w-0">
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
                            className="min-h-10 w-full min-w-0 appearance-none rounded-lg border border-[#E3DCCE] bg-white px-3 py-2 pr-9 text-sm font-medium normal-case tracking-normal text-[#514D46] outline-none transition focus:border-[#075A3A] focus:ring-4 focus:ring-[#E6F2EC] disabled:cursor-not-allowed disabled:bg-[#F0ECE4] disabled:opacity-70"
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
                        className="mt-2.5 inline-flex min-h-9 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[#6B0F2B] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 disabled:cursor-not-allowed disabled:opacity-50"
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
          onRecordUpdated={(updatedRecord) => {
            setViewRecord(updatedRecord);

            setRecords((current) =>
              current.map((record) =>
                record.id === updatedRecord.id
                  ? updatedRecord
                  : record
              )
            );

            setSuccess(
              "Staff catalog access updated successfully."
            );
          }}
        />
      )}
    </AppShell>
  );
}


function AccessLevelBadge({
  accessLevel,
}: {
  accessLevel?: string | null;
}) {
  const normalized = (accessLevel || "internal").toLowerCase();

  const styles: Record<string, string> = {
    internal: "bg-blue-50 text-blue-700 ring-blue-200",
    restricted: "bg-amber-50 text-amber-800 ring-amber-200",
    confidential: "bg-red-50 text-red-700 ring-red-200",
    public: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  };

  const labels: Record<string, string> = {
    internal: "Internal",
    restricted: "Restricted",
    confidential: "Confidential",
    public: "Public",
  };

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
        styles[normalized] ||
        "bg-slate-50 text-slate-700 ring-slate-200"
      }`}
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      {labels[normalized] || accessLevel || "Internal"}
    </span>
  );
}

function StaffVisibilityBadge({
  staffVisible,
}: {
  staffVisible: boolean;
}) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${
        staffVisible
          ? "bg-violet-50 text-violet-700 ring-violet-200"
          : "bg-slate-100 text-slate-600 ring-slate-200"
      }`}
    >
      {staffVisible ? (
        <Eye className="h-3.5 w-3.5" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" />
      )}
      {staffVisible ? "Staff Visible" : "Staff Hidden"}
    </span>
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
