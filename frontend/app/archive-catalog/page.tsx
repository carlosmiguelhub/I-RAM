"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileKey2,
  Filter,
  FolderArchive,
  Loader2,
  LockKeyhole,
  Search,
  Send,
  ShieldCheck,
  Tags,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import DocumentRequestProgressOverlay, {
  type RequestProgressStage,
} from "@/components/DocumentRequestProgressOverlay";
import ViewModeToggle, {
  usePersistentViewMode,
} from "@/components/archive/ViewModeToggle";
import { apiRequest } from "@/lib/api";

type Option = {
  id: number;
  name: string;
};

type ArchiveRecord = {
  id: number;
  record_code: string;
  title: string;
  description?: string | null;
  source?: string | null;
  access_level: "internal" | "restricted" | "confidential";
  archived_at?: string | null;
  category?: Option | null;
  department?: Option | null;
  archive_folder?: {
    id: number;
    name: string;
  } | null;
};

type PaginationData = {
  data: ArchiveRecord[];
  current_page: number;
  last_page: number;
  total: number;
};

type RequestForm = {
  purpose: string;
  urgency: "normal" | "urgent";
  preferred_format: "digital" | "printed" | "view_only";
  request_notes: string;
};

const initialRequestForm: RequestForm = {
  purpose: "",
  urgency: "normal",
  preferred_format: "digital",
  request_notes: "",
};

export default function ArchiveCatalogPage() {
  const router = useRouter();

  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [viewMode, changeView] = usePersistentViewMode(
    "archive-catalog-view",
    "grid"
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requestProgressStage, setRequestProgressStage] =
    useState<RequestProgressStage>("validating");
  const [backgroundRefreshing, setBackgroundRefreshing] =
    useState(false);

  const [selectedRecord, setSelectedRecord] =
    useState<ArchiveRecord | null>(null);

  const [requestForm, setRequestForm] =
    useState<RequestForm>(initialRequestForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalError, setModalError] = useState("");

  const hasFilters = useMemo(
    () =>
      Boolean(
        search.trim() ||
          categoryId ||
          departmentId
      ),
    [search, categoryId, departmentId]
  );

  async function loadOptions() {
    setOptionsLoading(true);

    try {
      const data = await apiRequest("/options");

      setCategories(data.categories || []);
      setDepartments(data.departments || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load catalog filters."
      );
    } finally {
      setOptionsLoading(false);
    }
  }

  async function verifyStaffAccess() {
    const data = await apiRequest("/me");
    const roleName = data.user?.role?.name;

    if (roleName !== "Staff") {
      router.replace("/dashboard");
      return false;
    }

    return true;
  }

  async function loadCatalog(
    page = 1,
    customSearch = search,
    silent = false
  ) {
    if (silent) {
      setBackgroundRefreshing(true);
    } else {
      setLoading(true);
      setError("");
    }

    try {
      const params = new URLSearchParams();

      params.set("page", String(page));

      if (customSearch.trim()) {
        params.set("search", customSearch.trim());
      }

      if (categoryId) {
        params.set("category_id", categoryId);
      }

      if (departmentId) {
        params.set("department_id", departmentId);
      }

      const data: PaginationData = await apiRequest(
        `/staff/archive-catalog?${params.toString()}`
      );

      setRecords(data.data || []);
      setCurrentPage(data.current_page || 1);
      setLastPage(data.last_page || 1);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      if (!silent) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load the archive catalog."
        );
      }
    } finally {
      if (silent) {
        setBackgroundRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    async function initializePage() {
      try {
        const allowed = await verifyStaffAccess();

        if (!allowed) return;

        await Promise.all([
          loadOptions(),
          loadCatalog(1, ""),
        ]);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to open the archive catalog."
        );
        setLoading(false);
        setOptionsLoading(false);
      }
    }

    initializePage();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (
        document.visibilityState === "visible" &&
        !selectedRecord &&
        !submitting
      ) {
        void loadCatalog(currentPage, search, true);
      }
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    currentPage,
    search,
    categoryId,
    departmentId,
    selectedRecord,
    submitting,
  ]);

  useEffect(() => {
    function refreshWhenVisible() {
      if (
        document.visibilityState === "visible" &&
        !selectedRecord &&
        !submitting
      ) {
        void loadCatalog(currentPage, search, true);
      }
    }

    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible
    );
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible
      );
      window.removeEventListener(
        "focus",
        refreshWhenVisible
      );
    };
  }, [
    currentPage,
    search,
    categoryId,
    departmentId,
    selectedRecord,
    submitting,
  ]);

  useEffect(() => {
    if (!selectedRecord) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) {
        closeRequestModal();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedRecord, submitting]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    loadCatalog(1, search);
  }

  function clearFilters() {
    setSearch("");
    setCategoryId("");
    setDepartmentId("");
    setSuccess("");

    setTimeout(() => {
      loadCatalog(1, "");
    }, 0);
  }

  function openRequestModal(record: ArchiveRecord) {
    setSelectedRecord(record);
    setRequestForm(initialRequestForm);
    setModalError("");
    setSuccess("");
  }

  function closeRequestModal() {
    if (submitting) return;

    setSelectedRecord(null);
    setRequestForm(initialRequestForm);
    setModalError("");
  }

  function updateRequestForm(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = event.target;

    setRequestForm((current) => ({
      ...current,
      [name]: value,
    }));

    setModalError("");
  }

  async function submitDocumentRequest(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedRecord) return;

    if (!requestForm.purpose.trim()) {
      setModalError("Please explain why you need this document.");
      return;
    }

    setSubmitting(true);
    setRequestProgressStage("validating");
    setModalError("");
    const progressTimers = [
      window.setTimeout(
        () => setRequestProgressStage("submitting"),
        350
      ),
      window.setTimeout(
        () => setRequestProgressStage("notifying"),
        1100
      ),
    ];

    try {
      const data = await apiRequest("/document-requests", {
        method: "POST",
        body: JSON.stringify({
          record_id: selectedRecord.id,
          purpose: requestForm.purpose.trim(),
          urgency: requestForm.urgency,
          preferred_format: requestForm.preferred_format,
          request_notes:
            requestForm.request_notes.trim() || null,
        }),
      });

      progressTimers.forEach((timer) => window.clearTimeout(timer));
      setRequestProgressStage("success");

      setSuccess(
        data.message ||
          "Document request submitted successfully."
      );
      await new Promise((resolve) =>
        window.setTimeout(resolve, 700)
      );
      setSelectedRecord(null);
      setRequestForm(initialRequestForm);
    } catch (err: unknown) {
      progressTimers.forEach((timer) => window.clearTimeout(timer));
      setModalError(
        err instanceof Error
          ? err.message
          : "Failed to submit the document request."
      );
    } finally {
      setSubmitting(false);
      setRequestProgressStage("validating");
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full min-w-0 max-w-7xl pb-8">
        <header className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-4 py-3.5 text-white shadow-md shadow-[#075A3A]/10">
          <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <div className="absolute -bottom-16 left-1/3 h-32 w-32 rounded-full bg-[#6B0F2B]/30 blur-3xl" />

          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#F4C25E]">
                Staff Access
              </p>

              <h1 className="mt-0.5 text-lg font-extrabold tracking-tight sm:text-xl">
                Archive Catalog
              </h1>

              <p className="mt-0.5 max-w-2xl text-[11px] leading-4 text-[#E5DDCC] sm:text-xs">
                Browse archived institutional records and request access
                to documents needed for official work.
              </p>
            </div>

            <div className="flex flex-col items-start gap-2 sm:items-end">
              <div className="flex w-fit items-center gap-1.5 rounded-lg bg-[#6B0F2B] px-2.5 py-1.5 text-xs font-bold text-white shadow-sm ring-1 ring-white/10">
                <span className="hidden h-6 w-6 items-center justify-center rounded-md bg-[#D9961A] sm:flex">
                  <Archive className="h-4 w-4" />
                </span>
                {total} available {total === 1 ? "record" : "records"}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#E5DDCC]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    backgroundRefreshing
                      ? "animate-pulse bg-[#F4C25E]"
                      : "bg-emerald-300"
                  }`}
                />
                {backgroundRefreshing
                  ? "Checking for updates..."
                  : "Auto-refresh active"}
              </div>
            </div>
          </div>
        </header>

        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <section className="relative mt-3 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#DED5C5]">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#D9961A]" />
          <div className="border-b border-[#E3DCCE] bg-[#FCFAF5] p-3 pt-4">
            <form
              onSubmit={handleSearch}
              className="flex min-w-0 flex-col gap-2 sm:flex-row"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A09582]" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  type="search"
                  inputMode="search"
                  placeholder="Search by title, code, description, or source..."
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

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              <FilterSelect
                label="Category"
                value={categoryId}
                disabled={optionsLoading}
                onChange={(value) => setCategoryId(value)}
              >
                <option value="">All categories</option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Department"
                value={departmentId}
                disabled={optionsLoading}
                onChange={(value) => setDepartmentId(value)}
              >
                <option value="">All departments</option>

                {departments.map((department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.name}
                  </option>
                ))}
              </FilterSelect>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => loadCatalog(1, search)}
                  disabled={loading}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-[#E3DCCE] bg-white px-3 py-2 text-xs font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] disabled:opacity-50"
                >
                  <Filter className="h-4 w-4" />
                  Apply
                </button>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    disabled={loading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E3DCCE] text-[#766F63] transition hover:bg-[#F8F5EE] hover:text-red-600 disabled:opacity-50"
                    aria-label="Clear filters"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-[#766F63]">
                Showing {records.length} of {total} available {total === 1 ? "record" : "records"}
              </p>
              <ViewModeToggle value={viewMode} onChange={changeView} />
            </div>
            {loading ? (
              <LoadingState />
            ) : records.length === 0 ? (
              <EmptyState hasFilters={hasFilters} />
            ) : viewMode === "grid" ? (
              <div className="grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                {records.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    onRequest={() =>
                      openRequestModal(record)
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#E3DCCE]">
                <div className="grid min-w-[980px] grid-cols-[minmax(280px,1.5fr)_160px_180px_150px_170px] gap-3 border-b border-[#E3DCCE] bg-[#F8F5EE] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#766F63]">
                  <span>Record</span>
                  <span>Category</span>
                  <span>Department</span>
                  <span>Archived</span>
                  <span className="text-right">Access</span>
                </div>
                {records.map((record) => (
                  <CatalogListEntry
                    key={record.id}
                    record={record}
                    onRequest={() => openRequestModal(record)}
                  />
                ))}
              </div>
            )}

            {!loading && lastPage > 1 && (
              <div className="mt-6 flex flex-col gap-3 border-t border-[#E3DCCE] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-sm text-[#766F63] sm:text-left">
                  Page {currentPage} of {lastPage}
                </p>

                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || loading}
                    onClick={() =>
                      loadCatalog(currentPage - 1, search)
                    }
                    className="min-h-11 rounded-xl border border-[#E3DCCE] bg-white px-4 py-2.5 text-sm font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={
                      currentPage >= lastPage || loading
                    }
                    onClick={() =>
                      loadCatalog(currentPage + 1, search)
                    }
                    className="min-h-11 rounded-xl border border-[#E3DCCE] bg-white px-4 py-2.5 text-sm font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedRecord && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-[#6B0F2B]/60 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRequestModal();
            }
          }}
        >
          <form
            onSubmit={submitDocumentRequest}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-document-title"
            className="max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl ring-1 ring-[#DED5C5] sm:max-w-xl sm:rounded-3xl sm:p-6"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#E3DCCE] sm:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D9961A]">
                  Document Access
                </p>

                <h2
                  id="request-document-title"
                  className="mt-1 text-xl font-bold text-[#252A27]"
                >
                  Request Document
                </h2>
              </div>

              <button
                type="button"
                onClick={closeRequestModal}
                disabled={submitting}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#766F63] transition hover:bg-[#F0ECE4] disabled:opacity-50"
                aria-label="Close request form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 min-w-0 rounded-2xl bg-gradient-to-br from-[#F0F7F3] to-[#FFF9EA] p-4 ring-1 ring-[#D9D2C4]">
              <p className="break-words font-bold text-[#2D332F]">
                {selectedRecord.title}
              </p>

              <p className="mt-1 break-all text-xs font-medium text-[#766F63]">
                {selectedRecord.record_code}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <AccessBadge
                  accessLevel={selectedRecord.access_level}
                />

                {selectedRecord.category?.name && (
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#625E56] ring-1 ring-[#DED5C5]">
                    {selectedRecord.category.name}
                  </span>
                )}
              </div>
            </div>

            {modalError && (
              <div className="mt-4">
                <Alert tone="error">{modalError}</Alert>
              </div>
            )}

            <label className="mt-5 block">
              <span className="text-sm font-semibold text-[#514D46]">
                Purpose of request
              </span>

              <textarea
                required
                name="purpose"
                rows={4}
                maxLength={1000}
                value={requestForm.purpose}
                onChange={updateRequestForm}
                placeholder="Explain why you need this document and how it will be used..."
                className="mt-2 w-full resize-none rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-base text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
              />

              <span className="mt-1 block text-right text-xs text-[#A09582]">
                {requestForm.purpose.length}/1000
              </span>
            </label>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-[#514D46]">
                  Urgency
                </span>

                <select
                  name="urgency"
                  value={requestForm.urgency}
                  onChange={updateRequestForm}
                  className="mt-2 min-h-12 w-full rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-base text-[#2D332F] outline-none focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-[#514D46]">
                  Preferred format
                </span>

                <select
                  name="preferred_format"
                  value={requestForm.preferred_format}
                  onChange={updateRequestForm}
                  className="mt-2 min-h-12 w-full rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-base text-[#2D332F] outline-none focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
                >
                  <option value="digital">Digital copy</option>
                  <option value="printed">Printed copy</option>
                  <option value="view_only">View only</option>
                </select>
              </label>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-[#514D46]">
                Additional notes
              </span>

              <textarea
                name="request_notes"
                rows={3}
                maxLength={5000}
                value={requestForm.request_notes}
                onChange={updateRequestForm}
                placeholder="Optional details, deadlines, or instructions..."
                className="mt-2 w-full resize-none rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-base text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
              />
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeRequestModal}
                disabled={submitting}
                className="min-h-12 rounded-xl border border-[#E3DCCE] px-5 py-3 text-sm font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  submitting || !requestForm.purpose.trim()
                }
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#6B0F2B]/20 transition hover:-translate-y-0.5 hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}

                {submitting
                  ? "Submitting..."
                  : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      )}
      <DocumentRequestProgressOverlay
        open={submitting}
        stage={requestProgressStage}
        documentTitle={selectedRecord?.title || "Archived document"}
      />
    </AppShell>
  );
}

function CatalogListEntry({
  record,
  onRequest,
}: {
  record: ArchiveRecord;
  onRequest: () => void;
}) {
  return (
    <article className="grid min-w-[980px] grid-cols-[minmax(280px,1.5fr)_160px_180px_150px_170px] items-center gap-3 border-b border-[#EEE8DD] px-3 py-3 text-xs last:border-0 hover:bg-[#FCFAF5]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#075A3A] text-[#F4C25E]">
          <FolderArchive className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold text-[#252A27]">{record.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-[#766F63]">{record.record_code}</p>
          <p className="mt-1 truncate text-[11px] text-[#A09582]">{record.archive_folder?.name || "Unfiled"}</p>
        </div>
      </div>
      <span className="truncate text-[#514D46]">{record.category?.name || "N/A"}</span>
      <span className="truncate text-[#514D46]">{record.department?.name || "N/A"}</span>
      <span className="text-[#514D46]">{formatDate(record.archived_at)}</span>
      <div className="flex items-center justify-end gap-2">
        <AccessBadge accessLevel={record.access_level} />
        <button
          type="button"
          onClick={onRequest}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#6B0F2B] px-3 font-bold text-white shadow-sm hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30"
        >
          <FileKey2 className="h-4 w-4" />
          Request
        </button>
      </div>
    </article>
  );
}

function RecordCard({
  record,
  onRequest,
}: {
  record: ArchiveRecord;
  onRequest: () => void;
}) {
  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#E3DCCE] bg-white p-3.5 transition hover:border-[#CFE0D6] hover:shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#075A3A] via-[#D9961A] to-[#6B0F2B]" />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#075A3A] text-[#F4C25E] shadow-sm">
          <FolderArchive className="h-4 w-4" />
        </div>

        <AccessBadge accessLevel={record.access_level} />
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="mt-3 break-words text-sm font-bold leading-5 text-[#252A27]">
          {record.title}
        </h2>

        <p className="mt-1 break-all text-xs font-medium text-[#766F63]">
          {record.record_code}
        </p>

        <p className="mt-2 line-clamp-2 min-h-[40px] break-words text-xs leading-5 text-[#766F63]">
          {record.description || "No description provided."}
        </p>
      </div>

      <div className="mt-3 space-y-2 rounded-lg bg-[#FCFAF5] p-2.5 ring-1 ring-[#E8E0D4]">
        <MetadataRow
          icon={<Tags className="h-4 w-4" />}
          label="Category"
          value={record.category?.name || "N/A"}
        />

        <MetadataRow
          icon={<Building2 className="h-4 w-4" />}
          label="Department"
          value={record.department?.name || "N/A"}
        />

        <MetadataRow
          icon={<CalendarDays className="h-4 w-4" />}
          label="Archived"
          value={formatDate(record.archived_at)}
        />

        <MetadataRow
          icon={<Archive className="h-4 w-4" />}
          label="Folder"
          value={record.archive_folder?.name || "Unfiled"}
        />
      </div>

      <button
        type="button"
        onClick={onRequest}
        className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#6B0F2B] px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30"
      >
        <FileKey2 className="h-4 w-4" />
        Request Document
      </button>
    </article>
  );
}

function AccessBadge({
  accessLevel,
}: {
  accessLevel: ArchiveRecord["access_level"];
}) {
  if (accessLevel === "internal") {
    return (
      <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-[#E6F2EC] px-2.5 py-1 text-[11px] font-bold text-[#075A3A] ring-1 ring-[#CFE0D6]">
        <ShieldCheck className="h-3.5 w-3.5" />
        Internal
      </span>
    );
  }

  return (
    <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-[#FFF3D6] px-2.5 py-1 text-[11px] font-bold text-[#A66B00] ring-1 ring-[#EBCF8F]">
      <LockKeyhole className="h-3.5 w-3.5" />
      Restricted
    </span>
  );
}

function MetadataRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[18px_78px_minmax(0,1fr)] items-start gap-2 text-xs">
      <span className="text-[#A09582]">{icon}</span>
      <span className="text-[#A09582]">{label}</span>
      <span className="min-w-0 break-words text-right font-semibold leading-5 text-[#514D46]">
        {value}
      </span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#A09582]">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-1.5 min-h-10 w-full rounded-lg border border-[#E3DCCE] bg-[#F8F5EE] px-3 py-2 text-sm text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {children}
      </select>
    </label>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-[#F8F5EE] px-5 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#075A3A]" />

      <p className="mt-3 text-sm font-medium text-[#766F63]">
        Loading archive catalog...
      </p>
    </div>
  );
}

function EmptyState({
  hasFilters,
}: {
  hasFilters: boolean;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#D7CDBB] bg-[#F8F5EE] px-5 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3D6] text-[#A66B00] shadow-sm ring-1 ring-[#EBCF8F]">
        <Archive className="h-7 w-7" />
      </div>

      <h2 className="mt-4 font-bold text-[#2D332F]">
        {hasFilters
          ? "No matching archived records"
          : "No records available"}
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-[#766F63]">
        {hasFilters
          ? "Try changing or clearing the search filters."
          : "There are currently no archived records available to staff."}
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
      role={tone === "error" ? "alert" : "status"}
      className={`mt-5 flex items-start gap-3 break-words rounded-2xl border px-4 py-3 text-sm font-medium ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {tone === "success" && (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      )}

      <span>{children}</span>
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
