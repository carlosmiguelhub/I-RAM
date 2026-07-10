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
  user?: {
    name?: string;
  } | null;
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
  status: string;
  department?: {
    name?: string;
  } | null;
  category?: {
    name?: string;
  } | null;
  creator?: {
    name?: string;
  } | null;
  files?: RecordFile[];
  audit_logs?: AuditLog[];
};

export default function RecordDetailsPage() {
  const params = useParams();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [record, setRecord] = useState<RecordDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloadingFileId, setDownloadingFileId] = useState<
    number | null
  >(null);

  useEffect(() => {
    async function loadRecord() {
      if (!id) {
        return;
      }

      setLoading(true);
      setLoadError("");

      try {
        const data = await apiRequest(`/records/${id}`);
        setRecord(data.record);
      } catch (error: unknown) {
        console.error(error);

        setLoadError(
          error instanceof Error
            ? error.message
            : "Failed to load record."
        );
      } finally {
        setLoading(false);
      }
    }

    loadRecord();
  }, [id]);

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
        const contentType = response.headers.get("content-type");

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
      downloadLink.download = file.file_name || "record-file";

      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();

      window.URL.revokeObjectURL(objectUrl);

      await refreshAuditTrail();
    } catch (error: unknown) {
      console.error(error);

      setDownloadError(
        error instanceof Error
          ? error.message
          : "Failed to download the file."
      );
    } finally {
      setDownloadingFileId(null);
    }
  }

  async function refreshAuditTrail() {
    if (!id) {
      return;
    }

    try {
      const data = await apiRequest(`/records/${id}`);

      setRecord((current) =>
        current
          ? {
              ...current,
              audit_logs: data.record?.audit_logs || [],
            }
          : data.record
      );
    } catch (error) {
      console.error("Failed to refresh audit trail:", error);
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

  if (loadError) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h1 className="text-lg font-bold text-red-900">
              Unable to load record
            </h1>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {loadError}
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

  if (!record) {
    return (
      <AppShell>
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          Record not found.
        </div>
      </AppShell>
    );
  }

  const files = record.files || [];
  const auditLogs = record.audit_logs || [];

  return (
    <AppShell>
      <div className="w-full max-w-full">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-600">
              Record Details
            </p>

            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {record.title}
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-500">
              {record.record_code}
            </p>
          </div>

          <Link
            href="/records"
            className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
          >
            Back to Records
          </Link>
        </section>

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

              <StatusBadge status={record.status} />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info
                label="Date Received"
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
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="font-bold text-slate-900">
                Description
              </h3>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {record.description || "No description provided."}
              </p>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="font-bold text-slate-900">
                Remarks
              </h3>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {record.remarks || "No remarks provided."}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">
              <h2 className="text-lg font-bold">Archive Status</h2>

              <p className="mt-2 text-sm leading-6 text-slate-300">
                This record is currently marked as:
              </p>

              <div className="mt-5">
                <StatusBadgeDark status={record.status} />
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

                {files.length > 0 && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {files.length}
                  </span>
                )}
              </div>

              {downloadError && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {downloadError}
                </div>
              )}

              {files.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  No files uploaded yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {files.map((file) => {
                    const extension = getFileExtension(
                      file.file_name
                    );

                    const isDownloading =
                      downloadingFileId === file.id;

                    return (
                      <div
                        key={file.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-xs font-bold text-blue-700">
                            {extension}
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

function StatusBadge({ status }: { status: string }) {
  const label = status?.replaceAll("_", " ") || "unknown";

  let classes = "bg-slate-100 text-slate-700";

  if (status === "received") {
    classes = "bg-blue-50 text-blue-700";
  }

  if (status === "under_review") {
    classes = "bg-amber-50 text-amber-700";
  }

  if (status === "archived") {
    classes = "bg-emerald-50 text-emerald-700";
  }

  if (status === "for_disposal") {
    classes = "bg-red-50 text-red-700";
  }

  if (status === "disposed") {
    classes = "bg-slate-200 text-slate-700";
  }

  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold capitalize ${classes}`}
    >
      {label}
    </span>
  );
}

function StatusBadgeDark({ status }: { status: string }) {
  const label = status?.replaceAll("_", " ") || "unknown";

  return (
    <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-bold capitalize text-white ring-1 ring-white/20">
      {label}
    </span>
  );
}

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toUpperCase();

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
  if (!date) {
    return "N/A";
  }

  const parsedDate = new Date(`${date}T00:00:00`);

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
  if (!date) {
    return "Unknown date";
  }

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