"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
  import Link from "next/link";
  import { useRouter, useSearchParams } from "next/navigation";
  import {
    Download,
    Eye,
    Files,
    Loader2,
    RefreshCcw,
    Search,
    X,
  } from "lucide-react";
  import AppShell from "@/components/AppShell";
  import { apiRequest } from "@/lib/api";
  import {
    defaultClientSystemSettings,
    loadClientSystemSettings,
  } from "@/lib/system-settings";
  import type { AuthUser } from "@/lib/types";

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000/api";

  const allTabs = [
    { label: "All", value: "" },
    { label: "Received", value: "received" },
    { label: "Under Review", value: "under_review" },
    { label: "Returned", value: "returned_for_correction" },
    { label: "Archived", value: "archived" },
    { label: "For Disposal", value: "for_disposal" },
  ];

  const staffTabs = [
    { label: "All", value: "" },
    { label: "Submitted", value: "received" },
    { label: "Under Review", value: "under_review" },
    { label: "Needs Correction", value: "returned_for_correction" },
    { label: "Archived", value: "archived" },
  ];

  type UserSummary = {
    id?: number;
    name?: string | null;
  };

  type RecordFile = {
    id: number;
    file_name: string;
    file_type?: string | null;
    file_size?: number | null;
  };

  type RecordItem = {
    id: number;
    created_by?: number;
    record_code: string;
    title: string;
    description?: string | null;
    remarks?: string | null;
    review_remarks?: string | null;
    correction_notes?: string | null;
    returned_at?: string | null;
    source?: string | null;
    date_received?: string | null;
    storage_location?: string | null;
    reviewed_at?: string | null;
    archived_at?: string | null;
    status: string;
    category?: { name?: string | null } | null;
    department?: { name?: string | null } | null;
    creator?: UserSummary | null;
    reviewer?: UserSummary | null;
    returner?: UserSummary | null;
    archiver?: UserSummary | null;
    files?: RecordFile[];
  };

  type ReviewPreset = {
    id: number;
    type: "review_remark" | "storage_location";
    value: string;
  };

  export default function RecordsPage() {
    return (
      <Suspense fallback={null}>
        <RecordsPageContent />
      </Suspense>
    );
  }

  function RecordsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [records, setRecords] = useState<RecordItem[]>([]);
    const [search, setSearch] = useState("");
    const [activeStatus, setActiveStatus] = useState("");
    const [loading, setLoading] = useState(true);
    const [silentRefreshing, setSilentRefreshing] = useState(false);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [autoRefreshNotice, setAutoRefreshNotice] = useState("");
    const [user, setUser] = useState<AuthUser | null>(null);
    const [systemSettings, setSystemSettings] = useState(
      defaultClientSystemSettings
    );

    const [selectedRecord, setSelectedRecord] =
      useState<RecordItem | null>(null);
    const [openingRecordId, setOpeningRecordId] = useState<number | null>(
      null
    );

    const [previewError, setPreviewError] = useState("");
    const [downloadError, setDownloadError] = useState("");
    const [downloadingFileId, setDownloadingFileId] = useState<
      number | null
    >(null);

    const [workflowLoading, setWorkflowLoading] = useState(false);
    const [workflowError, setWorkflowError] = useState("");
    const [workflowSuccess, setWorkflowSuccess] = useState("");
    const [reviewRemarks, setReviewRemarks] = useState("");
    const [correctionNotes, setCorrectionNotes] = useState("");
    const [storageLocation, setStorageLocation] = useState("");
    const [reviewPresets, setReviewPresets] = useState<ReviewPreset[]>([]);
    const [retentionType, setRetentionType] =
      useState<"permanent" | "temporary">("permanent");
    const [retentionYears, setRetentionYears] = useState("1");
    const [retentionUnit, setRetentionUnit] =
      useState<"years" | "minutes">("years");

    const searchRef = useRef("");
    const activeStatusRef = useRef("");
    const workflowLoadingRef = useRef(false);
    const knownRecordIdsRef = useRef<Set<number>>(new Set());
    const pollingReadyRef = useRef(false);

    const roleName = user?.role?.name || "";
    const isStaff = roleName === "Staff";
    const canManageWorkflow =
      roleName === "Records Officer" ||
      (roleName === "Admin" &&
        systemSettings.workflow.allow_admin_review);
    const scope = searchParams.get("scope");
    const isMySubmissionsView = isStaff || scope === "mine";

    const tabs = useMemo(
      () => (isMySubmissionsView ? staffTabs : allTabs),
      [isMySubmissionsView]
    );

    async function loadRecords(
      searchValue = search,
      statusValue = activeStatus,
      silent = false
    ) {
      if (silent) {
        setSilentRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams();

        if (scope === "mine" && !isStaff) {
          params.set("scope", "mine");
        }

        if (searchValue.trim()) {
          params.append("search", searchValue.trim());
        }

        if (statusValue) {
          params.append("status", statusValue);
        }

        const query = params.toString();
        const data = await apiRequest(
          query ? `/records?${query}` : "/records"
        );

        const loadedRecords: RecordItem[] = data.data || [];
        const loadedIds = new Set(
          loadedRecords.map((record) => record.id)
        );

        if (silent && pollingReadyRef.current) {
          const newCount = loadedRecords.filter(
            (record) =>
              !knownRecordIdsRef.current.has(record.id)
          ).length;

          if (newCount > 0) {
            setAutoRefreshNotice(
              `${newCount} new ${
                newCount === 1 ? "record" : "records"
              } received automatically.`
            );

            window.setTimeout(() => {
              setAutoRefreshNotice("");
            }, 5000);
          }
        }

        knownRecordIdsRef.current = loadedIds;
        pollingReadyRef.current = true;

        setRecords(loadedRecords);
        setLastUpdatedAt(new Date());
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "";

        if (message === "Unauthenticated.") {
          localStorage.removeItem("iram_token");
          localStorage.removeItem("iram_user");
          router.replace("/login");
          return;
        }

        alert(message || "Failed to load records.");
      } finally {
        if (silent) {
          setSilentRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    }

    useEffect(() => {
      async function initPage() {
        try {
          const [meData, loadedSettings] = await Promise.all([
            apiRequest("/me"),
            loadClientSystemSettings(),
          ]);

          setUser(meData.user);
          setSystemSettings(loadedSettings);
          localStorage.setItem(
            "iram_user",
            JSON.stringify(meData.user)
          );

          if (
            ["Admin", "Records Officer"].includes(
              meData.user?.role?.name || ""
            )
          ) {
            try {
              const presetData = await apiRequest("/review-presets");
              setReviewPresets(presetData.data || []);
            } catch {
              setReviewPresets([]);
            }
          }

          await loadRecords("", "");
        } catch {
          localStorage.removeItem("iram_token");
          localStorage.removeItem("iram_user");
          router.replace("/login");
        }
      }

      initPage();
    }, [router, scope]);

    useEffect(() => {
      searchRef.current = search;
    }, [search]);

    useEffect(() => {
      activeStatusRef.current = activeStatus;
    }, [activeStatus]);

    useEffect(() => {
      workflowLoadingRef.current = workflowLoading;
    }, [workflowLoading]);

    useEffect(() => {
      if (!user) return;

      async function silentlyRefreshRecords() {
        if (
          document.visibilityState !== "visible" ||
          workflowLoadingRef.current ||
          openingRecordId !== null
        ) {
          return;
        }

        await loadRecords(
          searchRef.current,
          activeStatusRef.current,
          true
        );
      }

      const intervalId = window.setInterval(() => {
        void silentlyRefreshRecords();
      }, 5000);

      function handleVisibilityChange() {
        if (document.visibilityState === "visible") {
          void silentlyRefreshRecords();
        }
      }

      function handleWindowFocus() {
        void silentlyRefreshRecords();
      }

      function handleRecordsChanged() {
        void silentlyRefreshRecords();
      }

      document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.addEventListener("focus", handleWindowFocus);
      window.addEventListener(
        "iram:records-changed",
        handleRecordsChanged
      );

      return () => {
        window.clearInterval(intervalId);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
        window.removeEventListener("focus", handleWindowFocus);
        window.removeEventListener(
          "iram:records-changed",
          handleRecordsChanged
        );
      };
    }, [user, openingRecordId]);

    useEffect(() => {
      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Escape" && !workflowLoading) {
          closePreview();
        }
      }

      if (selectedRecord || openingRecordId !== null) {
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);
      }

      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, [selectedRecord, openingRecordId, workflowLoading]);

    function handleSearch(event: React.FormEvent) {
      event.preventDefault();
      loadRecords(search, activeStatus);
    }

    function handleTabChange(status: string) {
      setActiveStatus(status);
      loadRecords(search, status);
    }

    function syncWorkflowFields(record: RecordItem) {
      setReviewRemarks(record.review_remarks || "");
      setCorrectionNotes(record.correction_notes || "");
      setStorageLocation(record.storage_location || "");
      setRetentionType("permanent");
      setRetentionYears("1");
      setRetentionUnit("years");
    }

    async function openPreview(recordId: number) {
      setOpeningRecordId(recordId);
      setPreviewError("");
      setDownloadError("");
      setWorkflowError("");
      setWorkflowSuccess("");

      try {
        const data = await apiRequest(`/records/${recordId}`);
        setSelectedRecord(data.record);
        syncWorkflowFields(data.record);
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load record details.";

        setPreviewError(message);

        const recordFromList = records.find(
          (record) => record.id === recordId
        );

        if (recordFromList) {
          setSelectedRecord(recordFromList);
          syncWorkflowFields(recordFromList);
        }
      } finally {
        setOpeningRecordId(null);
      }
    }

    function closePreview() {
      if (workflowLoading) return;

      setSelectedRecord(null);
      setPreviewError("");
      setDownloadError("");
      setWorkflowError("");
      setWorkflowSuccess("");
      setDownloadingFileId(null);
      setReviewRemarks("");
      setCorrectionNotes("");
      setStorageLocation("");
      setRetentionType("permanent");
      setRetentionYears("1");
      setRetentionUnit("years");
    }

    function replaceRecord(updatedRecord: RecordItem) {
      setSelectedRecord(updatedRecord);
      syncWorkflowFields(updatedRecord);

      setRecords((current) =>
        current.map((item) =>
          item.id === updatedRecord.id ? updatedRecord : item
        )
      );
    }

    async function runWorkflowAction(
      endpoint: string,
      options: RequestInit,
      successFallback: string
    ) {
      if (!selectedRecord) return;

      setWorkflowLoading(true);
      setWorkflowError("");
      setWorkflowSuccess("");

      try {
        const data = await apiRequest(endpoint, options);
        replaceRecord(data.record);
        setWorkflowSuccess(data.message || successFallback);
        await loadRecords(search, activeStatus);
      } catch (error: unknown) {
        setWorkflowError(
          error instanceof Error
            ? error.message
            : "The workflow action could not be completed."
        );
      } finally {
        setWorkflowLoading(false);
      }
    }

    async function handleStartReview() {
      if (!selectedRecord) return;

      await runWorkflowAction(
        `/records/${selectedRecord.id}/start-review`,
        {
          method: "POST",
          body: JSON.stringify({
            review_remarks: reviewRemarks.trim() || null,
          }),
        },
        "Record review started."
      );
    }

    async function handleSaveReview() {
      if (!selectedRecord) return;

      await runWorkflowAction(
        `/records/${selectedRecord.id}/review`,
        {
          method: "PATCH",
          body: JSON.stringify({
            review_remarks: reviewRemarks.trim() || null,
            storage_location: storageLocation.trim() || null,
          }),
        },
        "Review details saved."
      );
    }

    async function handleReturnForCorrection() {
      if (!selectedRecord) return;

      if (
        systemSettings.workflow.require_correction_notes &&
        !correctionNotes.trim()
      ) {
        setWorkflowError(
          "Correction notes are required before returning the submission."
        );
        return;
      }

      await runWorkflowAction(
        `/records/${selectedRecord.id}/return-for-correction`,
        {
          method: "POST",
          body: JSON.stringify({
            correction_notes: correctionNotes.trim() || null,
          }),
        },
        "Record returned to the submitter for correction."
      );
    }

    async function handleArchive() {
      if (!selectedRecord) return;

      if (!reviewRemarks.trim()) {
        setWorkflowError(
          "Review remarks are required before archiving."
        );
        return;
      }

      if (
        systemSettings.records.require_storage_location &&
        !storageLocation.trim()
      ) {
        setWorkflowError(
          "A storage location is required before archiving."
        );
        return;
      }

      const years = Number(retentionYears);
      if (
        retentionType === "temporary" &&
        (!Number.isInteger(years) || years < 1 || years > 100)
      ) {
        setWorkflowError(
          "Temporary retention must be a whole number from 1 to 100 years."
        );
        return;
      }

      await runWorkflowAction(
        `/records/${selectedRecord.id}/archive`,
        {
          method: "POST",
          body: JSON.stringify({
            review_remarks: reviewRemarks.trim(),
            storage_location: storageLocation.trim(),
            retention_type: retentionType,
            retention_years:
              retentionType === "temporary" ? years : null,
            retention_unit:
              retentionType === "temporary"
                ? retentionUnit
                : "years",
          }),
        },
        "Record archived successfully."
      );
    }

    async function handleDownload(file: RecordFile) {
      setDownloadingFileId(file.id);
      setDownloadError("");

      try {
        const token = localStorage.getItem("iram_token");

        if (!token) {
          throw new Error(
            "Your session has expired. Please log in again."
          );
        }

        const response = await fetch(
          `${API_URL}/record-files/${file.id}/download`,
          {
            method: "GET",
            headers: {
              Accept: "application/octet-stream",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const contentType =
            response.headers.get("content-type");

          if (contentType?.includes("application/json")) {
            const data = await response.json();
            throw new Error(
              data?.message || "Failed to download the file."
            );
          }

          throw new Error(
            `Download failed with status ${response.status}.`
          );
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const downloadLink = document.createElement("a");

        downloadLink.href = objectUrl;
        downloadLink.download =
          file.file_name || "record-file";

        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
        window.URL.revokeObjectURL(objectUrl);
      } catch (error: unknown) {
        setDownloadError(
          error instanceof Error
            ? error.message
            : "Failed to download the file."
        );
      } finally {
        setDownloadingFileId(null);
      }
    }

    function isOwnedByCurrentUser(record: RecordItem | null) {
      if (!record || !user?.id) return false;

      return (
        Number(record.created_by) === Number(user.id) ||
        Number(record.creator?.id) === Number(user.id)
      );
    }


    return (
      <AppShell>
        <div className="mx-auto w-full max-w-7xl">
          <section className="overflow-hidden rounded-xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-3.5 py-3 text-white shadow-md shadow-[#075A3A]/10 sm:px-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15 sm:flex">
                  <Files className="h-4 w-4 text-[#F4C25E]" />
                </div>

                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#F4C25E]">
                    {isMySubmissionsView
                      ? "Submission Tracking"
                      : canManageWorkflow
                      ? "Records Office Workflow"
                      : "Document Archive"}
                  </p>

                  <h1 className="mt-0.5 text-lg font-bold tracking-tight sm:text-xl">
                    {isMySubmissionsView ? "My Submissions" : "All Records"}
                  </h1>

                  <p className="mt-0.5 max-w-2xl text-[11px] leading-4 text-[#E5DDCC] sm:text-xs">
                    {isMySubmissionsView
                      ? "Track records submitted using your account, including items returned for correction."
                      : canManageWorkflow
                      ? "Review incoming submissions, assign storage locations, and archive approved records."
                      : "Search and view acquired records in the IRAM system."}
                  </p>
                </div>
              </div>

            </div>
          </section>

          {autoRefreshNotice && (
            <Alert tone="success">{autoRefreshNotice}</Alert>
          )}

          <section className="mt-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-[#DED5C5] sm:p-4">
            <div className="mb-3 flex flex-col gap-1.5 rounded-lg border border-[#CFE0D6] bg-[#F0F7F3] px-3 py-2 text-[11px] text-[#075A3A] sm:flex-row sm:items-center sm:justify-between">
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
              className="flex flex-col gap-2 md:flex-row"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A09582]" />
                <input
                  className="w-full rounded-lg border border-[#E3DCCE] bg-[#F8F5EE] py-2.5 pl-11 pr-3 text-sm text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC]"
                  placeholder="Search by code, title, description, or source..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#075A3A] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#043D28] focus:outline-none focus:ring-4 focus:ring-[#CFE0D6]"
              >
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>

            <div className="mt-3 overflow-x-auto">
              <div className="flex min-w-max gap-2">
                {tabs.map((tab) => {
                  const active = activeStatus === tab.value;

                  return (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => handleTabChange(tab.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "bg-[#6B0F2B] text-white shadow-sm"
                          : "bg-[#F0ECE4] text-[#625E56] hover:bg-[#FFF3D6] hover:text-[#6B0F2B]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mt-3 space-y-2 md:hidden">
            {loading && <EmptyCard text="Loading records..." />}

            {!loading && records.length === 0 && (
              <EmptyCard text="No records found." />
            )}

            {!loading &&
              records.map((record) => (
                <article
                  key={record.id}
                  className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-[#DED5C5] transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-[#2D332F]">
                        {record.title}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[#766F63]">
                        {record.record_code}
                      </p>
                    </div>

                    <StatusBadge
                      status={record.status}
                      isStaff={isStaff}
                    />
                  </div>

                  <div className="mt-3 grid gap-1.5 text-xs text-[#625E56]">
                    <InfoRow
                      label="Category"
                      value={record.category?.name || "N/A"}
                    />
                    <InfoRow
                      label="Department"
                      value={record.department?.name || "N/A"}
                    />
                    <InfoRow
                      label={isMySubmissionsView ? "Submitted" : "Received"}
                      value={formatDate(record.date_received)}
                    />
                    <InfoRow
                      label="Files"
                      value={String(record.files?.length || 0)}
                    />
                  </div>

                  {canManageWorkflow &&
                    record.status === "received" && (
                      <WorkflowHint text="Waiting for review to begin." />
                    )}

                  {canManageWorkflow &&
                    record.status === "under_review" && (
                      <WorkflowHint text="Review in progress. Archive the record or return it to the submitter with correction notes." />
                    )}

                  {isOwnedByCurrentUser(record) &&
                    record.status === "returned_for_correction" && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-xs font-bold text-amber-900">
                          Action required
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-amber-800">
                          {record.correction_notes ||
                            "The Records Officer returned this submission for correction."}
                        </p>
                      </div>
                    )}

                  <button
                    type="button"
                    onClick={() => openPreview(record.id)}
                    disabled={openingRecordId !== null}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#6B0F2B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#571023] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {openingRecordId === record.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    {openingRecordId === record.id
                      ? "Loading..."
                      : canManageWorkflow &&
                        ["received", "under_review"].includes(
                          record.status
                        )
                      ? "Review Record"
                      : isOwnedByCurrentUser(record) &&
                        record.status === "returned_for_correction"
                      ? "Correct"
                      : "View Record"}
                  </button>
                </article>
              ))}
          </section>

          <section className="mt-3 hidden overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#DED5C5] md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#F8F5EE] text-xs uppercase tracking-wide text-[#766F63]">
                  <tr>
                    <th className="px-5 py-3.5">Record</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Department</th>
                    <th className="px-5 py-3.5">
                      {isMySubmissionsView ? "Date Submitted" : "Date Received"}
                    </th>
                    <th className="px-5 py-3.5">Files</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#ECE5D8]">
                  {loading && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-6 text-center text-[#766F63]"
                      >
                        Loading records...
                      </td>
                    </tr>
                  )}

                  {!loading && records.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-6 text-center text-[#766F63]"
                      >
                        No records found.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    records.map((record) => (
                      <tr
                        key={record.id}
                        className="transition hover:bg-[#F8F5EE]"
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-[#2D332F]">
                            {record.title}
                          </p>
                          <p className="mt-1 text-xs text-[#766F63]">
                            {record.record_code}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-[#625E56]">
                          {record.category?.name || "N/A"}
                        </td>

                        <td className="px-5 py-4 text-[#625E56]">
                          {record.department?.name || "N/A"}
                        </td>

                        <td className="px-5 py-4 text-[#625E56]">
                          {formatDate(record.date_received)}
                        </td>

                        <td className="px-5 py-4 text-[#625E56]">
                          {record.files?.length || 0}
                        </td>

                        <td className="px-5 py-3.5">
                          <StatusBadge
                            status={record.status}
                            isStaff={isStaff}
                          />
                        </td>

                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => openPreview(record.id)}
                            disabled={openingRecordId !== null}
                            className="font-semibold text-[#075A3A] transition hover:text-[#075A3A] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {openingRecordId === record.id
                              ? "Loading..."
                              : canManageWorkflow &&
                                [
                                  "received",
                                  "under_review",
                                ].includes(record.status)
                              ? "Review"
                              : isOwnedByCurrentUser(record) &&
                                record.status ===
                                  "returned_for_correction"
                              ? "Correct"
                              : "View"}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {(selectedRecord || openingRecordId !== null) && (
          <RecordPreviewModal
            record={selectedRecord}
            currentUserId={user?.id}
            loading={openingRecordId !== null}
            error={previewError}
            downloadError={downloadError}
            downloadingFileId={downloadingFileId}
            canManageWorkflow={canManageWorkflow}
            reviewRemarks={reviewRemarks}
            reviewPresets={reviewPresets}
            correctionNotes={correctionNotes}
            storageLocation={storageLocation}
            retentionType={retentionType}
            retentionYears={retentionYears}
            retentionUnit={retentionUnit}
            workflowLoading={workflowLoading}
            workflowError={workflowError}
            workflowSuccess={workflowSuccess}
            onReviewRemarksChange={setReviewRemarks}
            onCorrectionNotesChange={setCorrectionNotes}
            onStorageLocationChange={setStorageLocation}
            onRetentionTypeChange={setRetentionType}
            onRetentionYearsChange={setRetentionYears}
            onRetentionUnitChange={setRetentionUnit}
            onStartReview={handleStartReview}
            onSaveReview={handleSaveReview}
            onReturnForCorrection={handleReturnForCorrection}
            onArchive={handleArchive}
            onClose={closePreview}
            onDownload={handleDownload}
          />
        )}
      </AppShell>
    );
  }

  function RecordPreviewModal({
    record,
    currentUserId,
    loading,
    error,
    downloadError,
    downloadingFileId,
    canManageWorkflow,
    reviewRemarks,
    reviewPresets,
    correctionNotes,
    storageLocation,
    retentionType,
    retentionYears,
    retentionUnit,
    workflowLoading,
    workflowError,
    workflowSuccess,
    onReviewRemarksChange,
    onCorrectionNotesChange,
    onStorageLocationChange,
    onRetentionTypeChange,
    onRetentionYearsChange,
    onRetentionUnitChange,
    onStartReview,
    onSaveReview,
    onReturnForCorrection,
    onArchive,
    onClose,
    onDownload,
  }: {
    record: RecordItem | null;
    currentUserId?: number;
    loading: boolean;
    error: string;
    downloadError: string;
    downloadingFileId: number | null;
    canManageWorkflow: boolean;
    reviewRemarks: string;
    reviewPresets: ReviewPreset[];
    correctionNotes: string;
    storageLocation: string;
    retentionType: "permanent" | "temporary";
    retentionYears: string;
    retentionUnit: "years" | "minutes";
    workflowLoading: boolean;
    workflowError: string;
    workflowSuccess: string;
    onReviewRemarksChange: (value: string) => void;
    onCorrectionNotesChange: (value: string) => void;
    onStorageLocationChange: (value: string) => void;
    onRetentionTypeChange: (
      value: "permanent" | "temporary"
    ) => void;
    onRetentionYearsChange: (value: string) => void;
    onRetentionUnitChange: (
      value: "years" | "minutes"
    ) => void;
    onStartReview: () => void;
    onSaveReview: () => void;
    onReturnForCorrection: () => void;
    onArchive: () => void;
    onClose: () => void;
    onDownload: (file: RecordFile) => void;
  }) {
    const files = record?.files || [];
    const reviewRemarkPresets = reviewPresets.filter(
      (preset) => preset.type === "review_remark"
    );
    const storageLocationPresets = reviewPresets.filter(
      (preset) => preset.type === "storage_location"
    );
    const previewScrollRef = useRef<HTMLDivElement>(null);
    const isUnderReview = record?.status === "under_review";
    const isReceived = record?.status === "received";
    const showWorkflow =
      canManageWorkflow && (isReceived || isUnderReview);
    const isRecordOwner =
      Number(record?.created_by) === Number(currentUserId) ||
      Number(record?.creator?.id) === Number(currentUserId);
    const canCorrect =
      isRecordOwner &&
      record?.status === "returned_for_correction";

    useEffect(() => {
      previewScrollRef.current?.scrollTo({
        top: 0,
        behavior: "instant",
      });
    }, [record?.id]);

    if (typeof document === "undefined") return null;

    return createPortal(
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[#132019]/70 p-3 backdrop-blur-sm sm:p-6"
        onMouseDown={(event) => {
          if (
            event.target === event.currentTarget &&
            !workflowLoading
          ) {
            onClose();
          }
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-preview-title"
          className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_24px_80px_rgba(8,28,19,0.28)] sm:max-h-[92vh] sm:max-w-[1180px]"
        >
          <header className="shrink-0 bg-gradient-to-r from-[#075A3A] to-[#04432D] px-5 py-4 text-white sm:px-7 sm:py-5">
            <div className="flex items-center justify-between gap-5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#F4C25E]">
                  {showWorkflow
                    ? "Records Officer Review"
                    : isRecordOwner
                    ? "Submission Preview"
                    : "Record Preview"}
                </p>

                <h2
                  id="record-preview-title"
                  className="mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl"
                >
                  {record?.title || "Loading record..."}
                </h2>

                {record?.record_code && (
                  <p className="mt-1 text-xs font-medium tracking-wide text-[#D7E4DD] sm:text-sm">
                    {record.record_code}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={workflowLoading}
                aria-label="Close record preview"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div
            ref={previewScrollRef}
            className="flex-1 overflow-y-auto bg-[#F6F7F5] px-4 py-4 sm:px-6 sm:py-6"
          >
            {loading && !record ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl bg-[#F8F5EE] text-sm font-medium text-[#766F63]">
                <Loader2 className="h-6 w-6 animate-spin text-[#075A3A]" />
                <span className="mt-3">Loading record details...</span>
              </div>
            ) : record ? (
              <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
                <main className="min-w-0 space-y-5">
                  {error && (
                    <Alert tone="warning">
                      Some details could not be loaded: {error}
                    </Alert>
                  )}

                  {workflowError && (
                    <Alert tone="error">{workflowError}</Alert>
                  )}

                  {workflowSuccess && (
                    <Alert tone="success">{workflowSuccess}</Alert>
                  )}

                  {showWorkflow && (
                    <section className="rounded-2xl border border-[#D9E3DD] bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-[#252A27]">
                            Review Workflow
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-[#625E56]">
                            {isReceived
                              ? "Start the formal review after checking the submitted metadata and attachments."
                              : "Document the review result, assign the physical or digital storage location, then archive the record."}
                          </p>
                        </div>
                        <StatusBadge status={record.status} />
                      </div>

                      {isReceived && (
                        <div className="mt-5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="text-sm font-semibold text-[#3F443F]">
                              Initial review note
                            </label>
                            <PresetSelect
                              presets={reviewRemarkPresets}
                              disabled={workflowLoading}
                              onSelect={onReviewRemarksChange}
                            />
                          </div>
                          <textarea
                            rows={3}
                            value={reviewRemarks}
                            onChange={(event) =>
                              onReviewRemarksChange(
                                event.target.value
                              )
                            }
                            disabled={workflowLoading}
                            placeholder="Optional note before starting review..."
                            className="mt-2 w-full rounded-xl border border-[#E3DCCE] bg-white px-4 py-3 text-sm text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:ring-4 focus:ring-[#CFE0D6] disabled:opacity-60"
                          />

                          <button
                            type="button"
                            onClick={onStartReview}
                            disabled={workflowLoading}
                            className="mt-4 flex w-full items-center justify-center rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#571023] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                          >
                            {workflowLoading
                              ? "Starting Review..."
                              : "Start Review"}
                          </button>
                        </div>
                      )}

                      {isUnderReview && (
                        <div className="mt-5 space-y-4">
                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="text-sm font-semibold text-[#3F443F]">
                                Review remarks
                              </label>
                              <PresetSelect
                                presets={reviewRemarkPresets}
                                disabled={workflowLoading}
                                onSelect={onReviewRemarksChange}
                              />
                            </div>
                            <textarea
                              rows={5}
                              value={reviewRemarks}
                              onChange={(event) =>
                                onReviewRemarksChange(
                                  event.target.value
                                )
                              }
                              disabled={workflowLoading}
                              placeholder="Describe the verification performed and the review result..."
                              className="mt-2 w-full rounded-xl border border-[#E3DCCE] bg-white px-4 py-3 text-sm text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:ring-4 focus:ring-[#CFE0D6] disabled:opacity-60"
                            />
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label className="text-sm font-semibold text-[#3F443F]">
                                Storage location
                              </label>
                              <PresetSelect
                                presets={storageLocationPresets}
                                disabled={workflowLoading}
                                onSelect={onStorageLocationChange}
                              />
                            </div>
                            <input
                              value={storageLocation}
                              onChange={(event) =>
                                onStorageLocationChange(
                                  event.target.value
                                )
                              }
                              disabled={workflowLoading}
                              placeholder="Example: Archive Room A / Shelf 2 / Box 14"
                              className="mt-2 w-full rounded-xl border border-[#E3DCCE] bg-white px-4 py-3 text-sm text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:ring-4 focus:ring-[#CFE0D6] disabled:opacity-60"
                            />
                          </div>

                          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                            <label className="text-sm font-semibold text-[#3F443F]">
                              Retention schedule
                            </label>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {(
                                [
                                  {
                                    label: "Permanent",
                                    type: "permanent",
                                    unit: "years",
                                  },
                                  {
                                    label: "Temporary",
                                    type: "temporary",
                                    unit: "years",
                                  },
                                  {
                                    label: "1-min Practice",
                                    type: "temporary",
                                    unit: "minutes",
                                  },
                                ] as const
                              ).map((option) => (
                                  <button
                                    key={option.label}
                                    type="button"
                                    disabled={workflowLoading}
                                    onClick={() => {
                                      onRetentionTypeChange(option.type);
                                      onRetentionUnitChange(option.unit);
                                      if (option.unit === "minutes") {
                                        onRetentionYearsChange("1");
                                      }
                                    }}
                                    className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${
                                      retentionType === option.type &&
                                      retentionUnit === option.unit
                                        ? "border-amber-500 bg-white text-amber-800 ring-2 ring-amber-100"
                                        : "border-[#E3DCCE] bg-white/70 text-[#625E56]"
                                    }`}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                            </div>
                            {retentionType === "temporary" &&
                              retentionUnit === "years" && (
                              <label className="mt-3 block text-xs font-bold text-[#625E56]">
                                Number of years
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  step={1}
                                  value={retentionYears}
                                  disabled={workflowLoading}
                                  onChange={(event) =>
                                    onRetentionYearsChange(
                                      event.target.value
                                    )
                                  }
                                  className="mt-1.5 min-h-11 w-full rounded-xl border border-[#E3DCCE] bg-white px-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                                />
                              </label>
                            )}
                            <p className="mt-2 text-xs leading-5 text-[#766F63]">
                              {retentionType === "permanent"
                                ? "The record stays in the archive indefinitely."
                                : retentionUnit === "minutes"
                                ? "Practice mode: the record becomes eligible for disposal one minute after archiving."
                                : "After this period, the system automatically transfers it to the restricted For Disposal Repository."}
                            </p>
                          </div>

                          <div>
                            <label className="text-sm font-semibold text-[#3F443F]">
                              Correction notes
                            </label>
                            <textarea
                              rows={4}
                              value={correctionNotes}
                              onChange={(event) =>
                                onCorrectionNotesChange(
                                  event.target.value
                                )
                              }
                              disabled={workflowLoading}
                              placeholder="Required only when returning the submission. Explain exactly what Staff must fix or replace."
                              className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3 text-sm text-[#2D332F] outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:opacity-60"
                            />
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <button
                              type="button"
                              onClick={onSaveReview}
                              disabled={workflowLoading}
                              className="flex items-center justify-center rounded-xl border border-[#CFE0D6] bg-white px-5 py-3 text-sm font-semibold text-[#075A3A] transition hover:bg-[#F0F7F3] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {workflowLoading
                                ? "Saving..."
                                : "Save Review"}
                            </button>

                            <button
                              type="button"
                              onClick={onReturnForCorrection}
                              disabled={workflowLoading}
                              className="flex items-center justify-center rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {workflowLoading
                                ? "Processing..."
                                : "Return for Correction"}
                            </button>

                            <button
                              type="button"
                              onClick={onArchive}
                              disabled={workflowLoading}
                              className="flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {workflowLoading
                                ? "Processing..."
                                : "Archive Record"}
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {record.status === "returned_for_correction" && (
                    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <p className="text-sm font-bold text-amber-900">
                        {isRecordOwner
                          ? "Corrections required"
                          : "Returned for correction"}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-800">
                        {record.correction_notes ||
                          "No correction notes were provided."}
                      </p>

                      {canCorrect && (
                        <Link
                          href={`/records/${record.id}/edit`}
                          className="mt-4 inline-flex rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                        >
                          Edit & Resubmit
                        </Link>
                      )}
                    </section>
                  )}

                  <section className="rounded-2xl border border-[#E1E5E2] bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-[#2D332F]">
                          {isRecordOwner
                            ? "Submission Information"
                            : "Record Information"}
                        </h3>
                        <p className="mt-1 text-sm text-[#766F63]">
                          Submission and classification details.
                        </p>
                      </div>

                      <StatusBadge
                        status={record.status}
                        isStaff={isRecordOwner}
                      />
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <PreviewInfo
                        label={
                          isRecordOwner
                            ? "Date Submitted"
                            : "Date Received"
                        }
                        value={formatDate(record.date_received)}
                      />
                      <PreviewInfo
                        label="Category"
                        value={record.category?.name || "N/A"}
                      />
                      <PreviewInfo
                        label="Department"
                        value={record.department?.name || "N/A"}
                      />
                      <PreviewInfo
                        label="Source / Sender"
                        value={record.source || "N/A"}
                      />
                      <PreviewInfo
                        label="Created By"
                        value={record.creator?.name || "N/A"}
                      />
                      <PreviewInfo
                        label="Storage Location"
                        value={record.storage_location || "N/A"}
                      />
                      <PreviewInfo
                        label="Reviewed By"
                        value={record.reviewer?.name || "N/A"}
                      />
                      <PreviewInfo
                        label="Returned By"
                        value={record.returner?.name || "N/A"}
                      />
                      <PreviewInfo
                        label="Archived By"
                        value={record.archiver?.name || "N/A"}
                      />
                    </div>
                  </section>

                  <TextSection
                    title="Description"
                    value={record.description}
                    emptyText="No description provided."
                  />

                  <TextSection
                    title="Submission Remarks"
                    value={record.remarks}
                    emptyText="No submission remarks provided."
                  />

                  {(record.review_remarks ||
                    record.status === "archived") && (
                    <TextSection
                      title="Review Remarks"
                      value={record.review_remarks}
                      emptyText="No review remarks recorded."
                    />
                  )}
                </main>

                <aside className="min-w-0 space-y-5 lg:sticky lg:top-0">
                  <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6B0F2B] to-[#4B0B1E] p-5 text-white shadow-md shadow-[#6B0F2B]/10">
                    <h3 className="text-lg font-bold">
                      {isRecordOwner
                        ? "Submission Status"
                        : "Record Status"}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-[#E5DDCC]">
                      {getStatusDescription(
                        record.status,
                        isRecordOwner
                      )}
                    </p>

                    <div className="mt-4">
                      <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-bold capitalize text-white ring-1 ring-white/20">
                        {getStatusLabel(
                          record.status,
                          isRecordOwner
                        )}
                      </span>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-[#E1E5E2] bg-white p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-[#2D332F]">
                          Files
                        </h3>
                        <p className="mt-1 text-sm text-[#766F63]">
                          Inspect each attachment before completing review.
                        </p>
                      </div>

                      <span className="rounded-full bg-[#FFF3D6] px-3 py-1 text-xs font-extrabold text-[#A66B00] ring-1 ring-[#EBCF8F]">
                        {files.length}
                      </span>
                    </div>

                    {downloadError && (
                      <Alert tone="error">{downloadError}</Alert>
                    )}

                    {files.length === 0 ? (
                      <p className="mt-4 text-sm leading-6 text-[#766F63]">
                        No files uploaded for this record.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {files.map((file) => {
                          const isDownloading =
                            downloadingFileId === file.id;

                          return (
                            <div
                              key={file.id}
                              className="rounded-xl border border-[#E4E6E3] bg-[#FAFAF8] p-3 transition hover:border-[#CAD8D0] hover:bg-white"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFF3D6] text-xs font-extrabold text-[#A66B00] ring-1 ring-[#EBCF8F]">
                                  {getFileExtension(
                                    file.file_name
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p
                                    title={file.file_name}
                                    className="truncate text-sm font-semibold text-[#2D332F]"
                                  >
                                    {file.file_name}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-[#766F63]">
                                    {file.file_type ||
                                      "Unknown file type"}
                                  </p>
                                  <p className="mt-1 text-xs text-[#A09582]">
                                    {formatFileSize(
                                      file.file_size
                                    )}
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => onDownload(file)}
                                disabled={
                                  downloadingFileId !== null
                                }
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#E1C7CF] bg-white px-3 py-2 text-xs font-bold text-[#6B0F2B] transition hover:border-[#6B0F2B] hover:bg-[#FFF8FA] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isDownloading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                                {isDownloading
                                  ? "Downloading..."
                                  : "Download"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </aside>
              </div>
            ) : (
              <Alert tone="error">
                {error || "Record could not be loaded."}
              </Alert>
            )}
          </div>

          {record && (
            <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#E1E5E2] bg-white px-5 py-3.5 sm:flex-row sm:justify-end sm:px-7">
              <button
                type="button"
                onClick={onClose}
                disabled={workflowLoading}
                className="flex items-center justify-center rounded-xl border border-[#D8DDD9] bg-white px-5 py-2.5 text-sm font-semibold text-[#3F4943] transition hover:border-[#BFC8C2] hover:bg-[#F6F7F5] focus:outline-none focus:ring-4 focus:ring-[#DDE9E2] disabled:opacity-60"
              >
                Close
              </button>

              {canCorrect && (
                <Link
                  href={`/records/${record.id}/edit`}
                  className="flex items-center justify-center rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                >
                  Edit & Resubmit
                </Link>
              )}
            </footer>
          )}
        </div>
      </div>,
      document.body
    );
  }

  function PresetSelect({
    presets,
    disabled,
    onSelect,
  }: {
    presets: ReviewPreset[];
    disabled: boolean;
    onSelect: (value: string) => void;
  }) {
    if (presets.length === 0) return null;

    return (
      <select
        value=""
        disabled={disabled}
        aria-label="Use a saved preset"
        onChange={(event) => {
          if (event.target.value) {
            onSelect(event.target.value);
          }
        }}
        className="h-8 max-w-48 rounded-lg border border-[#D8DDD9] bg-white px-2.5 text-xs font-semibold text-[#526057] outline-none transition hover:border-[#9DB4A6] focus:border-[#075A3A] focus:ring-2 focus:ring-[#DCEAE2] disabled:opacity-60"
      >
        <option value="">Use preset...</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.value}>
            {preset.value}
          </option>
        ))}
      </select>
    );
  }

  function Alert({
    children,
    tone,
  }: {
    children: React.ReactNode;
    tone: "error" | "success" | "warning";
  }) {
    const classes = {
      error: "border-red-200 bg-red-50 text-red-700",
      success:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      warning:
        "border-amber-200 bg-amber-50 text-amber-800",
    };

    return (
      <div
        className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${classes[tone]}`}
      >
        {children}
      </div>
    );
  }

  function TextSection({
    title,
    value,
    emptyText,
  }: {
    title: string;
    value?: string | null;
    emptyText: string;
  }) {
    return (
      <section className="rounded-2xl border border-[#E1E5E2] bg-white p-5 shadow-sm">
        <h3 className="font-bold text-[#2D332F]">{title}</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#625E56]">
          {value || emptyText}
        </p>
      </section>
    );
  }

  function PreviewInfo({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) {
    return (
      <div className="rounded-xl border border-[#E4E7E4] bg-[#F8F9F7] p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-[#7E887F]">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold text-[#2D332F]">
          {value}
        </p>
      </div>
    );
  }

  function WorkflowHint({ text }: { text: string }) {
    return (
      <div className="mt-4 rounded-xl border border-[#CFE0D6] bg-[#F0F7F3] px-4 py-3 text-xs font-semibold leading-5 text-[#064D33]">
        {text}
      </div>
    );
  }

  function EmptyCard({ text }: { text: string }) {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-[#D7CDBB] bg-white p-5 text-center text-sm text-[#766F63] shadow-sm">
        <Files className="h-6 w-6 text-[#A09582]" />
        <p className="mt-3">{text}</p>
      </div>
    );
  }

  function StatusBadge({
    status,
    isStaff = false,
  }: {
    status: string;
    isStaff?: boolean;
  }) {
    const label = getStatusLabel(status, isStaff);

    let classes = "bg-[#F0ECE4] text-[#514D46]";

    if (status === "received") {
      classes = "bg-[#F0F7F3] text-[#075A3A]";
    } else if (status === "under_review") {
      classes = "bg-amber-50 text-amber-700";
    } else if (status === "returned_for_correction") {
      classes = "bg-amber-100 text-amber-800";
    } else if (status === "archived") {
      classes = "bg-emerald-50 text-emerald-700";
    } else if (status === "for_disposal") {
      classes = "bg-red-50 text-red-700";
    } else if (status === "disposed") {
      classes = "bg-[#E3DCCE] text-[#514D46]";
    }

    return (
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold capitalize ${classes}`}
      >
        {label}
      </span>
    );
  }

  function InfoRow({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-[#A09582]">{label}</span>
        <span className="truncate font-medium text-[#514D46]">
          {value}
        </span>
      </div>
    );
  }

  function getStatusLabel(status: string, isStaff: boolean) {
    if (status === "received" && isStaff) {
      return "Submitted";
    }

    if (status === "returned_for_correction" && isStaff) {
      return "Needs Correction";
    }

    return status?.replaceAll("_", " ") || "Unknown";
  }

  function getStatusDescription(
    status: string,
    isStaff: boolean
  ) {
    if (status === "received") {
      return isStaff
        ? "Your submission was successfully received and is waiting for review."
        : "This submission is waiting for Records Office review.";
    }

    if (status === "under_review") {
      return "The submission is currently being checked and processed.";
    }

    if (status === "returned_for_correction") {
      return isStaff
        ? "The Records Officer found issues that must be corrected before the submission can continue."
        : "The submission was returned to its owner and is waiting for corrections and resubmission.";
    }

    if (status === "archived") {
      return "The submission passed review and is now part of the official archive.";
    }

    if (status === "for_disposal") {
      return "The record is awaiting authorized disposal processing.";
    }

    if (status === "disposed") {
      return "The authorized disposal process has been completed.";
    }

    return "Current record processing state.";
  }

  function getFileExtension(fileName: string) {
    const extension =
      fileName.split(".").pop()?.toUpperCase();

    if (!extension || extension === fileName.toUpperCase()) {
      return "FILE";
    }

    return extension.slice(0, 4);
  }

  function formatFileSize(bytes?: number | null) {
    if (!bytes || bytes <= 0) {
      return "Unknown size";
    }

    const units = ["Bytes", "KB", "MB", "GB"];
    const unitIndex = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );
    const size = bytes / Math.pow(1024, unitIndex);

    return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${
      units[unitIndex]
    }`;
  }

  function formatDate(date?: string | null) {
    if (!date) return "N/A";

    const raw = date.includes("T") ? date : `${date}T00:00:00`;
    const parsedDate = new Date(raw);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
