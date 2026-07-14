"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  CheckCircle2,
  Clock3,
  Eye,
  FileCheck2,
  FileClock,
  FileX2,
  Loader2,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

type Role = {
  id: number;
  name: string;
};

type Department = {
  id: number;
  name: string;
};

type User = {
  id: number;
  name: string;
  email?: string;
  role?: Role | null;
  department?: Department | null;
};

type RequestRecord = {
  id: number;
  record_code: string;
  title: string;
  access_level?: string;
  category?: {
    id: number;
    name: string;
  } | null;
  department?: Department | null;
  archive_folder?: {
    id: number;
    name: string;
  } | null;
};

type DocumentRequest = {
  id: number;
  record_id: number;
  requested_by: number;
  assigned_to?: number | null;
  purpose: string;
  urgency: "normal" | "urgent";
  preferred_format: "digital" | "printed" | "view_only";
  status:
    | "pending"
    | "under_review"
    | "approved"
    | "rejected"
    | "released"
    | "cancelled";
  request_notes?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  released_at?: string | null;
  cancelled_at?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  record?: RequestRecord | null;
  requester?: User | null;
  assignee?: User | null;
};

type PaginationData = {
  data: DocumentRequest[];
  current_page: number;
  last_page: number;
  total: number;
};

type ActionMode =
  | "view"
  | "review"
  | "approve"
  | "reject"
  | "release";

export default function DocumentRequestsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [silentRefreshing, setSilentRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [autoRefreshNotice, setAutoRefreshNotice] = useState("");

  const [selectedRequest, setSelectedRequest] =
    useState<DocumentRequest | null>(null);

  const [actionMode, setActionMode] =
    useState<ActionMode>("view");

  const [reviewNotes, setReviewNotes] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalError, setModalError] = useState("");

  const currentPageRef = useRef(1);
  const searchRef = useRef("");
  const statusFilterRef = useRef("");
  const actionLoadingRef = useRef(false);
  const knownRequestIdsRef = useRef<Set<number>>(new Set());
  const pollingReadyRef = useRef(false);

  const roleName = user?.role?.name || "";

  const canManage =
    roleName === "Admin" || roleName === "Records Officer";

  const hasFilters = useMemo(
    () => Boolean(search.trim() || statusFilter),
    [search, statusFilter]
  );

  async function loadRequests(
    page = 1,
    customSearch = search,
    customStatus = statusFilter,
    silent = false
  ) {
    if (silent) {
      setSilentRefreshing(true);
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

      if (customStatus) {
        params.set("status", customStatus);
      }

      const data: PaginationData = await apiRequest(
        `/document-requests?${params.toString()}`
      );

      const loadedRequests = data.data || [];
      const loadedIds = new Set(
        loadedRequests.map((request) => request.id)
      );

      if (silent && pollingReadyRef.current && canManage) {
        const newRequestCount = loadedRequests.filter(
          (request) =>
            !knownRequestIdsRef.current.has(request.id) &&
            request.status === "pending"
        ).length;

        if (newRequestCount > 0) {
          setAutoRefreshNotice(
            `${newRequestCount} new ${
              newRequestCount === 1 ? "request" : "requests"
            } received automatically.`
          );

          window.setTimeout(() => {
            setAutoRefreshNotice("");
          }, 5000);
        }
      }

      knownRequestIdsRef.current = loadedIds;
      pollingReadyRef.current = true;

      setRequests(loadedRequests);
      setCurrentPage(data.current_page || 1);
      setLastPage(data.last_page || 1);
      setTotal(data.total || 0);
      setLastUpdatedAt(new Date());
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load document requests."
      );
    } finally {
      if (silent) {
        setSilentRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    async function initializePage() {
      try {
        const meData = await apiRequest("/me");
        const currentUser = meData.user;

        if (
          !["Admin", "Records Officer", "Staff"].includes(
            currentUser?.role?.name
          )
        ) {
          router.replace("/dashboard");
          return;
        }

        setUser(currentUser);
        await loadRequests(1, "", "");
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to open document requests."
        );
        setLoading(false);
      }
    }

    initializePage();
  }, []);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  useEffect(() => {
    statusFilterRef.current = statusFilter;
  }, [statusFilter]);

  useEffect(() => {
    actionLoadingRef.current = actionLoading;
  }, [actionLoading]);

  useEffect(() => {
    if (!user) return;

    async function silentlyRefresh() {
      if (
        document.visibilityState !== "visible" ||
        actionLoadingRef.current
      ) {
        return;
      }

      await loadRequests(
        currentPageRef.current,
        searchRef.current,
        statusFilterRef.current,
        true
      );
    }

    const intervalId = window.setInterval(() => {
      void silentlyRefresh();
    }, 5000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void silentlyRefresh();
      }
    }

    function handleWindowFocus() {
      void silentlyRefresh();
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [user, canManage]);

  useEffect(() => {
    if (!selectedRequest) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !actionLoading) {
        closeModal();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [selectedRequest, actionLoading]);

  function openModal(
    request: DocumentRequest,
    mode: ActionMode = "view"
  ) {
    setSelectedRequest(request);
    setActionMode(mode);
    setReviewNotes(request.review_notes || "");
    setExpiresAt(toDateTimeLocal(request.expires_at));
    setModalError("");
    setSuccess("");
  }

  function closeModal() {
    if (actionLoading) return;

    setSelectedRequest(null);
    setActionMode("view");
    setReviewNotes("");
    setExpiresAt("");
    setModalError("");
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    loadRequests(1, search, statusFilter);
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setSuccess("");

    setTimeout(() => {
      loadRequests(1, "", "");
    }, 0);
  }

  async function runAction(
    endpoint: string,
    body?: Record<string, unknown>
  ) {
    if (!selectedRequest) return;

    setActionLoading(true);
    setModalError("");

    try {
      const data = await apiRequest(
        `/document-requests/${selectedRequest.id}/${endpoint}`,
        {
          method: "POST",
          body: body ? JSON.stringify(body) : undefined,
        }
      );

      setSelectedRequest(null);
      setActionMode("view");
      setReviewNotes("");
      setExpiresAt("");

      setSuccess(
        data.message || "Document request updated successfully."
      );

      await loadRequests(currentPage, search, statusFilter);
    } catch (err: unknown) {
      setModalError(
        err instanceof Error
          ? err.message
          : "Failed to update the document request."
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel(request: DocumentRequest) {
    const confirmed = window.confirm(
      `Cancel your request for "${request.record?.title || "this document"}"?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const data = await apiRequest(
        `/document-requests/${request.id}/cancel`,
        {
          method: "POST",
        }
      );

      setSuccess(
        data.message || "Document request cancelled."
      );

      await loadRequests(currentPage, search, statusFilter);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to cancel the request."
      );
    }
  }

  async function submitAction(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedRequest) return;

    if (actionMode === "review") {
      await runAction("start-review");
      return;
    }

    if (actionMode === "approve") {
      await runAction("approve", {
        review_notes: reviewNotes.trim() || null,
        expires_at: expiresAt
          ? new Date(expiresAt).toISOString()
          : null,
      });
      return;
    }

    if (actionMode === "reject") {
      if (!reviewNotes.trim()) {
        setModalError(
          "Review notes are required when rejecting a request."
        );
        return;
      }

      await runAction("reject", {
        review_notes: reviewNotes.trim(),
      });

      return;
    }

    if (actionMode === "release") {
      await runAction("release", {
        review_notes: reviewNotes.trim() || null,
      });
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full min-w-0 max-w-7xl pb-8">
        <header className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-4 py-3.5 text-white shadow-md shadow-[#075A3A]/10">
          <div className="absolute -right-14 -top-16 h-40 w-40 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <div className="absolute -bottom-16 left-1/3 h-32 w-32 rounded-full bg-[#6B0F2B]/30 blur-3xl" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#F4C25E]">
                {canManage
                  ? "Request Management"
                  : "Staff Document Access"}
              </p>

              <h1 className="mt-0.5 text-lg font-extrabold tracking-tight sm:text-xl">
                Document Requests
              </h1>

              <p className="mt-0.5 max-w-2xl text-[11px] leading-4 text-[#E5DDCC] sm:text-xs">
                {canManage
                  ? "Review, approve, reject, and release requested archive documents."
                  : "Track requests you submitted for archived documents."}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#6B0F2B] px-2.5 py-1.5 text-xs font-bold text-white shadow-sm ring-1 ring-white/10">
              <span className="hidden h-6 w-6 items-center justify-center rounded-md bg-[#D9961A] sm:flex">
                <FileClock className="h-4 w-4" />
              </span>
              {total} {total === 1 ? "request" : "requests"}
            </div>
          </div>
        </header>

        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        {autoRefreshNotice && (
          <Alert tone="success">{autoRefreshNotice}</Alert>
        )}

        <section className="relative mt-3 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#DED5C5]">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#D9961A]" />
          <div className="border-b border-[#E3DCCE] bg-[#FCFAF5] p-3 pt-4">
            <div className="mb-3 flex flex-col gap-1.5 rounded-lg border border-[#CFE0D6] bg-[#F0F7F3] px-3 py-2 text-[10px] text-[#075A3A] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-600" />
                </span>
                Automatic updates are active every 5 seconds.
              </div>

              <div className="flex items-center gap-2 text-[#4E695B]">
                {silentRefreshing && (
                  <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                )}
                <span>
                  {silentRefreshing
                    ? "Checking for updates..."
                    : lastUpdatedAt
                      ? `Last updated ${lastUpdatedAt.toLocaleTimeString(
                          "en-PH",
                          {
                            hour: "numeric",
                            minute: "2-digit",
                            second: "2-digit",
                          }
                        )}`
                      : "Waiting for first update"}
                </span>
              </div>
            </div>

            <form
              onSubmit={handleSearch}
              className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_180px_auto]"
            >
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A09582]" />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  type="search"
                  inputMode="search"
                  placeholder="Search by record title or code..."
                  className="min-h-10 w-full rounded-lg border border-[#E3DCCE] bg-[#F8F5EE] py-2 pl-10 pr-3 text-sm text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC]"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="min-h-10 w-full rounded-lg border border-[#E3DCCE] bg-[#F8F5EE] px-3 py-2 text-sm text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC]"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="under_review">
                  Under Review
                </option>
                <option value="approved">Approved</option>
                <option value="released">Released</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#075A3A] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#043D28] focus:outline-none focus:ring-4 focus:ring-[#CFE0D6] disabled:cursor-not-allowed disabled:opacity-60 lg:flex-none"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Search
                </button>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    disabled={loading}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E3DCCE] text-[#766F63] transition hover:bg-[#F8F5EE] hover:text-red-600 disabled:opacity-50"
                    aria-label="Clear request filters"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="min-w-0 p-3">
            {loading ? (
              <LoadingState />
            ) : requests.length === 0 ? (
              <EmptyState
                canManage={canManage}
                hasFilters={hasFilters}
              />
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-2.5 lg:grid-cols-2 xl:grid-cols-3">
                {requests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    canManage={canManage}
                    onView={() =>
                      openModal(request, "view")
                    }
                    onReview={() =>
                      openModal(request, "review")
                    }
                    onApprove={() =>
                      openModal(request, "approve")
                    }
                    onReject={() =>
                      openModal(request, "reject")
                    }
                    onRelease={() =>
                      openModal(request, "release")
                    }
                    onCancel={() =>
                      handleCancel(request)
                    }
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
                      loadRequests(
                        currentPage - 1,
                        search,
                        statusFilter
                      )
                    }
                    className="min-h-11 rounded-xl border border-[#E3DCCE] bg-white px-4 py-2.5 text-sm font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] disabled:opacity-40"
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    disabled={
                      currentPage >= lastPage || loading
                    }
                    onClick={() =>
                      loadRequests(
                        currentPage + 1,
                        search,
                        statusFilter
                      )
                    }
                    className="min-h-11 rounded-xl border border-[#E3DCCE] bg-white px-4 py-2.5 text-sm font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedRequest && (
        <RequestModal
          request={selectedRequest}
          mode={actionMode}
          canManage={canManage}
          reviewNotes={reviewNotes}
          expiresAt={expiresAt}
          loading={actionLoading}
          error={modalError}
          onReviewNotesChange={setReviewNotes}
          onExpiresAtChange={setExpiresAt}
          onClose={closeModal}
          onSubmit={submitAction}
        />
      )}
    </AppShell>
  );
}

function RequestCard({
  request,
  canManage,
  onView,
  onReview,
  onApprove,
  onReject,
  onRelease,
  onCancel,
}: {
  request: DocumentRequest;
  canManage: boolean;
  onView: () => void;
  onReview: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRelease: () => void;
  onCancel: () => void;
}) {
  const canStartReview =
    canManage && request.status === "pending";

  const canApproveOrReject =
    canManage &&
    ["pending", "under_review"].includes(request.status);

  const canRelease =
    canManage && request.status === "approved";

  const canCancel =
    !canManage &&
    ["pending", "under_review"].includes(request.status);

  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#E3DCCE] bg-white p-3.5 transition hover:border-[#CFE0D6] hover:shadow-sm">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#075A3A] via-[#D9961A] to-[#6B0F2B]" />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#075A3A] text-[#F4C25E] shadow-sm">
          <Archive className="h-4 w-4" />
        </div>

        <StatusBadge status={request.status} />
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="mt-3 break-words text-sm font-bold leading-5 text-[#252A27]">
          {request.record?.title || "Archived Document"}
        </h2>

        <p className="mt-1 break-all text-xs font-medium text-[#766F63]">
          {request.record?.record_code || "No record code"}
        </p>

        <p className="mt-2 line-clamp-2 min-h-[40px] break-words text-xs leading-5 text-[#766F63]">
          {request.purpose}
        </p>
      </div>

      <div className="mt-3 space-y-2 rounded-lg bg-[#FCFAF5] p-2.5 text-[11px] ring-1 ring-[#E8E0D4]">
        {canManage && (
          <InfoLine
            label="Requested by"
            value={request.requester?.name || "Unknown"}
          />
        )}

        <InfoLine
          label="Urgency"
          value={formatLabel(request.urgency)}
        />

        <InfoLine
          label="Format"
          value={formatLabel(request.preferred_format)}
        />

        <InfoLine
          label="Folder"
          value={request.record?.archive_folder?.name || "Unfiled"}
        />

        <InfoLine
          label="Requested"
          value={formatDateTime(request.created_at)}
        />

        {request.assignee?.name && (
          <InfoLine
            label="Assigned to"
            value={request.assignee.name}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onView}
        className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#E3DCCE] bg-white px-3 py-2 text-xs font-semibold text-[#514D46] transition hover:bg-[#F8F5EE]"
      >
        <Eye className="h-4 w-4" />
        View Details
      </button>

      {(canStartReview ||
        canApproveOrReject ||
        canRelease ||
        canCancel) && (
        <div className="mt-2.5 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {canStartReview && (
            <button
              type="button"
              onClick={onReview}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              <FileClock className="h-4 w-4" />
              Start Review
            </button>
          )}

          {canApproveOrReject && (
            <>
              <button
                type="button"
                onClick={onApprove}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <FileCheck2 className="h-4 w-4" />
                Approve
              </button>

              <button
                type="button"
                onClick={onReject}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                <FileX2 className="h-4 w-4" />
                Reject
              </button>
            </>
          )}

          {canRelease && (
            <button
              type="button"
              onClick={onRelease}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-3 py-2.5 text-sm font-bold text-white transition hover:bg-[#571023] min-[420px]:col-span-2"
            >
              <Send className="h-4 w-4" />
              Mark Released
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 min-[420px]:col-span-2"
            >
              <X className="h-4 w-4" />
              Cancel Request
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function RequestModal({
  request,
  mode,
  canManage,
  reviewNotes,
  expiresAt,
  loading,
  error,
  onReviewNotesChange,
  onExpiresAtChange,
  onClose,
  onSubmit,
}: {
  request: DocumentRequest;
  mode: ActionMode;
  canManage: boolean;
  reviewNotes: string;
  expiresAt: string;
  loading: boolean;
  error: string;
  onReviewNotesChange: (value: string) => void;
  onExpiresAtChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const isActionMode = mode !== "view";

  const modalTitle = {
    view: "Request Details",
    review: "Start Request Review",
    approve: "Approve Request",
    reject: "Reject Request",
    release: "Release Document",
  }[mode];

  const submitLabel = {
    view: "",
    review: "Start Review",
    approve: "Approve Request",
    reject: "Reject Request",
    release: "Mark as Released",
  }[mode];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[#17231E]/70 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        className="max-h-[94dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl ring-1 ring-[#DED5C5] sm:max-w-2xl sm:rounded-3xl sm:p-6"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#E3DCCE] sm:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D9961A]">
              Document Request
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#252A27]">
              {modalTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#766F63] transition hover:bg-[#F0ECE4] disabled:opacity-50"
            aria-label="Close request details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-gradient-to-br from-[#F0F7F3] to-[#FFF9EA] p-4 ring-1 ring-[#D9D2C4]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="break-words font-bold text-[#2D332F]">
                {request.record?.title || "Archived Document"}
              </p>

              <p className="mt-1 break-all text-xs font-medium text-[#766F63]">
                {request.record?.record_code || "No record code"}
              </p>
            </div>

            <StatusBadge status={request.status} />
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {canManage && (
            <DetailBox
              label="Requested by"
              value={request.requester?.name || "Unknown"}
            />
          )}

          <DetailBox
            label="Urgency"
            value={formatLabel(request.urgency)}
          />

          <DetailBox
            label="Preferred format"
            value={formatLabel(request.preferred_format)}
          />

          <DetailBox
            label="Archive folder"
            value={request.record?.archive_folder?.name || "Unfiled"}
          />

          <DetailBox
            label="Requested on"
            value={formatDateTime(request.created_at)}
          />

          {request.assignee?.name && (
            <DetailBox
              label="Assigned to"
              value={request.assignee.name}
            />
          )}

          {request.expires_at && (
            <DetailBox
              label="Access expires"
              value={formatDateTime(request.expires_at)}
            />
          )}
        </div>

        <div className="mt-5">
          <p className="text-sm font-semibold text-[#514D46]">
            Purpose
          </p>

          <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-[#F8F5EE] px-4 py-3 text-sm leading-6 text-[#514D46] ring-1 ring-[#DED5C5]">
            {request.purpose}
          </p>
        </div>

        {request.request_notes && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-[#514D46]">
              Request notes
            </p>

            <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-[#F8F5EE] px-4 py-3 text-sm leading-6 text-[#514D46] ring-1 ring-[#DED5C5]">
              {request.request_notes}
            </p>
          </div>
        )}

        {mode === "view" && request.review_notes && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-[#514D46]">
              Review notes
            </p>

            <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-gradient-to-br from-[#F0F7F3] to-[#FFF9EA] px-4 py-3 text-sm leading-6 text-[#064D33] ring-1 ring-[#CFE0D6]">
              {request.review_notes}
            </p>
          </div>
        )}

        {isActionMode && mode !== "review" && (
          <label className="mt-5 block">
            <span className="text-sm font-semibold text-[#514D46]">
              {mode === "reject"
                ? "Rejection reason"
                : "Review notes"}
            </span>

            <textarea
              rows={4}
              required={mode === "reject"}
              value={reviewNotes}
              onChange={(event) =>
                onReviewNotesChange(event.target.value)
              }
              placeholder={
                mode === "reject"
                  ? "Explain why this request is being rejected..."
                  : "Add optional notes or release instructions..."
              }
              className="mt-2 w-full resize-none rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-base text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
            />
          </label>
        )}

        {mode === "approve" && (
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-[#514D46]">
              Access expiration
            </span>

            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) =>
                onExpiresAtChange(event.target.value)
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-base text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
            />

            <span className="mt-1 block text-xs text-[#A09582]">
              Optional. Leave blank if access should not expire.
            </span>
          </label>
        )}

        {mode === "review" && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            This request will be assigned to your account and moved to
            Under Review.
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="min-h-12 rounded-xl border border-[#E3DCCE] px-5 py-3 text-sm font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] disabled:opacity-50"
          >
            Close
          </button>

          {isActionMode && (
            <button
              type="submit"
              disabled={
                loading ||
                (mode === "reject" && !reviewNotes.trim())
              }
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                mode === "reject"
                  ? "bg-red-600 hover:bg-red-700"
                  : mode === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-[#6B0F2B] hover:bg-[#571023]"
              }`}
            >
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              {loading ? "Processing..." : submitLabel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: DocumentRequest["status"];
}) {
  const styles: Record<DocumentRequest["status"], string> = {
    pending: "bg-[#FFF3D6] text-[#A66B00] ring-1 ring-[#EBCF8F]",
    under_review: "bg-[#FFF3D6] text-[#A66B00] ring-1 ring-[#EBCF8F]",
    approved: "bg-[#E6F2EC] text-[#075A3A] ring-1 ring-[#CFE0D6]",
    released: "bg-[#F8E9EE] text-[#6B0F2B] ring-1 ring-[#E4CBD4]",
    rejected: "bg-red-50 text-red-700",
    cancelled: "bg-[#F0ECE4] text-[#625E56]",
  };

  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}
    >
      {status === "approved" || status === "released" ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : status === "rejected" ||
        status === "cancelled" ? (
        <FileX2 className="h-3.5 w-3.5" />
      ) : (
        <Clock3 className="h-3.5 w-3.5" />
      )}

      {formatLabel(status)}
    </span>
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

function DetailBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[#F8F5EE] px-4 py-3 ring-1 ring-[#DED5C5]">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#A09582]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-[#3F443F]">
        {value}
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-[#F8F5EE] px-5 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-[#075A3A]" />

      <p className="mt-3 text-sm font-medium text-[#766F63]">
        Loading document requests...
      </p>
    </div>
  );
}

function EmptyState({
  canManage,
  hasFilters,
}: {
  canManage: boolean;
  hasFilters: boolean;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[#D7CDBB] bg-[#F8F5EE] px-5 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#A09582] shadow-sm ring-1 ring-[#DED5C5]">
        {canManage ? (
          <ShieldCheck className="h-7 w-7" />
        ) : (
          <UserRound className="h-7 w-7" />
        )}
      </div>

      <h2 className="mt-4 font-bold text-[#2D332F]">
        {hasFilters
          ? "No matching requests"
          : canManage
            ? "No document requests yet"
            : "You have no document requests"}
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-[#766F63]">
        {hasFilters
          ? "Try changing or clearing the current filters."
          : canManage
            ? "Staff document requests will appear here when submitted."
            : "Visit the Archive Catalog to request an archived document."}
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

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function formatDateTime(date?: string | null) {
  if (!date) return "N/A";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateTimeLocal(date?: string | null) {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const offset = parsed.getTimezoneOffset();
  const localDate = new Date(
    parsed.getTime() - offset * 60 * 1000
  );

  return localDate.toISOString().slice(0, 16);
}