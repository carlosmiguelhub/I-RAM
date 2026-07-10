"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000/api";

type RecordFile = {
  id: number;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
};

type AuditLog = {
  id: number;
  action: string;
  description: string;
  created_at: string;
  user?: { name?: string } | null;
};

type UserSummary = {
  name?: string | null;
};

type RecordDetails = {
  id: number;
  record_code: string;
  title: string;
  description?: string | null;
  date_received?: string | null;
  source?: string | null;
  storage_location?: string | null;
  remarks?: string | null;
  review_remarks?: string | null;
  correction_notes?: string | null;
  returned_at?: string | null;
  reviewed_at?: string | null;
  archived_at?: string | null;
  status: string;
  department?: { name?: string } | null;
  category?: { name?: string } | null;
  creator?: UserSummary | null;
  reviewer?: UserSummary | null;
  returner?: UserSummary | null;
  archiver?: UserSummary | null;
  files?: RecordFile[];
  audit_logs?: AuditLog[];
};

export default function RecordDetailsPage() {
  const params = useParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [record, setRecord] = useState<RecordDetails | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloadingFileId, setDownloadingFileId] = useState<
    number | null
  >(null);

  const [reviewRemarks, setReviewRemarks] = useState("");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState("");
  const [workflowSuccess, setWorkflowSuccess] = useState("");

  const roleName = user?.role?.name || "";
  const isStaff = roleName === "Staff";
  const canManageWorkflow =
    roleName === "Admin" || roleName === "Records Officer";

  async function loadRecord(showLoading = true) {
    if (!id) return;

    if (showLoading) setLoading(true);
    setLoadError("");

    try {
      const [recordData, meData] = await Promise.all([
        apiRequest(`/records/${id}`),
        user ? Promise.resolve({ user }) : apiRequest("/me"),
      ]);

      setUser(meData.user);
      setRecord(recordData.record);
      setReviewRemarks(recordData.record?.review_remarks || "");
      setCorrectionNotes(recordData.record?.correction_notes || "");
      setStorageLocation(
        recordData.record?.storage_location || ""
      );
    } catch (error: unknown) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load record."
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadRecord();
  }, [id]);

  async function runWorkflowAction(
    endpoint: string,
    options: RequestInit,
    fallbackMessage: string
  ) {
    setWorkflowLoading(true);
    setWorkflowError("");
    setWorkflowSuccess("");

    try {
      const data = await apiRequest(endpoint, options);
      setRecord(data.record);
      setReviewRemarks(data.record?.review_remarks || "");
      setCorrectionNotes(data.record?.correction_notes || "");
      setStorageLocation(data.record?.storage_location || "");
      setWorkflowSuccess(data.message || fallbackMessage);

      const refreshed = await apiRequest(`/records/${id}`);
      setRecord(refreshed.record);
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
    if (!record) return;

    await runWorkflowAction(
      `/records/${record.id}/start-review`,
      {
        method: "POST",
        body: JSON.stringify({
          review_remarks: reviewRemarks.trim() || null,
        }),
      },
      "Review started."
    );
  }

  async function handleSaveReview() {
    if (!record) return;

    await runWorkflowAction(
      `/records/${record.id}/review`,
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
    if (!record) return;

    if (!correctionNotes.trim()) {
      setWorkflowError(
        "Correction notes are required before returning the submission."
      );
      return;
    }

    await runWorkflowAction(
      `/records/${record.id}/return-for-correction`,
      {
        method: "POST",
        body: JSON.stringify({
          correction_notes: correctionNotes.trim(),
        }),
      },
      "Record returned to Staff for correction."
    );
  }

  async function handleArchive() {
    if (!record) return;

    if (!reviewRemarks.trim()) {
      setWorkflowError(
        "Review remarks are required before archiving."
      );
      return;
    }

    if (!storageLocation.trim()) {
      setWorkflowError(
        "A storage location is required before archiving."
      );
      return;
    }

    await runWorkflowAction(
      `/records/${record.id}/archive`,
      {
        method: "POST",
        body: JSON.stringify({
          review_remarks: reviewRemarks.trim(),
          storage_location: storageLocation.trim(),
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

      await loadRecord(false);
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

  if (loading) {
    return (
      <AppShell>
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          Loading record...
        </div>
      </AppShell>
    );
  }

  if (loadError || !record) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-bold text-red-900">
              Unable to load record
            </h1>
            <p className="mt-2 text-sm leading-6 text-red-700">
              {loadError || "Record not found."}
            </p>
            <Link
              href="/records"
              className="mt-5 inline-flex rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
            >
              Back to Records
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const files = record.files || [];
  const auditLogs = record.audit_logs || [];
  const showWorkflow =
    canManageWorkflow &&
    ["received", "under_review"].includes(record.status);

  return (
    <AppShell>
      <div className="w-full max-w-full">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-600">
              {showWorkflow
                ? "Records Officer Review"
                : "Record Details"}
            </p>

            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {record.title}
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-500">
              {record.record_code}
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {isStaff &&
              record.status === "returned_for_correction" && (
                <Link
                  href={`/records/${record.id}/edit`}
                  className="flex items-center justify-center rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
                >
                  Edit & Resubmit
                </Link>
              )}

            <Link
              href="/records"
              className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Back to Records
            </Link>
          </div>
        </section>

        {showWorkflow && (
          <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/50 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Review Workflow
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                  {record.status === "received"
                    ? "Check the record metadata and attachments, then begin the formal review."
                    : "Record your findings, assign a storage location, and archive the approved submission."}
                </p>
              </div>
              <StatusBadge
                status={record.status}
                isStaff={isStaff}
              />
            </div>

            {workflowError && (
              <Alert tone="error">{workflowError}</Alert>
            )}
            {workflowSuccess && (
              <Alert tone="success">{workflowSuccess}</Alert>
            )}

            {record.status === "received" && (
              <div className="mt-5">
                <label className="text-sm font-semibold text-slate-800">
                  Initial review note
                </label>
                <textarea
                  rows={4}
                  value={reviewRemarks}
                  onChange={(event) =>
                    setReviewRemarks(event.target.value)
                  }
                  disabled={workflowLoading}
                  placeholder="Optional note before starting review..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleStartReview}
                  disabled={workflowLoading}
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                >
                  {workflowLoading
                    ? "Starting Review..."
                    : "Start Review"}
                </button>
              </div>
            )}

            {record.status === "under_review" && (
              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    Review remarks
                  </label>
                  <textarea
                    rows={6}
                    value={reviewRemarks}
                    onChange={(event) =>
                      setReviewRemarks(event.target.value)
                    }
                    disabled={workflowLoading}
                    placeholder="Describe the checks performed and review result..."
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    Storage location
                  </label>
                  <input
                    value={storageLocation}
                    onChange={(event) =>
                      setStorageLocation(event.target.value)
                    }
                    disabled={workflowLoading}
                    placeholder="Archive Room A / Shelf 2 / Box 14"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
                  />

                  <div className="mt-4">
                    <label className="text-sm font-semibold text-slate-800">
                      Correction notes
                    </label>
                    <textarea
                      rows={4}
                      value={correctionNotes}
                      onChange={(event) =>
                        setCorrectionNotes(event.target.value)
                      }
                      disabled={workflowLoading}
                      placeholder="Required when returning the submission. Explain what Staff must fix or replace."
                      className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:opacity-60"
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={handleSaveReview}
                      disabled={workflowLoading}
                      className="flex items-center justify-center rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-60"
                    >
                      {workflowLoading
                        ? "Saving..."
                        : "Save Review"}
                    </button>

                    <button
                      type="button"
                      onClick={handleReturnForCorrection}
                      disabled={workflowLoading}
                      className="flex items-center justify-center rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-60"
                    >
                      {workflowLoading
                        ? "Processing..."
                        : "Return for Correction"}
                    </button>

                    <button
                      type="button"
                      onClick={handleArchive}
                      disabled={workflowLoading}
                      className="flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {workflowLoading
                        ? "Processing..."
                        : "Archive Record"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {record.status === "returned_for_correction" && (
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-amber-900">
                  {isStaff
                    ? "Corrections required"
                    : "Returned for correction"}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-800">
                  {record.correction_notes ||
                    "No correction notes were provided."}
                </p>
              </div>

              {isStaff && (
                <Link
                  href={`/records/${record.id}/edit`}
                  className="shrink-0 rounded-xl bg-amber-600 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-amber-700"
                >
                  Edit & Resubmit
                </Link>
              )}
            </div>
          </section>
        )}

        <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 xl:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Record Information
                </h2>
                <p className="text-sm text-slate-500">
                  Metadata and archive classification.
                </p>
              </div>

              <StatusBadge
                status={record.status}
                isStaff={isStaff}
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info
                label={
                  isStaff ? "Date Submitted" : "Date Received"
                }
                value={formatDate(record.date_received)}
              />
              <Info
                label="Department"
                value={record.department?.name}
              />
              <Info
                label="Category"
                value={record.category?.name}
              />
              <Info label="Source" value={record.source} />
              <Info
                label="Storage Location"
                value={record.storage_location}
              />
              <Info
                label="Created By"
                value={record.creator?.name}
              />
              <Info
                label="Reviewed By"
                value={record.reviewer?.name}
              />
              <Info
                label="Returned By"
                value={record.returner?.name}
              />
              <Info
                label="Archived By"
                value={record.archiver?.name}
              />
            </div>

            <DetailText
              title="Description"
              value={record.description}
              emptyText="No description provided."
            />
            <DetailText
              title="Submission Remarks"
              value={record.remarks}
              emptyText="No submission remarks provided."
            />
            <DetailText
              title="Review Remarks"
              value={record.review_remarks}
              emptyText="No review remarks recorded."
            />
            <DetailText
              title="Correction Notes"
              value={record.correction_notes}
              emptyText="No correction notes recorded."
            />
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">
              <h2 className="text-lg font-bold">Archive Status</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {getStatusDescription(
                  record.status,
                  isStaff
                )}
              </p>
              <div className="mt-5">
                <StatusBadgeDark
                  status={record.status}
                  isStaff={isStaff}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Files
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Uploaded documents associated with this record.
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  {files.length}
                </span>
              </div>

              {downloadError && (
                <Alert tone="error">{downloadError}</Alert>
              )}

              {files.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  No files uploaded yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {files.map((file) => {
                    const isDownloading =
                      downloadingFileId === file.id;

                    return (
                      <div
                        key={file.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xs font-bold text-blue-700">
                            {getFileExtension(file.file_name)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p
                              title={file.file_name}
                              className="truncate text-sm font-semibold text-slate-900"
                            >
                              {file.file_name}
                            </p>
                            <p className="mt-1 break-all text-xs text-slate-500">
                              {file.file_type ||
                                "Unknown file type"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {formatFileSize(file.file_size)}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownload(file)}
                          disabled={downloadingFileId !== null}
                          className="mt-3 flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDownloading
                            ? "Downloading..."
                            : "Download File"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">
            Audit Trail
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Activity history for this record.
          </p>

          {auditLogs.length === 0 ? (
            <p className="mt-5 text-sm text-slate-500">
              No audit logs yet.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-bold capitalize text-slate-900">
                      {formatAction(log.action)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(log.created_at)}
                    </p>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {log.description}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    By {log.user?.name || "Unknown"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Alert({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "success";
}) {
  const classes =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div
      className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${classes}`}
    >
      {children}
    </div>
  );
}

function DetailText({
  title,
  value,
  emptyText,
}: {
  title: string;
  value?: string | null;
  emptyText: string;
}) {
  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
        {value || emptyText}
      </p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">
        {value || "N/A"}
      </p>
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
  let classes = "bg-slate-100 text-slate-700";

  if (status === "received") {
    classes = "bg-blue-50 text-blue-700";
  } else if (status === "under_review") {
    classes = "bg-amber-50 text-amber-700";
  } else if (status === "returned_for_correction") {
    classes = "bg-amber-100 text-amber-800";
  } else if (status === "archived") {
    classes = "bg-emerald-50 text-emerald-700";
  } else if (status === "for_disposal") {
    classes = "bg-red-50 text-red-700";
  }

  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold capitalize ${classes}`}
    >
      {getStatusLabel(status, isStaff)}
    </span>
  );
}

function StatusBadgeDark({
  status,
  isStaff,
}: {
  status: string;
  isStaff: boolean;
}) {
  return (
    <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-bold capitalize text-white ring-1 ring-white/20">
      {getStatusLabel(status, isStaff)}
    </span>
  );
}

function getStatusLabel(status: string, isStaff: boolean) {
  if (status === "received" && isStaff) {
    return "Submitted";
  }

  if (status === "returned_for_correction" && isStaff) {
    return "Needs Correction";
  }

  return status?.replaceAll("_", " ") || "unknown";
}

function getStatusDescription(
  status: string,
  isStaff: boolean
) {
  if (status === "received") {
    return isStaff
      ? "Your submission is waiting for Records Office review."
      : "This submission has been received and is waiting for formal review.";
  }

  if (status === "under_review") {
    return "The record is currently being evaluated by the Records Office.";
  }

  if (status === "returned_for_correction") {
    return isStaff
      ? "The Records Officer returned this submission. Review the notes, correct the record, and resubmit it."
      : "The submission is waiting for Staff to complete the requested corrections.";
  }

  if (status === "archived") {
    return "The review is complete and the record is part of the official archive.";
  }

  if (status === "for_disposal") {
    return "The retention period has expired and authorized disposal is pending.";
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

function formatAction(action: string) {
  return action.replaceAll("_", " ");
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
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(date?: string | null) {
  if (!date) return "Unknown date";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return parsedDate.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
