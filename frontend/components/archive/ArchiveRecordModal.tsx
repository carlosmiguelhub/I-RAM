"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Printer,
  Save,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000/api";

export type ArchiveRecordFile = {
  id: number;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
};

export type ArchiveAccessLevel =
  | "internal"
  | "confidential";

export type ArchiveRecord = {
  id: number;
  record_code: string;
  title: string;
  description?: string | null;
  source?: string | null;
  remarks?: string | null;
  review_remarks?: string | null;
  correction_notes?: string | null;
  date_received?: string | null;
  archived_at?: string | null;
  storage_location?: string | null;

  staff_visible?: boolean;
  access_level?: ArchiveAccessLevel;

  category?: {
    id?: number;
    name?: string | null;
  } | null;

  department?: {
    id?: number;
    name?: string | null;
  } | null;

  creator?: {
    id?: number;
    name?: string | null;
  } | null;

  reviewer?: {
    id?: number;
    name?: string | null;
  } | null;

  archiver?: {
    id?: number;
    name?: string | null;
  } | null;

  archive_folder?: {
    id: number;
    name: string;
  } | null;

  files?: ArchiveRecordFile[];
};

type AccessMode =
  | "internal"
  | "confidential";

export default function ArchiveRecordModal({
  record,
  loading,
  error,
  onClose,
  onRecordUpdated,
}: {
  record: ArchiveRecord | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onRecordUpdated?: (record: ArchiveRecord) => void;
}) {
  const [downloadingFileId, setDownloadingFileId] =
    useState<number | null>(null);

  const [printingFileId, setPrintingFileId] =
    useState<number | null>(null);

  const [savingAccess, setSavingAccess] = useState(false);
  const [accessMode, setAccessMode] =
    useState<AccessMode>("internal");

  const [actionError, setActionError] = useState("");
  const [accessSuccess, setAccessSuccess] = useState("");

  const files = record?.files || [];

  const busy =
    loading ||
    downloadingFileId !== null ||
    printingFileId !== null ||
    savingAccess;

  useEffect(() => {
    if (!record) return;

    setAccessMode(getAccessMode(record));
    setAccessSuccess("");
    setActionError("");
  }, [record]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [busy, onClose]);

  async function saveAccessSettings() {
    if (!record) return;

    const payload = accessModeToPayload(accessMode);

    setSavingAccess(true);
    setActionError("");
    setAccessSuccess("");

    try {
      const data = await apiRequest(
        `/archive/records/${record.id}/staff-access`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );

      const updatedRecord = data.record as ArchiveRecord;

      setAccessMode(getAccessMode(updatedRecord));

      setAccessSuccess(
        data.message ||
          "Staff access settings updated successfully."
      );

      onRecordUpdated?.(updatedRecord);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to update staff access settings."
      );
    } finally {
      setSavingAccess(false);
    }
  }

  async function fetchRecordFile(file: ArchiveRecordFile) {
    const token = localStorage.getItem("iram_token");

    if (!token) {
      throw new Error(
        "Your session has expired. Please log in again."
      );
    }

    const response = await fetch(
      `${API_URL}/record-files/${file.id}/download`,
      {
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
          data?.message || "Failed to retrieve the file."
        );
      }

      throw new Error(
        `File request failed with status ${response.status}.`
      );
    }

    return response.blob();
  }

  async function downloadFile(file: ArchiveRecordFile) {
    setDownloadingFileId(file.id);
    setActionError("");
    setAccessSuccess("");

    try {
      const blob = await fetchRecordFile(file);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = file.file_name || "archive-file";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to download the file."
      );
    } finally {
      setDownloadingFileId(null);
    }
  }

  async function printFile(file: ArchiveRecordFile) {
    setPrintingFileId(file.id);
    setActionError("");
    setAccessSuccess("");

    try {
      if (!isBrowserPrintable(file)) {
        throw new Error(
          "This file type cannot be printed directly in the browser. Download it and print it using its application."
        );
      }

      const blob = await fetchRecordFile(file);
      const objectUrl = URL.createObjectURL(blob);
      const printWindow = window.open(objectUrl, "_blank");

      if (!printWindow) {
        URL.revokeObjectURL(objectUrl);

        throw new Error(
          "The print window was blocked. Allow pop-ups and try again."
        );
      }

      printWindow.addEventListener(
        "load",
        () => {
          printWindow.focus();
          printWindow.print();

          window.setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
          }, 60000);
        },
        { once: true }
      );
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to print the file."
      );
    } finally {
      setPrintingFileId(null);
    }
  }

  function printRecordDetails() {
    if (!record) return;

    setActionError("");
    setAccessSuccess("");

    const printWindow = window.open(
      "",
      "_blank",
      "width=900,height=700"
    );

    if (!printWindow) {
      setActionError(
        "The print window was blocked. Allow pop-ups and try again."
      );
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(
            record.record_code
          )} - Archive Record</title>

          <style>
            body {
              font-family: Arial, sans-serif;
              color: #0f172a;
              margin: 40px;
            }

            .header {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 16px;
            }

            .status {
              display: inline-block;
              padding: 6px 10px;
              border-radius: 999px;
              background: #dcfce7;
              color: #166534;
              font-size: 12px;
              font-weight: 700;
            }

            h1 {
              margin: 12px 0 4px;
              font-size: 24px;
            }

            .code {
              color: #64748b;
            }

            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              margin-top: 24px;
            }

            .field {
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 12px;
            }

            .label {
              color: #64748b;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: .08em;
            }

            .value {
              margin-top: 5px;
              font-size: 14px;
              font-weight: 600;
              word-break: break-word;
            }

            .section {
              margin-top: 24px;
            }

            .section h2 {
              margin: 0 0 8px;
              font-size: 16px;
            }

            .section p {
              margin: 0;
              white-space: pre-wrap;
              line-height: 1.6;
              color: #334155;
            }

            ul {
              padding-left: 20px;
            }

            footer {
              margin-top: 36px;
              padding-top: 12px;
              border-top: 1px solid #e2e8f0;
              color: #64748b;
              font-size: 11px;
            }

            @media print {
              body {
                margin: 18mm;
              }
            }
          </style>
        </head>

        <body>
          <div class="header">
            <span class="status">Archived</span>
            <h1>${escapeHtml(record.title)}</h1>
            <div class="code">${escapeHtml(
              record.record_code
            )}</div>
          </div>

          <div class="grid">
            ${printField(
              "Category",
              record.category?.name || "N/A"
            )}

            ${printField(
              "Department",
              record.department?.name || "N/A"
            )}

            ${printField(
              "Date Received",
              formatDate(record.date_received)
            )}

            ${printField(
              "Archived Date",
              formatDate(record.archived_at)
            )}

            ${printField(
              "Storage Location",
              record.storage_location || "N/A"
            )}

            ${printField(
              "Archive Folder",
              record.archive_folder?.name || "Unfiled"
            )}

            ${printField(
              "Source / Sender",
              record.source || "N/A"
            )}

            ${printField(
              "Created By",
              record.creator?.name || "N/A"
            )}

            ${printField(
              "Reviewed By",
              record.reviewer?.name || "N/A"
            )}

            ${printField(
              "Archived By",
              record.archiver?.name || "N/A"
            )}

            ${printField(
              "Staff Access",
              formatAccessMode(accessMode)
            )}
          </div>

          ${printSection("Description", record.description)}

          ${printSection(
            "Submission Remarks",
            record.remarks
          )}

          ${printSection(
            "Review Remarks",
            record.review_remarks
          )}

          <div class="section">
            <h2>Attached Files (${files.length})</h2>

            ${
              files.length
                ? `<ul>${files
                    .map(
                      (file) =>
                        `<li>${escapeHtml(
                          file.file_name
                        )} (${escapeHtml(
                          formatFileSize(file.file_size)
                        )})</li>`
                    )
                    .join("")}</ul>`
                : "<p>No attached files.</p>"
            }
          </div>

          <footer>
            Printed from IRAM on ${escapeHtml(
              new Date().toLocaleString("en-PH")
            )}
          </footer>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !busy
        ) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-record-modal-title"
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[94vh] sm:max-w-6xl sm:rounded-3xl"
      >
        <header className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-5 py-5 text-white sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 sm:flex">
                <Archive className="h-5 w-5 text-blue-200" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold text-emerald-300">
                  Archived Record
                </p>

                <h2
                  id="archive-record-modal-title"
                  className="mt-1 break-words text-xl font-bold sm:text-2xl"
                >
                  {record?.title || "Loading record..."}
                </h2>

                {record?.record_code && (
                  <p className="mt-1 break-all text-sm text-slate-300">
                    {record.record_code}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-50"
              aria-label="Close record details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {(error || actionError) && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {actionError || error}
            </div>
          )}

          {accessSuccess && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{accessSuccess}</span>
            </div>
          )}

          {loading && !record ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl bg-slate-50">
              <Loader2 className="h-7 w-7 animate-spin text-blue-600" />

              <p className="mt-3 text-sm font-medium text-slate-500">
                Loading archived record...
              </p>
            </div>
          ) : record ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <section className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Record Information
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Official metadata for this archived record.
                      </p>
                    </div>

                    <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      Archived
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoBox
                      label="Category"
                      value={record.category?.name || "N/A"}
                    />

                    <InfoBox
                      label="Department"
                      value={record.department?.name || "N/A"}
                    />

                    <InfoBox
                      label="Date Received"
                      value={formatDate(record.date_received)}
                    />

                    <InfoBox
                      label="Archived Date"
                      value={formatDate(record.archived_at)}
                    />

                    <InfoBox
                      label="Storage Location"
                      value={record.storage_location || "N/A"}
                    />

                    <InfoBox
                      label="Archive Folder"
                      value={
                        record.archive_folder?.name || "Unfiled"
                      }
                    />

                    <InfoBox
                      label="Source / Sender"
                      value={record.source || "N/A"}
                    />

                    <InfoBox
                      label="Created By"
                      value={record.creator?.name || "N/A"}
                    />

                    <InfoBox
                      label="Reviewed By"
                      value={record.reviewer?.name || "N/A"}
                    />

                    <InfoBox
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

                <TextSection
                  title="Review Remarks"
                  value={record.review_remarks}
                  emptyText="No review remarks recorded."
                />
              </div>

              <aside className="space-y-5">
                <StaffAccessPanel
                  value={accessMode}
                  saving={savingAccess}
                  onChange={(value) => {
                    setAccessMode(value);
                    setAccessSuccess("");
                    setActionError("");
                  }}
                  onSave={saveAccessSettings}
                />

                <section className="rounded-2xl bg-slate-950 p-5 text-white">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                    <FolderOpen className="h-5 w-5 text-blue-200" />
                  </div>

                  <h3 className="mt-4 text-lg font-bold">
                    Archive Location
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Filed under{" "}
                    <strong className="text-white">
                      {record.archive_folder?.name || "Unfiled"}
                    </strong>
                    .
                  </p>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Storage location
                  </p>

                  <p className="mt-1 break-words text-sm font-semibold text-white">
                    {record.storage_location || "Not specified"}
                  </p>
                </section>

                <section className="rounded-2xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Documents
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Download or print attached files.
                      </p>
                    </div>

                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {files.length}
                    </span>
                  </div>

                  {files.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">
                      No files are attached to this record.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {files.map((file) => {
                        const downloading =
                          downloadingFileId === file.id;

                        const printing =
                          printingFileId === file.id;

                        const printable =
                          isBrowserPrintable(file);

                        return (
                          <div
                            key={file.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">
                                {getFileExtension(file.file_name)}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p
                                  title={file.file_name}
                                  className="truncate text-sm font-semibold text-slate-900"
                                >
                                  {file.file_name}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                  {formatFileSize(file.file_size)}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => downloadFile(file)}
                                disabled={busy}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                {downloading ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}

                                {downloading
                                  ? "Downloading"
                                  : "Download"}
                              </button>

                              <button
                                type="button"
                                onClick={() => printFile(file)}
                                disabled={busy || !printable}
                                title={
                                  printable
                                    ? "Print this file"
                                    : "Download this file and print it using its application"
                                }
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {printing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Printer className="h-3.5 w-3.5" />
                                )}

                                {printing ? "Opening" : "Print"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </aside>
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              The archived record could not be loaded.
            </div>
          )}
        </div>

        {record && (
          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Close
            </button>

            <button
              type="button"
              onClick={printRecordDetails}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Print Record Details
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

function StaffAccessPanel({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: AccessMode;
  saving: boolean;
  onChange: (value: AccessMode) => void;
  onSave: () => void;
}) {
  const options: Array<{
    value: AccessMode;
    title: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      value: "internal",
      title: "Internal",
      description:
        "Visible to Staff in the Archive Catalog for normal institutional use.",
      icon: <Users className="h-4 w-4" />,
    },
    {
      value: "confidential",
      title: "Confidential",
      description:
        "Hidden from the Staff Archive Catalog and available only to authorized officers.",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
          Staff Catalog Access
        </p>

        <h3 className="mt-1 text-lg font-bold text-slate-900">
          Visibility and Access
        </h3>

        <p className="mt-1 text-sm leading-5 text-slate-500">
          Control whether Staff can discover and request this
          archived record.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {options.map((option) => {
          const selected = value === option.value;

          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                selected
                  ? "border-blue-400 bg-white ring-2 ring-blue-100"
                  : "border-slate-200 bg-white/70 hover:border-blue-200"
              }`}
            >
              <input
                type="radio"
                name="archive-access-mode"
                value={option.value}
                checked={selected}
                disabled={saving}
                onChange={() => onChange(option.value)}
                className="mt-1 h-4 w-4 accent-blue-600"
              />

              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  selected
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {option.icon}
              </span>

              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-800">
                  {option.title}
                </span>

                <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}

        {saving ? "Saving Access..." : "Save Access Settings"}
      </button>
    </section>
  );
}

function getAccessMode(
  record: ArchiveRecord
): AccessMode {
  return record.access_level === "confidential"
    ? "confidential"
    : "internal";
}

function accessModeToPayload(mode: AccessMode) {
  if (mode === "confidential") {
    return {
      staff_visible: false,
      access_level: "confidential",
    };
  }

  return {
    staff_visible: true,
    access_level: "internal",
  };
}

function formatAccessMode(mode: AccessMode) {
  return mode
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-slate-900">
        {value}
      </p>
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
    <section className="rounded-2xl border border-slate-200 p-5">
      <h3 className="font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
        {value || emptyText}
      </p>
    </section>
  );
}

function isBrowserPrintable(file: ArchiveRecordFile) {
  const type = (file.file_type || "").toLowerCase();

  const extension =
    file.file_name
      .split(".")
      .pop()
      ?.toLowerCase() || "";

  return (
    type === "application/pdf" ||
    type.startsWith("image/") ||
    [
      "pdf",
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
    ].includes(extension)
  );
}

function getFileExtension(fileName: string) {
  const extension =
    fileName.split(".").pop()?.toUpperCase() || "FILE";

  return extension.slice(0, 4);
}

function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) {
    return "Unknown size";
  }

  const units = ["Bytes", "KB", "MB", "GB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 2)} ${
    units[index]
  }`;
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printField(label: string, value: string) {
  return `
    <div class="field">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
    </div>
  `;
}

function printSection(
  title: string,
  value?: string | null
) {
  return `
    <div class="section">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(value || "None recorded.")}</p>
    </div>
  `;
}