"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  CheckSquare2,
  Eye,
  EyeOff,
  Folder,
  FolderInput,
  FolderOpen,
  Loader2,
  Search,
  ShieldCheck,
  Square,
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

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkTargetFolderId, setBulkTargetFolderId] = useState("");
  const [bulkMoving, setBulkMoving] = useState(false);

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

  const allVisibleSelected =
    records.length > 0 &&
    records.every((record) =>
      selectedRecordIds.includes(record.id)
    );

  const selectedRecords = useMemo(
    () =>
      records.filter((record) =>
        selectedRecordIds.includes(record.id)
      ),
    [records, selectedRecordIds]
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

      const loadedRecords = recordData.data || [];

      setFolders(folderData.folders || []);
      setRecords(loadedRecords);
      setSelectedRecordIds((current) =>
        current.filter((recordId) =>
          loadedRecords.some(
            (record: RecordCard) => record.id === recordId
          )
        )
      );
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
    const timeoutId = window.setTimeout(() => {
      void loadPage("");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function toggleSelectionMode() {
    if (selectionMode) {
      setSelectedRecordIds([]);
    }

    setSelectionMode((current) => !current);
    setSuccess("");
    setError("");
  }

  function toggleRecordSelection(recordId: number) {
    setSelectedRecordIds((current) =>
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId]
    );
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedRecordIds((current) =>
        current.filter(
          (recordId) =>
            !records.some(
              (record) => record.id === recordId
            )
        )
      );
      return;
    }

    setSelectedRecordIds((current) =>
      Array.from(
        new Set([
          ...current,
          ...records.map((record) => record.id),
        ])
      )
    );
  }

  function openBulkMoveModal() {
    if (selectedRecordIds.length === 0) {
      setError("Select at least one record first.");
      return;
    }

    setBulkTargetFolderId("");
    setError("");
    setSuccess("");
    setShowBulkMoveModal(true);
  }

  function closeBulkMoveModal() {
    if (bulkMoving) return;

    setShowBulkMoveModal(false);
    setBulkTargetFolderId("");
  }

  async function bulkMoveRecords() {
    if (
      selectedRecordIds.length === 0 ||
      !bulkTargetFolderId
    ) {
      setError(
        "Select records and choose an archive folder first."
      );
      return;
    }

    setBulkMoving(true);
    setError("");
    setSuccess("");

    try {
      const destinationId = Number(bulkTargetFolderId);

      await Promise.all(
        selectedRecordIds.map((recordId) =>
          apiRequest(`/archive/records/${recordId}/move`, {
            method: "PATCH",
            body: JSON.stringify({
              archive_folder_id: destinationId,
            }),
          })
        )
      );

      const movedCount = selectedRecordIds.length;

      setShowBulkMoveModal(false);
      setBulkTargetFolderId("");
      setSelectedRecordIds([]);
      setSelectionMode(false);

      setSuccess(
        `${movedCount} ${
          movedCount === 1 ? "record" : "records"
        } moved successfully.`
      );

      await loadPage(search);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to move the selected records."
      );
    } finally {
      setBulkMoving(false);
    }
  }

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
        <header className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-4 py-3.5 text-white shadow-md shadow-[#075A3A]/10">
          <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <div className="absolute -bottom-16 left-1/3 h-32 w-32 rounded-full bg-[#6B0F2B]/30 blur-3xl" />

          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#F4C25E]">
                Archive Repository
              </p>

              <h1 className="mt-0.5 text-lg font-extrabold tracking-tight sm:text-xl">
                Unfiled Records
              </h1>

              <p className="mt-0.5 max-w-2xl text-[11px] leading-4 text-[#E5DDCC] sm:text-xs">
                Newly archived records appear here until they are
                organized into an archive folder.
              </p>
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              <button
                type="button"
                onClick={toggleSelectionMode}
                className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold shadow-sm transition focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 sm:flex-none ${
                  selectionMode
                    ? "bg-[#D9961A] text-white hover:bg-[#BE7F10]"
                    : "border border-white/20 bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                <CheckSquare2 className="h-4 w-4" />
                {selectionMode
                  ? "Cancel Selection"
                  : "Select Records"}
              </button>

              <Link
                href="/archive/folders"
                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#6B0F2B] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 sm:flex-none"
              >
                <span className="hidden h-6 w-6 items-center justify-center rounded-md bg-[#D9961A] sm:flex">
                  <FolderOpen className="h-4 w-4" />
                </span>
                Manage Folders
              </Link>
            </div>
          </div>
        </header>

        <section className="mt-3 grid grid-cols-3 gap-2">
          <SummaryCard
            label="Unfiled"
            value={records.length}
            icon={<Archive className="h-5 w-5" />}
            variant="maroon"
          />
          <SummaryCard
            label="Folders"
            value={folders.length}
            icon={<Folder className="h-5 w-5" />}
            variant="green"
          />
          <SummaryCard
            label="Records in Folders"
            value={totalFoldered}
            icon={<FolderInput className="h-5 w-5" />}
            variant="gold"
          />
        </section>

        {error && <Alert tone="error">{error}</Alert>}
        {success && (
          <Alert tone="success">{success}</Alert>
        )}

        <section className="relative mt-3 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#DED5C5]">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#D9961A]" />
          <div className="border-b border-[#E3DCCE] bg-[#FCFAF5] p-3 pt-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                loadPage(search);
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A09582]" />
                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search title, record code, category..."
                  className="min-h-10 w-full rounded-lg border border-[#E3DCCE] bg-[#F8F5EE] py-2 pl-10 pr-3 text-sm outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC]"
                />
              </div>

              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#075A3A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#043D28] focus:outline-none focus:ring-4 focus:ring-[#CFE0D6]">
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>
          </div>

          <div className="p-3">
            {selectionMode && !loading && records.length > 0 && (
              <div className="mb-3 flex flex-col gap-2 rounded-xl border border-[#CFE0D6] bg-gradient-to-r from-[#F0F7F3] to-[#FFF9EA] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold text-[#252A27]">
                    {selectedRecordIds.length}{" "}
                    {selectedRecordIds.length === 1
                      ? "record selected"
                      : "records selected"}
                  </p>
                  <p className="mt-1 text-xs text-[#766F63]">
                    Select multiple unfiled records, then move them
                    into one archive folder.
                  </p>
                </div>

                <div className="flex flex-col gap-2 min-[420px]:flex-row">
                  <button
                    type="button"
                    onClick={toggleSelectAllVisible}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E3DCCE] bg-white px-4 py-2.5 text-sm font-semibold text-[#514D46] transition hover:bg-[#FCFAF5]"
                  >
                    {allVisibleSelected ? (
                      <CheckSquare2 className="h-4 w-4 text-[#075A3A]" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                    {allVisibleSelected
                      ? "Clear Visible"
                      : "Select All Visible"}
                  </button>

                  <button
                    type="button"
                    onClick={openBulkMoveModal}
                    disabled={selectedRecordIds.length === 0}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#571023] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FolderInput className="h-4 w-4" />
                    Move Selected
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <LoadingState />
            ) : records.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid gap-2.5 md:grid-cols-2 2xl:grid-cols-3">
                {records.map((record) => (
                  <article
                    key={record.id}
                    className={`relative overflow-hidden rounded-xl border bg-white p-3.5 transition hover:shadow-sm ${
                      selectedRecordIds.includes(record.id)
                        ? "border-[#075A3A] ring-2 ring-[#CFE0D6]"
                        : "border-[#E3DCCE] hover:border-[#CFE0D6]"
                    }`}
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#075A3A] via-[#D9961A] to-[#6B0F2B]" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        {selectionMode && (
                          <button
                            type="button"
                            onClick={() =>
                              toggleRecordSelection(record.id)
                            }
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                              selectedRecordIds.includes(record.id)
                                ? "border-[#075A3A] bg-[#075A3A] text-white"
                                : "border-[#D7CDBB] bg-white text-transparent hover:border-[#075A3A]"
                            }`}
                            aria-label={`Select ${record.title}`}
                            aria-pressed={selectedRecordIds.includes(
                              record.id
                            )}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}

                        <div className="min-w-0">
                          <h2 className="truncate font-bold text-[#252A27]">
                            {record.title}
                          </h2>
                          <p className="mt-1 text-xs font-medium text-[#766F63]">
                            {record.record_code}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        
  <span className="rounded-full bg-[#E6F2EC] px-2.5 py-1 text-[11px] font-bold text-[#075A3A] ring-1 ring-[#CFE0D6]">
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

                    <div className="mt-3 space-y-1.5 rounded-lg bg-[#F8F5EE] p-2.5 text-[11px]">
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

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openRecord(record.id)}
                        disabled={
                          openingRecordId !== null || selectionMode
                        }
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#E3DCCE] px-2.5 py-2 text-xs font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] disabled:opacity-50"
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
                        disabled={selectionMode}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#6B0F2B] px-2.5 py-2 text-xs font-bold text-white transition hover:bg-[#571023] disabled:cursor-not-allowed disabled:opacity-50"
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
        "Staff access settings updated successfully."
      );
    }}
  />
)}


      {showBulkMoveModal && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-[#17231E]/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeBulkMoveModal();
            }
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-[#DED5C5]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D9961A]">
                  Bulk Organization
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#252A27]">
                  Move selected records
                </h2>
              </div>

              <button
                type="button"
                onClick={closeBulkMoveModal}
                disabled={bulkMoving}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#766F63] transition hover:bg-[#F0ECE4] disabled:opacity-50"
                aria-label="Close bulk move dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-gradient-to-br from-[#F0F7F3] to-[#FFF9EA] p-4 ring-1 ring-[#D9D2C4]">
              <p className="text-sm font-bold text-[#2D332F]">
                {selectedRecordIds.length}{" "}
                {selectedRecordIds.length === 1
                  ? "record will be moved"
                  : "records will be moved"}
              </p>

              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                {selectedRecords.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-xl bg-white px-3 py-2 ring-1 ring-[#E3DCCE]"
                  >
                    <p className="truncate text-sm font-semibold text-[#2D332F]">
                      {record.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#766F63]">
                      {record.record_code}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <label className="mt-5 block text-sm font-semibold text-[#514D46]">
              Destination folder
              <select
                value={bulkTargetFolderId}
                onChange={(event) =>
                  setBulkTargetFolderId(event.target.value)
                }
                disabled={bulkMoving}
                className="mt-2 w-full rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-sm outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] disabled:opacity-60"
              >
                <option value="">Choose a folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
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
                onClick={closeBulkMoveModal}
                disabled={bulkMoving}
                className="rounded-xl border border-[#E3DCCE] px-5 py-3 text-sm font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={bulkMoveRecords}
                disabled={bulkMoving || !bulkTargetFolderId}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkMoving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderInput className="h-4 w-4" />
                )}
                {bulkMoving
                  ? "Moving Records..."
                  : `Move ${selectedRecordIds.length} ${
                      selectedRecordIds.length === 1
                        ? "Record"
                        : "Records"
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}

      {moveRecordItem && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#6B0F2B]/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMoveModal();
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-[#DED5C5]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D9961A]">
                  Organize Record
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#252A27]">
                  Move to folder
                </h2>
              </div>

              <button
                type="button"
                onClick={closeMoveModal}
                disabled={moving}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#766F63] hover:bg-[#F0ECE4]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-gradient-to-br from-[#F0F7F3] to-[#FFF9EA] p-4 ring-1 ring-[#D9D2C4]">
              <p className="font-semibold text-[#2D332F]">
                {moveRecordItem.title}
              </p>
              <p className="mt-1 text-xs text-[#766F63]">
                {moveRecordItem.record_code}
              </p>
            </div>

            <label className="mt-5 block text-sm font-semibold text-[#514D46]">
              Archive folder
              <select
                value={targetFolderId}
                onChange={(event) =>
                  setTargetFolderId(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-sm outline-none focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC]"
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
                className="rounded-xl border border-[#E3DCCE] px-5 py-3 text-sm font-semibold text-[#514D46] hover:bg-[#F8F5EE]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={moveRecord}
                disabled={moving || !targetFolderId}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 disabled:opacity-50"
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
  variant,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  variant: "green" | "gold" | "maroon";
}) {
  const styles = {
    green: {
      bar: "bg-[#075A3A]",
      icon: "bg-[#E6F2EC] text-[#075A3A]",
      ring: "ring-[#CFE0D6]",
    },
    gold: {
      bar: "bg-[#D9961A]",
      icon: "bg-[#FFF3D6] text-[#A66B00]",
      ring: "ring-[#E7D3A2]",
    },
    maroon: {
      bar: "bg-[#6B0F2B]",
      icon: "bg-[#F8E9EE] text-[#6B0F2B]",
      ring: "ring-[#E4CBD4]",
    },
  }[variant];

  return (
    <div className={`relative flex min-h-[76px] items-center gap-2 overflow-hidden rounded-xl bg-white p-2.5 shadow-sm ring-1 ${styles.ring}`}>
      <div className={`absolute inset-y-0 left-0 w-1 ${styles.bar}`} />

      <div className={`hidden h-8 w-8 items-center justify-center rounded-lg sm:flex ${styles.icon}`}>
        {icon}
      </div>

      <div>
        <p className="text-[10px] font-medium leading-4 text-[#766F63]">
          {label}
        </p>

        <p className="text-lg font-extrabold text-[#252A27]">
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
      <span className="text-[#A09582]">{label}</span>
      <span className="truncate font-semibold text-[#514D46]">
        {value}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-[#F8F5EE]">
      <Loader2 className="h-7 w-7 animate-spin text-[#075A3A]" />
      <p className="mt-3 text-sm font-medium text-[#766F63]">
        Loading unfiled records...
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#D7CDBB] bg-[#F8F5EE] px-5 text-center">
      <Archive className="h-8 w-8 text-[#A09582]" />
      <h3 className="mt-4 font-bold text-[#2D332F]">
        No unfiled records
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-[#766F63]">
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

function AccessLevelBadge({
  accessLevel,
}: {
  accessLevel?: string | null;
}) {
  const normalized = (accessLevel || "internal").toLowerCase();

  const styles: Record<string, string> = {
    internal:
      "bg-blue-50 text-blue-700 ring-blue-200",
    restricted:
      "bg-amber-50 text-amber-800 ring-amber-200",
    confidential:
      "bg-red-50 text-red-700 ring-red-200",
    public:
      "bg-emerald-50 text-emerald-700 ring-emerald-200",
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
