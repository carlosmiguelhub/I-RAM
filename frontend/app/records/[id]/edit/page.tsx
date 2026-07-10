"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

type Option = {
  id: number;
  name: string;
};

type ExistingFile = {
  id: number;
  file_name: string;
  file_size?: number | null;
};

type SelectedFile = {
  id: string;
  file: File;
};

type RecordDetails = {
  id: number;
  record_code: string;
  title: string;
  description?: string | null;
  category_id: number;
  date_received?: string | null;
  source?: string | null;
  remarks?: string | null;
  correction_notes?: string | null;
  status: string;
  created_by: number;
  files?: ExistingFile[];
};

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "jpg", "jpeg", "png", "txt", "csv",
];

export default function CorrectRecordPage() {
  const params = useParams();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [record, setRecord] = useState<RecordDetails | null>(null);
  const [categories, setCategories] = useState<Option[]>([]);
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [form, setForm] = useState({
    record_code: "",
    title: "",
    description: "",
    category_id: "",
    date_received: "",
    source: "",
    remarks: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingFileId, setRemovingFileId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileError, setFileError] = useState("");

  const totalFiles = existingFiles.length + selectedFiles.length;

  useEffect(() => {
    async function loadPage() {
      if (!id) return;

      setLoading(true);
      setError("");

      try {
        const [meData, recordData, optionsData] =
          await Promise.all([
            apiRequest("/me"),
            apiRequest(`/records/${id}`),
            apiRequest("/options"),
          ]);

        const loadedRecord = recordData.record;

        if (
          meData.user?.role?.name !== "Staff" ||
          loadedRecord.created_by !== meData.user.id
        ) {
          throw new Error(
            "You may only correct your own returned submission."
          );
        }

        if (loadedRecord.status !== "returned_for_correction") {
          throw new Error(
            "This submission is not currently available for correction."
          );
        }

        setRecord(loadedRecord);
        setCategories(optionsData.categories || []);
        setExistingFiles(loadedRecord.files || []);
        setForm({
          record_code: loadedRecord.record_code || "",
          title: loadedRecord.title || "",
          description: loadedRecord.description || "",
          category_id: String(loadedRecord.category_id || ""),
          date_received: normalizeDate(loadedRecord.date_received),
          source: loadedRecord.source || "",
          remarks: loadedRecord.remarks || "",
        });
      } catch (error: unknown) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to load the returned submission."
        );
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [id]);

  function handleChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);
    setFileError("");

    if (totalFiles + files.length > MAX_FILES) {
      setFileError(
        `A submission may contain a maximum of ${MAX_FILES} files.`
      );
      resetFileInput();
      return;
    }

    for (const file of files) {
      const extension =
        file.name.split(".").pop()?.toLowerCase() || "";

      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        setFileError(`${file.name} is not an allowed file type.`);
        resetFileInput();
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setFileError(`${file.name} exceeds the 10 MB file limit.`);
        resetFileInput();
        return;
      }
    }

    setSelectedFiles((current) => [
      ...current,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
      })),
    ]);

    resetFileInput();
  }

  function resetFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeSelectedFile(fileId: string) {
    setSelectedFiles((current) =>
      current.filter((item) => item.id !== fileId)
    );
  }

  async function removeExistingFile(file: ExistingFile) {
    setRemovingFileId(file.id);
    setFileError("");
    setSuccess("");

    try {
      await apiRequest(`/record-files/${file.id}`, {
        method: "DELETE",
      });

      setExistingFiles((current) =>
        current.filter((item) => item.id !== file.id)
      );

      setSuccess("File removed. Save or resubmit when your corrections are complete.");
    } catch (error: unknown) {
      setFileError(
        error instanceof Error
          ? error.message
          : "Failed to remove the file."
      );
    } finally {
      setRemovingFileId(null);
    }
  }

  async function saveCorrections(): Promise<RecordDetails> {
    if (!record) {
      throw new Error("Record is not available.");
    }

    if (!form.category_id) {
      throw new Error("Please select a category.");
    }

    const payload = new FormData();
    payload.append("record_code", form.record_code.trim());
    payload.append("title", form.title.trim());
    payload.append("description", form.description);
    payload.append("category_id", form.category_id);
    payload.append("date_received", form.date_received);
    payload.append("source", form.source);
    payload.append("remarks", form.remarks);

    selectedFiles.forEach(({ file }) => {
      payload.append("files[]", file);
    });

    const data = await apiRequest(
      `/records/${record.id}/correction`,
      {
        method: "POST",
        body: payload,
      }
    );

    setRecord(data.record);
    setExistingFiles(data.record.files || []);
    setSelectedFiles([]);
    setSuccess(data.message || "Corrections saved.");

    return data.record;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await saveCorrections();
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to save corrections."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndResubmit() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updatedRecord = await saveCorrections();

      if ((updatedRecord.files || []).length === 0) {
        throw new Error(
          "Attach at least one file before resubmitting."
        );
      }

      const data = await apiRequest(
        `/records/${updatedRecord.id}/resubmit`,
        {
          method: "POST",
        }
      );

      setSuccess(data.message);
      router.push("/records");
router.refresh();
      router.refresh();
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to resubmit the record."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          Loading correction form...
        </div>
      </AppShell>
    );
  }

  if (error && !record) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-6">
          <h1 className="text-lg font-bold text-red-900">
            Unable to edit submission
          </h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <Link
            href="/records"
            className="mt-5 inline-flex rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Back to Records
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!record) return null;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-600">
              Returned for Correction
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
              Correct Submission
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Update the record and replace any incorrect or missing files.
            </p>
          </div>

          <Link
            href={`/records/${record.id}`}
            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700"
          >
            Back to Details
          </Link>
        </section>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-900">
            Records Officer notes
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-800">
            {record.correction_notes ||
              "No correction notes were provided."}
          </p>
        </section>

        <form onSubmit={handleSave} className="mt-5 space-y-5">
          {error && (
            <Alert tone="error">{error}</Alert>
          )}

          {success && (
            <Alert tone="success">{success}</Alert>
          )}

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Record Information
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Record Code">
                <input
                  required
                  name="record_code"
                  value={form.record_code}
                  onChange={handleChange}
                  className={inputClass}
                />
              </Field>

              <Field label="Date Submitted">
                <input
                  required
                  type="date"
                  name="date_received"
                  value={form.date_received}
                  onChange={handleChange}
                  className={inputClass}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Title">
                  <input
                    required
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Category">
                <select
                  required
                  name="category_id"
                  value={form.category_id}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Source / Sender">
                <input
                  name="source"
                  value={form.source}
                  onChange={handleChange}
                  className={inputClass}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Description">
                  <textarea
                    rows={4}
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field label="Submission Remarks">
                  <textarea
                    rows={4}
                    name="remarks"
                    value={form.remarks}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Supporting Files
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Remove incorrect files and upload replacements.
                </p>
              </div>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {totalFiles}/{MAX_FILES}
              </span>
            </div>

            {fileError && (
              <Alert tone="error">{fileError}</Alert>
            )}

            <div className="mt-5 space-y-3">
              {existingFiles.map((file) => (
                <FileRow
                  key={file.id}
                  name={file.file_name}
                  size={file.file_size}
                  actionLabel={
                    removingFileId === file.id
                      ? "Removing..."
                      : "Remove"
                  }
                  disabled={removingFileId !== null || saving}
                  onAction={() => removeExistingFile(file)}
                />
              ))}

              {selectedFiles.map(({ id: fileId, file }) => (
                <FileRow
                  key={fileId}
                  name={file.name}
                  size={file.size}
                  actionLabel="Remove"
                  disabled={saving}
                  onAction={() => removeSelectedFile(fileId)}
                />
              ))}

              {totalFiles === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                  No files attached. Add at least one file before resubmitting.
                </p>
              )}
            </div>

            <label
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center ${
                totalFiles >= MAX_FILES
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
                  : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              <span className="text-sm font-semibold text-slate-900">
                Add replacement files
              </span>
              <span className="mt-1 text-xs text-slate-500">
                Maximum 5 files, 10 MB each
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.csv"
                onChange={handleFileChange}
                disabled={saving || totalFiles >= MAX_FILES}
                className="sr-only"
              />
            </label>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href={`/records/${record.id}`}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Corrections"}
            </button>

            <button
              type="button"
              onClick={handleSaveAndResubmit}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Processing..." : "Save & Resubmit"}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

function FileRow({
  name,
  size,
  actionLabel,
  disabled,
  onAction,
}: {
  name: string;
  size?: number | null;
  actionLabel: string;
  disabled: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">
        {getExtension(name)}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {name}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {formatFileSize(size)}
        </p>
      </div>

      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function Alert({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "success";
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm font-medium ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {children}
    </div>
  );
}

function normalizeDate(date?: string | null) {
  if (!date) return "";
  return date.includes("T") ? date.slice(0, 10) : date;
}

function getExtension(name: string) {
  return name.split(".").pop()?.slice(0, 4).toUpperCase() || "FILE";
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "Unknown size";

  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return `${(bytes / Math.pow(1024, index)).toFixed(
    index === 0 ? 0 : 2
  )} ${units[index]}`;
}
