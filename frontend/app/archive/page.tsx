"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import FolderDestinationPicker from "@/components/archive/FolderDestinationPicker";
import ViewModeToggle, {
  usePersistentViewMode,
} from "@/components/archive/ViewModeToggle";
import { apiRequest } from "@/lib/api";

type FolderItem = {
  id: number;
  parent_id?: number | null;
  name: string;
  path?: string;
  records_count: number;
};

type RecordCard = ArchiveRecord;

export default function ArchiveUnfiledPage() {
  const router = useRouter();

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [records, setRecords] = useState<RecordCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, changeView] = usePersistentViewMode(
    "archive-record-view",
    "grid"
  );

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([]);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkTargetFolderId, setBulkTargetFolderId] = useState("");
  const [bulkMoving, setBulkMoving] = useState(false);

  const [moveRecordItem, setMoveRecordItem] =
    useState<RecordCard | null>(null);
  const [targetFolderId, setTargetFolderId] = useState("");
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState("");

  const [viewRecord, setViewRecord] =
    useState<ArchiveRecord | null>(null);
  const [openingRecordId, setOpeningRecordId] =
    useState<number | null>(null);
  const [viewError, setViewError] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const searchRef = useRef("");
  const roleVerifiedRef = useRef(false);
  const syncingRef = useRef(false);

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
  const selectedMoveFolder = useMemo(
    () =>
      folders.find(
        (folder) => String(folder.id) === targetFolderId
      ) || null,
    [folders, targetFolderId]
  );

  useEffect(() => {
    if (!moveRecordItem) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !moving) {
        setMoveRecordItem(null);
        setTargetFolderId("");
        setMoveError("");
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [moveRecordItem, moving]);

  async function loadPage(
    searchValue = search,
    silent = false
  ) {
    if (syncingRef.current) return;
    syncingRef.current = true;

    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      if (!roleVerifiedRef.current) {
        const meData = await apiRequest("/me");
        const role = meData.user?.role?.name;

        if (!["Admin", "Records Officer"].includes(role)) {
          router.replace("/dashboard");
          return;
        }

        roleVerifiedRef.current = true;
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
      if (!silent) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load the archive repository."
        );
      }
    } finally {
      syncingRef.current = false;
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPage("");
    }, 0);
    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadPage(searchRef.current, true);
      }
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(pollId);
    };
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
    setMoveError("");
    setError("");
    setSuccess("");
  }

  function closeMoveModal() {
    if (moving) return;

    setMoveRecordItem(null);
    setTargetFolderId("");
    setMoveError("");
  }

  async function moveRecord() {
    if (!moveRecordItem || !targetFolderId) {
      setMoveError("Choose an archive folder first.");
      return;
    }

    setMoving(true);
    setMoveError("");
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
      setMoveError(
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
          <div className="flex flex-col gap-2 border-b border-[#E3DCCE] bg-[#FCFAF5] p-3 pt-4 sm:flex-row sm:items-center">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                loadPage(search);
              }}
              className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A09582]" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    searchRef.current = event.target.value;
                  }}
                  placeholder="Search title, record code, category..."
                  className="min-h-10 w-full rounded-lg border border-[#E3DCCE] bg-[#F8F5EE] py-2 pl-10 pr-3 text-sm outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC]"
                />
              </div>

              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#075A3A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#043D28] focus:outline-none focus:ring-4 focus:ring-[#CFE0D6]">
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>
            <ViewModeToggle value={viewMode} onChange={changeView} />
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
            ) : viewMode === "grid" ? (
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
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E3DCCE]">
                <div className="grid min-w-[1040px] grid-cols-[minmax(260px,1.4fr)_150px_170px_150px_190px_190px] gap-3 border-b border-[#E3DCCE] bg-[#F8F5EE] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#766F63]">
                  <span>Record</span>
                  <span>Category</span>
                  <span>Department</span>
                  <span>Archived / Files</span>
                  <span>Access</span>
                  <span className="text-right">Actions</span>
                </div>
                {records.map((record) => (
                  <ArchiveListEntry
                    key={record.id}
                    record={record}
                    selectionMode={selectionMode}
                    selected={selectedRecordIds.includes(record.id)}
                    opening={openingRecordId === record.id}
                    busy={openingRecordId !== null}
                    onSelect={() => toggleRecordSelection(record.id)}
                    onOpen={() => openRecord(record.id)}
                    onMove={() => openMoveModal(record)}
                  />
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
        updatedRecord.status === "for_disposal"
          ? current.filter(
              (record) => record.id !== updatedRecord.id
            )
          : current.map((record) =>
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
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-[#DED5C5] sm:p-7">
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

            <div className="mt-5 text-sm font-semibold text-[#514D46]">
              <p>Destination folder</p>
              <FolderDestinationPicker
                folders={folders}
                value={bulkTargetFolderId}
                onChange={setBulkTargetFolderId}
                disabled={bulkMoving}
              />
            </div>

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
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#132019]/75 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeMoveModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="organize-record-title"
            className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(8,28,19,0.3)] ring-1 ring-white/20"
          >
            <header className="flex shrink-0 items-center justify-between gap-4 bg-gradient-to-r from-[#075A3A] to-[#04432D] px-5 py-4 text-white sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <FolderInput className="h-4 w-4 text-[#F4C25E]" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#F4C25E]">
                    Archive organization
                  </p>
                  <h2
                    id="organize-record-title"
                    className="mt-0.5 truncate text-lg font-bold"
                  >
                    Move record to a folder
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={closeMoveModal}
                disabled={moving}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
                aria-label="Close organize record dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto bg-[#F6F7F5] p-4 sm:p-6">
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <section className="overflow-hidden rounded-xl border border-[#E0E4E1] bg-white shadow-sm">
                  <div className="border-b border-[#E8EAE8] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#858C86]">
                      Record being moved
                    </p>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F8E9EE] text-[#6B0F2B]">
                        <Archive className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-bold leading-5 text-[#28312B]">
                          {moveRecordItem.title}
                        </h3>
                        <p className="mt-1 break-all text-xs font-semibold text-[#7B827C]">
                          {moveRecordItem.record_code}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-4 divide-y divide-[#ECEEEC] border-y border-[#ECEEEC]">
                      <MoveDetail
                        label="Category"
                        value={moveRecordItem.category?.name || "N/A"}
                      />
                      <MoveDetail
                        label="Department"
                        value={moveRecordItem.department?.name || "N/A"}
                      />
                      <MoveDetail
                        label="Attachments"
                        value={`${moveRecordItem.files?.length || 0} file${
                          (moveRecordItem.files?.length || 0) === 1
                            ? ""
                            : "s"
                        }`}
                      />
                      <MoveDetail
                        label="Current location"
                        value={
                          moveRecordItem.archive_folder?.name ||
                          "Unfiled records"
                        }
                      />
                    </dl>

                    <p className="mt-4 text-xs leading-5 text-[#737B75]">
                      Only the folder assignment changes. The record remains
                      archived with its files and metadata intact.
                    </p>
                  </div>
                </section>

                <section className="rounded-xl border border-[#D8E3DC] bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7F0EB] text-[#075A3A]">
                      <FolderOpen className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-[#28312B]">
                        Choose destination
                      </h3>
                      <p className="mt-0.5 text-xs leading-5 text-[#737B75]">
                        Search all folders and nested subfolders.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 text-sm font-semibold text-[#4D5650]">
                    <span className="sr-only">Destination folder</span>
                    <FolderDestinationPicker
                      folders={folders}
                      value={targetFolderId}
                      onChange={(value) => {
                        setTargetFolderId(value);
                        setMoveError("");
                      }}
                      disabled={moving}
                    />
                  </div>

                  {selectedMoveFolder && (
                    <div className="mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Selected destination
                        </p>
                        <p className="mt-0.5 break-words text-sm font-bold text-emerald-900">
                          {selectedMoveFolder.name}
                        </p>
                        <p className="mt-0.5 break-words text-xs leading-5 text-emerald-700">
                          {selectedMoveFolder.path ||
                            selectedMoveFolder.name}
                        </p>
                      </div>
                    </div>
                  )}

                  {moveError && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                      {moveError}
                    </div>
                  )}

                  {folders.length === 0 && (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      No folders exist yet. Create one from Folder Management
                      first.
                    </div>
                  )}
                </section>
              </div>
            </div>

            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#E0E4E1] bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="hidden text-xs text-[#818882] sm:block">
                Select a destination before moving this record.
              </p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={closeMoveModal}
                  disabled={moving}
                  className="h-9 rounded-lg border border-[#D8DDD9] bg-white px-4 text-xs font-bold text-[#59615B] transition hover:bg-[#F5F7F5] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={moveRecord}
                  disabled={moving || !targetFolderId}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#075A3A] px-4 text-xs font-bold text-white transition hover:bg-[#06472F] focus:outline-none focus:ring-4 focus:ring-[#DCEAE2] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {moving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderInput className="h-4 w-4" />
                  )}
                  {moving ? "Moving..." : "Move Record"}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function MoveDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-xs">
      <dt className="shrink-0 font-medium text-[#858C86]">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold text-[#3F4841]">
        {value}
      </dd>
    </div>
  );
}

function ArchiveListEntry({
  record,
  selectionMode,
  selected,
  opening,
  busy,
  onSelect,
  onOpen,
  onMove,
}: {
  record: RecordCard;
  selectionMode: boolean;
  selected: boolean;
  opening: boolean;
  busy: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onMove: () => void;
}) {
  return (
    <article
      className={`grid min-w-[1040px] grid-cols-[minmax(260px,1.4fr)_150px_170px_150px_190px_190px] items-center gap-3 border-b border-[#EEE8DD] px-3 py-3 text-xs last:border-0 hover:bg-[#FCFAF5] ${
        selected ? "bg-[#F0F7F3] ring-1 ring-inset ring-[#CFE0D6]" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {selectionMode && (
          <button
            type="button"
            onClick={onSelect}
            aria-label={`Select ${record.title}`}
            aria-pressed={selected}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
              selected
                ? "border-[#075A3A] bg-[#075A3A] text-white"
                : "border-[#D7CDBB] bg-white text-transparent hover:border-[#075A3A]"
            }`}
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F8E9EE] text-[#6B0F2B]">
          <Archive className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold text-[#252A27]">{record.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-[#766F63]">{record.record_code}</p>
        </div>
      </div>
      <span className="truncate text-[#514D46]">{record.category?.name || "N/A"}</span>
      <span className="truncate text-[#514D46]">{record.department?.name || "N/A"}</span>
      <span className="text-[#514D46]">
        {formatDate(record.archived_at)}
        <span className="mt-0.5 block text-[11px] text-[#A09582]">{record.files?.length || 0} files</span>
      </span>
      <div className="flex flex-wrap gap-1.5">
        <AccessLevelBadge accessLevel={record.access_level} />
        <StaffVisibilityBadge staffVisible={Boolean(record.staff_visible)} />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onOpen}
          disabled={busy || selectionMode}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E3DCCE] bg-white px-3 font-semibold text-[#514D46] hover:bg-[#F8F5EE] disabled:opacity-50"
        >
          {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          View
        </button>
        <button
          type="button"
          onClick={onMove}
          disabled={selectionMode}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#6B0F2B] px-3 font-bold text-white hover:bg-[#571023] disabled:opacity-50"
        >
          <FolderInput className="h-4 w-4" />
          Organize
        </button>
      </div>
    </article>
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
