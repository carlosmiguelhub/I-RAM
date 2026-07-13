"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

type Department = {
  id: number;
  name: string;
};

type Category = {
  id: number;
  name: string;
};

type User = {
  id: number;
  name: string;
  department_id?: number | null;
  department?: Department | null;
  role?: {
    id: number;
    name: string;
  } | null;
};

type SelectedFile = {
  id: string;
  file: File;
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

export default function CreateRecordPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    record_code: "",
    title: "",
    description: "",
    category_id: "",
    department_id: "",
    date_received: "",
    source: "",
    status: "received",
    storage_location: "",
    remarks: "",
  });

  const isStaff = user?.role?.name === "Staff";

  const totalFileSize = selectedFiles.reduce(
    (total, selectedFile) => total + selectedFile.file.size,
    0
  );

  useEffect(() => {
    async function loadPageData() {
      try {
        const savedUser = localStorage.getItem("iram_user");

        if (savedUser) {
          const parsedUser: User = JSON.parse(savedUser);

          setUser(parsedUser);

          if (
            parsedUser.role?.name === "Staff" &&
            parsedUser.department_id
          ) {
            setForm((current) => ({
              ...current,
              department_id: String(parsedUser.department_id),
              status: "received",
              storage_location: "",
            }));
          }
        }

        const data = await apiRequest("/options");

        setDepartments(data.departments || []);
        setCategories(data.categories || []);
        setStatuses(data.statuses || []);
      } catch (error) {
        console.error(error);
        setSubmitError("Failed to load form options.");
      }
    }

    loadPageData();
  }, []);

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

    setSubmitError("");
  }

  function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);

    setFileError("");

    if (selectedFiles.length + files.length > MAX_FILES) {
      setFileError(`You may upload a maximum of ${MAX_FILES} files.`);
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

      const duplicate = selectedFiles.some(
        (selectedFile) =>
          selectedFile.file.name === file.name &&
          selectedFile.file.size === file.size &&
          selectedFile.file.lastModified === file.lastModified
      );

      if (duplicate) {
        setFileError(`${file.name} has already been selected.`);
        resetFileInput();
        return;
      }
    }

    const newFiles: SelectedFile[] = files.map((file) => ({
      id: createFileId(file),
      file,
    }));

    setSelectedFiles((current) => [...current, ...newFiles]);
    resetFileInput();
  }

  function resetFileInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeFile(id: string) {
    setSelectedFiles((current) =>
      current.filter((selectedFile) => selectedFile.id !== id)
    );

    setFileError("");
  }

  function formatFileSize(bytes: number) {
    if (bytes === 0) {
      return "0 Bytes";
    }

    const units = ["Bytes", "KB", "MB", "GB"];
    const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, unitIndex);

    return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${
      units[unitIndex]
    }`;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setLoading(true);
    setSubmitError("");
    setFileError("");

    try {
      if (!form.category_id) {
        throw new Error("Please select a category.");
      }

      if (!form.department_id) {
        throw new Error("Please select a department.");
      }

      if (isStaff && !user?.department_id) {
        throw new Error(
          "Your account is not assigned to a department."
        );
      }

      const payload = new FormData();

      payload.append("record_code", form.record_code.trim());
      payload.append("title", form.title.trim());
      payload.append("description", form.description);
      payload.append("category_id", form.category_id);

      payload.append(
        "department_id",
        isStaff && user?.department_id
          ? String(user.department_id)
          : form.department_id
      );

      payload.append("date_received", form.date_received);
      payload.append("source", form.source);
      payload.append("status", isStaff ? "received" : form.status);

      payload.append(
        "storage_location",
        isStaff ? "" : form.storage_location
      );

      payload.append("remarks", form.remarks);

      selectedFiles.forEach(({ file }) => {
        payload.append("files[]", file);
      });

      await apiRequest("/records", {
        method: "POST",
        body: payload,
      });

      router.push("/records");
      router.refresh();
    } catch (error: unknown) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Failed to submit the record."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#075A3A]">
              {isStaff ? "Staff Submission" : "Record Encoder"}
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#252A27] sm:text-3xl">
              {isStaff ? "New Submission" : "Add New Record"}
            </h1>

            <p className="mt-1 max-w-xl text-sm leading-6 text-[#766F63]">
              {isStaff
                ? "Submit a digital or physical record for review by the Records Office."
                : "Encode a newly acquired physical or digital document into the IRAM archive."}
            </p>
          </div>

          <Link
            href="/records"
            className="flex w-full items-center justify-center rounded-xl border border-[#E3DCCE] bg-white px-5 py-3 text-sm font-semibold text-[#514D46] shadow-sm transition hover:bg-[#F8F5EE] sm:w-auto"
          >
            Back to Records
          </Link>
        </section>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {submitError && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
            >
              {submitError}
            </div>
          )}

          <section className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DED5C5] sm:p-6">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#075A3A]" />
            <h2 className="text-lg font-extrabold text-[#2D332F]">
              Basic Information
            </h2>

            <p className="mt-1 text-sm text-[#766F63]">
              Required details for identifying and classifying the record.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="Record Code"
                name="record_code"
                value={form.record_code}
                onChange={handleChange}
                placeholder="IRAM-2026-0001"
                required
              />

              <FormInput
                label="Date Received"
                name="date_received"
                type="date"
                value={form.date_received}
                onChange={handleChange}
                required
              />

              <div className="md:col-span-2">
                <FormInput
                  label="Title"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Enter record title"
                  required
                />
              </div>

              <FormSelect
                label="Category"
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                required
              >
                <option value="">Select category</option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </FormSelect>

              <FormSelect
                label="Department"
                name="department_id"
                value={form.department_id}
                onChange={handleChange}
                required
                disabled={isStaff}
              >
                <option value="">Select department</option>

                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </FormSelect>

              {isStaff && (
                <p className="-mt-1 text-xs text-[#766F63] md:col-start-2">
                  Your department is assigned automatically from your
                  account.
                </p>
              )}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DED5C5] sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="absolute inset-x-0 top-0 h-1 bg-[#D9961A]" />
                <h2 className="text-lg font-extrabold text-[#2D332F]">
                  Record Files
                </h2>

                <p className="mt-1 text-sm leading-6 text-[#766F63]">
                  Attach supporting documents. You may upload up to 5
                  files, with a maximum size of 10 MB per file.
                </p>
              </div>

              <span className="w-fit rounded-full bg-[#FFF3D6] px-3 py-1 text-xs font-extrabold text-[#A66B00] ring-1 ring-[#EBCF8F]">
                {selectedFiles.length}/{MAX_FILES} files
              </span>
            </div>

            <div className="mt-5">
              <label
                htmlFor="record-files"
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition sm:px-6 sm:py-10 ${
                  selectedFiles.length >= MAX_FILES || loading
                    ? "cursor-not-allowed border-[#E3DCCE] bg-[#F0ECE4] opacity-70"
                    : "cursor-pointer border-[#D7CDBB] bg-[#F8F5EE] hover:border-[#91BAA3] hover:bg-[#F0F7F3]/50"
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D9961A] text-2xl font-extrabold text-white shadow-md shadow-[#D9961A]/20">
                  ↑
                </span>

                <span className="mt-3 text-sm font-semibold text-[#2D332F]">
                  Choose files to upload
                </span>

                <span className="mt-1 text-xs leading-5 text-[#766F63]">
                  PDF, Word, Excel, PowerPoint, image, CSV, or text files
                </span>

                <input
                  ref={fileInputRef}
                  id="record-files"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.csv"
                  onChange={handleFileChange}
                  disabled={loading || selectedFiles.length >= MAX_FILES}
                  className="sr-only"
                />
              </label>

              {fileError && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {fileError}
                </p>
              )}

              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-3">
                  {selectedFiles.map(({ id, file }) => (
                    <div
                      key={id}
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E3DCCE] bg-white p-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FFF3D6] text-xs font-extrabold uppercase text-[#A66B00] ring-1 ring-[#EBCF8F]">
                        {file.name
                          .split(".")
                          .pop()
                          ?.slice(0, 4) || "FILE"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#2D332F]">
                          {file.name}
                        </p>

                        <p className="mt-0.5 text-xs text-[#766F63]">
                          {formatFileSize(file.size)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFile(id)}
                        disabled={loading}
                        className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <div className="flex justify-end text-xs font-medium text-[#766F63]">
                    Total size: {formatFileSize(totalFileSize)}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DED5C5] sm:p-6">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#6B0F2B]" />
            <h2 className="text-lg font-extrabold text-[#2D332F]">
              {isStaff ? "Submission Details" : "Archive Details"}
            </h2>

            <p className="mt-1 text-sm text-[#766F63]">
              {isStaff
                ? "Add the source, description, and optional notes for review."
                : "Add source, status, location, and notes for archive tracking."}
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="Source / Sender"
                name="source"
                value={form.source}
                onChange={handleChange}
                placeholder="Registrar Office"
              />

              {isStaff ? (
                <div className="rounded-xl border border-[#CFE0D6] bg-gradient-to-br from-[#F0F7F3] to-[#FFF9EA] px-4 py-3">
                  <p className="text-sm font-semibold text-[#064D33]">
                    Initial Status: Received
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#075A3A]">
                    A Records Officer will review the submission and
                    assign its archive status and storage location.
                  </p>
                </div>
              ) : (
                <FormSelect
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replaceAll("_", " ")}
                    </option>
                  ))}
                </FormSelect>
              )}

              {!isStaff && (
                <div className="md:col-span-2">
                  <FormInput
                    label="Storage Location"
                    name="storage_location"
                    value={form.storage_location}
                    onChange={handleChange}
                    placeholder="Cabinet A - Drawer 1"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <FormTextarea
                  label="Description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Briefly describe the record..."
                />
              </div>

              <div className="md:col-span-2">
                <FormTextarea
                  label="Remarks"
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
          </section>

          <div className="sticky bottom-0 -mx-4 border-t border-[#E3DCCE] bg-[#F8F5EE]/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Link
                href="/records"
                className="flex w-full items-center justify-center rounded-xl border border-[#E3DCCE] bg-white px-5 py-3 text-sm font-semibold text-[#514D46] transition hover:bg-[#FCFAF5] hover:text-[#6B0F2B] sm:w-auto"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#6B0F2B]/20 transition hover:-translate-y-0.5 hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loading
                  ? "Submitting..."
                  : isStaff
                    ? "Submit for Review"
                    : "Save Record"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function FormInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#514D46]">
        {label}
      </span>

      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="mt-2 min-h-12 w-full rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-base text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
      />
    </label>
  );
}

function FormSelect({
  label,
  name,
  value,
  onChange,
  children,
  required = false,
  disabled = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#514D46]">
        {label}
      </span>

      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className="mt-2 min-h-12 w-full rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-base text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] disabled:cursor-not-allowed disabled:bg-[#F0ECE4] disabled:text-[#766F63] sm:text-sm"
      >
        {children}
      </select>
    </label>
  );
}

function FormTextarea({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (
    event: React.ChangeEvent<HTMLTextAreaElement>
  ) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#514D46]">
        {label}
      </span>

      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={4}
        className="mt-2 w-full resize-none rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-base text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
      />
    </label>
  );
}