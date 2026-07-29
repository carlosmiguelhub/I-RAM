"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  FileText,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  Users,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

type Category = {
  id: number;
  name: string;
  description: string | null;
  records_count: number;
};

type Department = {
  id: number;
  name: string;
  description: string | null;
  users_count: number;
  records_count: number;
  accepts_submissions: boolean;
};

type Entry = Category | Department;
type ManagerMode = "categories" | "departments";

type Summary = {
  total: number;
  records: number;
  assigned_users?: number;
};

type FormState = {
  name: string;
  description: string;
  accepts_submissions: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  accepts_submissions: true,
};

export default function ClassificationManager({
  mode,
}: {
  mode: ManagerMode;
}) {
  const router = useRouter();
  const isCategories = mode === "categories";
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    records: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState<Entry | null>(null);
  const [modal, setModal] = useState<"form" | "delete" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const endpoint = `/admin/${mode}`;

  const loadEntries = useCallback(async (query: string) => {
    setLoading(true);
    setPageError("");

    try {
      const suffix = query.trim()
        ? `?search=${encodeURIComponent(query.trim())}`
        : "";
      const data = await apiRequest(`${endpoint}${suffix}`);
      setEntries(data.data || []);
      setSummary(data.summary || { total: 0, records: 0 });
    } catch (error: unknown) {
      setPageError(
        error instanceof Error
          ? error.message
          : `Unable to load ${mode}.`
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint, mode]);

  useEffect(() => {
    async function initialize() {
      try {
        const data = await apiRequest("/me");

        if (data.user?.role?.name !== "Admin") {
          router.replace("/dashboard");
          return;
        }

        await loadEntries("");
      } catch {
        router.replace("/login");
      }
    }

    initialize();
  }, [loadEntries, router]);

  const documentedEntries = useMemo(
    () => entries.filter((entry) => Boolean(entry.description?.trim())).length,
    [entries]
  );

  function openCreate() {
    setSelected(null);
    setForm(emptyForm);
    setModalError("");
    setModal("form");
  }

  function openEdit(entry: Entry) {
    setSelected(entry);
    setForm({
      name: entry.name,
      description: entry.description || "",
      accepts_submissions: isDepartment(entry)
        ? entry.accepts_submissions
        : true,
    });
    setModalError("");
    setModal("form");
  }

  function openDelete(entry: Entry) {
    setSelected(entry);
    setModalError("");
    setModal("delete");
  }

  function closeModal() {
    if (submitting) return;
    setModal(null);
    setSelected(null);
    setModalError("");
    setForm(emptyForm);
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setModalError("");

    try {
      const isEditing = selected !== null;
      const requestEndpoint = isEditing
        ? `${endpoint}/${selected.id}`
        : endpoint;
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        ...(!isCategories
          ? { accepts_submissions: form.accepts_submissions }
          : {}),
      };
      const data = await apiRequest(requestEndpoint, {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });

      setSuccess(data.message);
      closeAfterSubmit();
      await loadEntries(search);
    } catch (error: unknown) {
      setModalError(
        error instanceof Error ? error.message : "Unable to save changes."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!selected) return;
    setSubmitting(true);
    setModalError("");

    try {
      const data = await apiRequest(`${endpoint}/${selected.id}`, {
        method: "DELETE",
      });
      setSuccess(data.message);
      closeAfterSubmit();
      await loadEntries(search);
    } catch (error: unknown) {
      setModalError(
        error instanceof Error
          ? error.message
          : `Unable to delete ${isCategories ? "category" : "department"}.`
      );
    } finally {
      setSubmitting(false);
    }
  }

  function closeAfterSubmit() {
    setModal(null);
    setSelected(null);
    setModalError("");
    setForm(emptyForm);
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    loadEntries(search);
  }

  const content = isCategories
    ? {
        title: "Record Categories",
        description: "Manage the classifications used across records.",
        empty: "No categories match your search.",
      }
    : {
        title: "Departments",
        description: "Manage offices, colleges, and record ownership.",
        empty: "No departments match your search.",
      };

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl pb-8">
        <div className="mb-5 flex flex-col gap-3 border-b border-[#E3E6E3] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E7F0EB] text-[#075A3A]">
              {isCategories ? (
                <Tags className="h-4 w-4" />
              ) : (
                <Building2 className="h-4 w-4" />
              )}
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8A8174]">
                Administration
              </p>
              <h1 className="mt-0.5 text-xl font-bold text-[#252A27]">
                {content.title}
              </h1>
              <p className="mt-1 text-sm text-[#6E756F]">
                {content.description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-[#075A3A] px-3.5 text-xs font-bold text-white transition hover:bg-[#06472F] sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            Add {isCategories ? "category" : "department"}
          </button>
        </div>

        {success && (
          <Notice tone="success" onDismiss={() => setSuccess("")}>
            {success}
          </Notice>
        )}
        {pageError && <Notice tone="error">{pageError}</Notice>}

        <section className="mb-4 grid grid-cols-3 divide-x divide-[#E4E7E4] rounded-xl border border-[#E0E4E1] bg-white px-2 py-3 shadow-sm">
          <CompactMetric
            label={isCategories ? "Categories" : "Departments"}
            value={summary.total}
          />
          <CompactMetric label="Linked records" value={summary.records} />
          <CompactMetric
            label={isCategories ? "Documented" : "Assigned users"}
            value={
              isCategories
                ? documentedEntries
                : summary.assigned_users || 0
            }
          />
        </section>

        <section className="overflow-hidden rounded-xl border border-[#E0E4E1] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#E8EAE8] bg-[#FAFBFA] p-3 sm:flex-row sm:items-center sm:justify-between">
            <form
              onSubmit={handleSearch}
              className="flex min-w-0 flex-1 gap-2 sm:max-w-md"
            >
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search {mode}</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A938C]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${mode}...`}
                  className="h-9 w-full rounded-lg border border-[#D8DDD9] bg-white pl-9 pr-3 text-sm text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:ring-2 focus:ring-[#DCEAE2]"
                />
              </label>
              <button className="h-9 rounded-lg border border-[#D8DDD9] bg-white px-3 text-xs font-bold text-[#455049] transition hover:border-[#AAB8B0] hover:bg-[#F5F7F5]">
                Search
              </button>
            </form>

            <p className="text-xs text-[#818882]">
              {isCategories
                ? "In-use categories cannot be deleted."
                : "Assigned departments cannot be deleted."}
            </p>
          </div>

          <div className="divide-y divide-[#ECEEEC]">
            {loading &&
              [0, 1, 2, 3].map((item) => <Skeleton key={item} />)}
            {!loading && entries.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-[#7B817C]">
                {content.empty}
              </div>
            )}
            {!loading &&
              entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  isCategories={isCategories}
                  onEdit={() => openEdit(entry)}
                  onDelete={() => openDelete(entry)}
                />
              ))}
          </div>
        </section>
      </main>

      {modal && (
        <ModalShell
          title={
            modal === "delete"
              ? `Delete ${isCategories ? "category" : "department"}?`
              : selected
                ? isCategories
                  ? "Edit category"
                  : "Edit department"
                : `Create ${isCategories ? "category" : "department"}`
          }
          eyebrow={modal === "delete" ? "Confirm action" : "Administration"}
          onClose={closeModal}
          locked={submitting}
        >
          {modalError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {modalError}
            </div>
          )}

          {modal === "form" && (
            <form onSubmit={submitForm} className="space-y-4">
              <FormField
                label={isCategories ? "Category name" : "Department"}
                helper={
                  isCategories
                    ? "Use a clear name staff will recognize when submitting records."
                    : "Use the official office, college, or unit name."
                }
              >
                <input
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className={inputClass}
                />
              </FormField>

              <FormField
                label="Purpose and description"
                helper="Explain what belongs here so administrators and staff can make consistent choices."
              >
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe the purpose..."
                  className={`${inputClass} resize-none`}
                />
              </FormField>

              {!isCategories && (
                <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[#D9E6DE] bg-[#F7FAF8] p-3">
                  <span>
                    <span className="block text-sm font-bold text-[#2D332F]">
                      Accept record submissions
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#766F63]">
                      Enable this for offices and colleges that should appear in record forms.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.accepts_submissions}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        accepts_submissions: event.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 accent-[#075A3A]"
                  />
                </label>
              )}

              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="h-9 rounded-lg border border-[#D8DDD9] px-3.5 text-xs font-bold text-[#59615B] hover:bg-[#F5F7F5]"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  className="h-9 rounded-lg bg-[#075A3A] px-3.5 text-xs font-bold text-white hover:bg-[#06472F] disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          )}

          {modal === "delete" && selected && (
            <div>
              <div className="flex gap-3 rounded-lg bg-red-50 p-3 text-red-800 ring-1 ring-red-100">
                <AlertTriangle className="mt-0.5 shrink-0" size={20} />
                <p className="text-sm leading-6">
                  You are about to delete <strong>{selected.name}</strong>.
                  This action cannot be undone.
                </p>
              </div>
              {(selected.records_count > 0 ||
                (isDepartment(selected) && selected.users_count > 0)) && (
                <p className="mt-4 text-sm leading-6 text-[#766F63]">
                  This {isCategories ? "category" : "department"} has{" "}
                  {selected.records_count} linked record(s)
                  {isDepartment(selected)
                    ? ` and ${selected.users_count} assigned user(s)`
                    : ""}. Reassign them before deleting it.
                </p>
              )}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="h-9 rounded-lg border border-[#D8DDD9] px-3.5 text-xs font-bold text-[#59615B]"
                >
                  Keep {isCategories ? "category" : "department"}
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={
                    submitting ||
                    selected.records_count > 0 ||
                    (isDepartment(selected) && selected.users_count > 0)
                  }
                  className="h-9 rounded-lg bg-red-600 px-3.5 text-xs font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting
                    ? "Deleting..."
                    : `Delete ${isCategories ? "category" : "department"}`}
                </button>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </AppShell>
  );
}

function isDepartment(entry: Entry): entry is Department {
  return "users_count" in entry;
}

function EntryRow({
  entry,
  isCategories,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  isCategories: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-[#FAFBFA]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF2ED] text-xs font-bold text-[#075A3A]">
        {entry.name.trim().charAt(0).toUpperCase() || "?"}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <h2 className="truncate text-sm font-bold text-[#2D332F]">
            {entry.name}
          </h2>
          {isDepartment(entry) && (
            <span
              className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${
                entry.accepts_submissions
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-[#F0F2F0] text-[#687069]"
              }`}
            >
              {entry.accepts_submissions
                ? "Accepts submissions"
                : "Assignment only"}
            </span>
          )}
        </div>

        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#777E78]">
          {entry.description || "No description added."}
        </p>

        <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] font-semibold text-[#7E867F]">
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {entry.records_count} record{entry.records_count === 1 ? "" : "s"}
          </span>
          {isDepartment(entry) && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {entry.users_count} user{entry.users_count === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${entry.name}`}
          className="rounded-md p-1.5 text-[#687069] transition hover:bg-[#E8F0EB] hover:text-[#075A3A]"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${isCategories ? "category" : "department"} ${entry.name}`}
          className="rounded-md p-1.5 text-[#8A777D] transition hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

function CompactMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 px-2 text-center sm:px-4 sm:text-left">
      <p className="text-lg font-bold leading-6 text-[#2D332F]">{value}</p>
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-[#858C86] sm:text-xs sm:normal-case sm:tracking-normal">
        {label}
      </p>
    </div>
  );
}

function Notice({
  tone,
  children,
  onDismiss,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`mb-4 flex items-center justify-between gap-4 rounded-lg border px-3 py-2 text-sm font-medium ${
        tone === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {children}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss message">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function ModalShell({
  title,
  eyebrow,
  children,
  onClose,
  locked,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  onClose: () => void;
  locked: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#24342C]/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !locked) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="classification-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl ring-1 ring-[#D8DDD9]"
      >
        <header className="flex items-start justify-between border-b border-[#E8EAE8] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A8174]">
              {eyebrow}
            </p>
            <h2 id="classification-modal-title" className="mt-0.5 text-lg font-bold text-[#2D332F]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            aria-label="Close dialog"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#687069] hover:bg-[#EEF1EF] disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

function FormField({
  label,
  helper,
  children,
}: {
  label: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-bold text-[#414842]">
      {label}
      {children}
      <span className="mt-1 block text-xs font-normal leading-5 text-[#858C86]">
        {helper}
      </span>
    </label>
  );
}

function Skeleton() {
  return (
    <div className="flex animate-pulse gap-3 px-4 py-3.5">
      <div className="h-8 w-8 rounded-lg bg-[#E9ECEA]" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3.5 w-1/3 rounded bg-[#E4E8E5]" />
        <div className="h-3 w-2/3 rounded bg-[#EEF0EE]" />
        <div className="h-3 w-1/4 rounded bg-[#EEF0EE]" />
      </div>
      <div className="flex gap-1">
        <div className="h-7 w-7 rounded bg-[#EEF0EE]" />
        <div className="h-7 w-7 rounded bg-[#EEF0EE]" />
      </div>
    </div>
  );
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-[#D8DDD9] bg-white px-3 py-2 text-sm font-normal text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:ring-2 focus:ring-[#DCEAE2] disabled:cursor-not-allowed disabled:bg-[#EEF1EF] disabled:text-[#818781]";
