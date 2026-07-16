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
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "txt",
  "csv",
];

function createFileId(file: File) {
  const fallbackId = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

  const randomId =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : fallbackId;

  return `${file.name}-${file.size}-${file.lastModified}-${randomId}`;
}

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
        const [meData, recordData, optionsData] = await Promise.all([
          apiRequest("/me"),
          apiRequest(`/records/${id}`),
          apiRequest("/options"),
        ]);

        const loadedRecord = recordData.record;

        if (
          Number(loadedRecord.created_by) !==
          Number(meData.user?.id)
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

    if (files.length === 0) {
      resetFileInput();
      return;
    }

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

      const duplicateExisting = existingFiles.some(
        (existingFile) =>
          existingFile.file_name.toLowerCase() ===
          file.name.toLowerCase()
      );

      const duplicateSelected = selectedFiles.some(
        (selectedFile) =>
          selectedFile.file.name === file.name &&
          selectedFile.file.size === file.size &&
          selectedFile.file.lastModified === file.lastModified
      );

      if (duplicateExisting || duplicateSelected) {
        setFileError(`${file.name} has already been attached.`);
        resetFileInput();
        return;
      }
    }

    const newFiles: SelectedFile[] = files.map((file) => ({
      id: createFileId(file),
      file,
    }));

    setSelectedFiles((current) => [
      ...current,
      ...newFiles,
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

    setFileError("");
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

      setSuccess(
        "File removed. Save or resubmit when your corrections are complete."
      );
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

    if (!form.title.trim()) {
      throw new Error("Title is required.");
    }

    if (!form.category_id) {
      throw new Error("Please select a category.");
    }

    if (!form.date_received) {
      throw new Error("Date submitted is required.");
    }

    const payload = new FormData();

    payload.append("title", form.title.trim());
    payload.append("description", form.description);
    payload.append("category_id", form.category_id);
    payload.append("date_received", form.date_received);
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
    resetFileInput();

    setSuccess(data.message || "Corrections saved.");

    return data.record;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");
    setFileError("");

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
    setFileError("");

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

      setSuccess(
        data.message ||
          "Corrected submission sent back for review."
      );

      const savedUser = localStorage.getItem("iram_user");

      const roleName = savedUser
        ? JSON.parse(savedUser)?.role?.name
        : "";

      router.push(
        roleName === "Staff"
          ? "/records"
          : "/records?scope=mine"
      );

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
        <div className="rounded-2xl bg-white p-6 text-sm text-[#766F63] shadow-sm ring-1 ring-[#DED5C5]">
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

          <p className="mt-2 text-sm text-red-700">
            {error}
          </p>

          <Link
            href="/records?scope=mine"
            className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-red-700 px-4 py-3 text-sm font-semibold text-white sm:w-auto"
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
      <div className="mx-auto w-full max-w-5xl pb-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-600">
              Returned for Correction
            </p>

            <h1 className="mt-1 text-2xl font-bold text-[#252A27] sm:text-3xl">
              Correct Submission
            </h1>

            <p className="mt-1 text-sm leading-6 text-[#766F63]">
              Update the record and replace any incorrect or missing files.
            </p>
          </div>

          <Link
            href="/records?scope=mine"
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-[#E3DCCE] bg-white px-5 py-3 text-center text-sm font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] sm:w-auto"
          >
            Back to Details
          </Link>
        </section>

        <section className="mt-6 rounded-2xl border border-[#EBCF8F] bg-gradient-to-br from-[#FFF9EA] to-[#FFF3D6] p-4 shadow-sm sm:p-5">
          <p className="text-sm font-extrabold text-[#7A4A00]">
            Records Officer notes
          </p>

          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#8A5A08]">
            {record.correction_notes ||
              "No correction notes were provided."}
          </p>
        </section>

        <form onSubmit={handleSave} className="mt-5 space-y-5">
          {error && <Alert tone="error">{error}</Alert>}

          {success && <Alert tone="success">{success}</Alert>}

          <section className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DED5C5] sm:p-6">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#075A3A]" />
            <h2 className="text-lg font-extrabold text-[#2D332F]">
              Record Information
            </h2>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Record Code">
                <input
                  name="record_code"
                  value={form.record_code}
                  readOnly
                  aria-readonly="true"
                  className={`${inputClass} cursor-not-allowed border-[#CFE0D6] bg-[#F0F7F3] font-semibold text-[#075A3A]`}
                />
                <p className="mt-1.5 text-xs font-normal text-[#766F63]">System-generated codes cannot be changed.</p>
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
                  readOnly
                  aria-readonly="true"
                  className={`${inputClass} cursor-not-allowed border-[#CFE0D6] bg-[#F0F7F3] font-semibold text-[#075A3A]`}
                />
                <p className="mt-1.5 text-xs font-normal text-[#766F63]">Locked to the sender department captured at submission.</p>
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

          <section className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DED5C5] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="absolute inset-x-0 top-0 h-1 bg-[#D9961A]" />
                <h2 className="text-lg font-extrabold text-[#2D332F]">
                  Supporting Files
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#766F63]">
                  Remove incorrect files and upload replacements.
                </p>
              </div>

              <span className="w-fit shrink-0 rounded-full bg-[#FFF3D6] px-3 py-1 text-xs font-extrabold text-[#A66B00] ring-1 ring-[#EBCF8F]">
                {totalFiles}/{MAX_FILES}
              </span>
            </div>

            {fileError && (
              <div className="mt-4">
                <Alert tone="error">{fileError}</Alert>
              </div>
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
                <p className="rounded-xl border border-dashed border-[#D7CDBB] bg-[#FCFAF5] p-5 text-sm leading-6 text-[#766F63]">
                  No files attached. Add at least one file before resubmitting.
                </p>
              )}
            </div>

            <label
              className={`mt-4 flex min-h-36 flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition sm:px-5 ${
                totalFiles >= MAX_FILES || saving
                  ? "cursor-not-allowed border-[#E3DCCE] bg-[#F0ECE4] opacity-60"
                  : "cursor-pointer border-[#D7CDBB] bg-[#F8F5EE] hover:border-[#91BAA3] hover:bg-[#F0F7F3]"
              }`}
            >
              <span className="text-sm font-semibold text-[#2D332F]">
                Add replacement files
              </span>

              <span className="mt-1 text-xs leading-5 text-[#766F63]">
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

          <div className="sticky bottom-0 -mx-4 border-t border-[#E3DCCE] bg-[#F8F5EE]/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/records?scope=mine"
                className="flex min-h-12 w-full items-center justify-center rounded-xl border border-[#E3DCCE] bg-white px-5 py-3 text-center text-sm font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] sm:w-auto"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={saving}
                className="min-h-12 w-full rounded-xl border border-[#CFE0D6] bg-white px-5 py-3 text-sm font-bold text-[#075A3A] transition hover:bg-[#F0F7F3] focus:outline-none focus:ring-4 focus:ring-[#CFE0D6] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving ? "Saving..." : "Save Corrections"}
              </button>

              <button
                type="button"
                onClick={handleSaveAndResubmit}
                disabled={saving}
                className="min-h-12 w-full rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#6B0F2B]/20 transition hover:-translate-y-0.5 hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving ? "Processing..." : "Save & Resubmit"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

const inputClass =
  "mt-2 min-h-12 w-full rounded-xl border border-[#E3DCCE] bg-[#FCFAF5] px-4 py-3 text-base text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-[#514D46]">
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
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E3DCCE] bg-[#FCFAF5] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFF3D6] text-xs font-extrabold text-[#A66B00] ring-1 ring-[#EBCF8F]">
        {getExtension(name)}
      </div>

      <div className="min-w-0 flex-1">
        <p
          title={name}
          className="truncate text-sm font-semibold text-[#2D332F]"
        >
          {name}
        </p>

        <p className="mt-1 text-xs text-[#766F63]">
          {formatFileSize(size)}
        </p>
      </div>

      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
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
      role={tone === "error" ? "alert" : "status"}
      className={`break-words rounded-xl border px-4 py-3 text-sm font-medium ${
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

  return date.includes("T")
    ? date.slice(0, 10)
    : date;
}

function getExtension(name: string) {
  return (
    name
      .split(".")
      .pop()
      ?.slice(0, 4)
      .toUpperCase() || "FILE"
  );
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return "Unknown size";

  const units = ["Bytes", "KB", "MB", "GB"];

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}
