"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Clock3,
  FileText,
  Layers3,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
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
  retention_years: number;
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
  retention_years: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  retention_years: "5",
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

  const averageRetention = useMemo(() => {
    if (!isCategories || entries.length === 0) return 0;
    const total = (entries as Category[]).reduce(
      (sum, category) => sum + category.retention_years,
      0
    );
    return Math.round(total / entries.length);
  }, [entries, isCategories]);

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
      retention_years: isCategory(entry)
        ? String(entry.retention_years)
        : "5",
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
      const body = isCategories
        ? {
            name: form.name.trim(),
            description: form.description.trim() || null,
            retention_years: Number(form.retention_years),
          }
        : { description: form.description.trim() || null };
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
    if (!selected || !isCategories) return;
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
        error instanceof Error ? error.message : "Unable to delete category."
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
        eyebrow: "Records configuration",
        title: "Record Categories",
        description:
          "Define how records are classified and how long each type should be retained.",
        purposeTitle: "Why categories matter",
        purpose:
          "Categories keep the archive consistent, improve searching, and apply a clear retention period to every record type.",
        empty: "No categories match your search.",
      }
    : {
        eyebrow: "Institution structure",
        title: "Departments",
        description:
          "Maintain the official purpose of each college and understand where users and records belong.",
        purposeTitle: "Why departments matter",
        purpose:
          "Departments establish record ownership and staff access. Official names are protected so existing accounts and submissions remain correctly assigned.",
        empty: "No departments match your search.",
      };

  return (
    <AppShell>
      <main className="w-full pb-8">
        <section className="relative overflow-hidden rounded-3xl bg-[#064D33] px-5 py-7 text-white shadow-xl shadow-[#075A3A]/15 sm:px-8 sm:py-9">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#D9961A]/20 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-[#6B0F2B]/40 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                {isCategories ? <Tags size={22} /> : <Building2 size={22} />}
              </div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F4C25E]">
                {content.eyebrow}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                {content.title}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#E7E0D3] sm:text-base">
                {content.description}
              </p>
            </div>
            {isCategories && (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4C25E] px-5 py-3 text-sm font-extrabold text-[#3F2A05] shadow-lg transition hover:-translate-y-0.5 hover:bg-[#FFD273] focus:outline-none focus:ring-4 focus:ring-white/20"
              >
                <Plus size={18} /> Add category
              </button>
            )}
          </div>
        </section>

        {success && (
          <Notice tone="success" onDismiss={() => setSuccess("")}>
            {success}
          </Notice>
        )}
        {pageError && <Notice tone="error">{pageError}</Notice>}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <MetricCard
            icon={<Layers3 size={20} />}
            label={isCategories ? "Categories" : "Departments"}
            value={summary.total}
            helper="Configured in the system"
          />
          <MetricCard
            icon={<FileText size={20} />}
            label="Linked records"
            value={summary.records}
            helper="Records currently classified"
          />
          <MetricCard
            icon={isCategories ? <Clock3 size={20} /> : <Users size={20} />}
            label={isCategories ? "Average retention" : "Assigned users"}
            value={
              isCategories
                ? `${averageRetention} yr${averageRetention === 1 ? "" : "s"}`
                : summary.assigned_users || 0
            }
            helper={
              isCategories
                ? "Across visible categories"
                : "Accounts linked to departments"
            }
          />
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <form
              onSubmit={handleSearch}
              className="flex gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#DED5C5]"
            >
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search {mode}</span>
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#928875]"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${mode} by name or purpose...`}
                  className="w-full rounded-xl border border-transparent bg-[#F8F5EE] py-3 pl-11 pr-4 text-sm text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC]"
                />
              </label>
              <button className="rounded-xl bg-[#075A3A] px-5 text-sm font-bold text-white transition hover:bg-[#043D28]">
                Search
              </button>
            </form>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {loading && [0, 1, 2, 3].map((item) => <Skeleton key={item} />)}
              {!loading && entries.length === 0 && (
                <div className="rounded-2xl bg-white p-10 text-center text-sm text-[#766F63] shadow-sm ring-1 ring-[#DED5C5] lg:col-span-2">
                  {content.empty}
                </div>
              )}
              {!loading &&
                entries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    isCategories={isCategories}
                    onEdit={() => openEdit(entry)}
                    onDelete={() => openDelete(entry)}
                  />
                ))}
            </div>
          </div>

          <aside className="h-fit rounded-2xl bg-[#FFF9EC] p-5 ring-1 ring-[#E9D9AF] xl:sticky xl:top-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F4C25E]/30 text-[#7A4E00]">
              <ShieldCheck size={21} />
            </div>
            <h2 className="mt-4 font-extrabold text-[#2D332F]">
              {content.purposeTitle}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#6F6658]">
              {content.purpose}
            </p>
            <div className="mt-5 border-t border-[#E9D9AF] pt-4 text-xs leading-5 text-[#817766]">
              {isCategories
                ? "A category in use cannot be deleted until its records are reassigned. This protects archive data."
                : "Edit a department’s purpose when its responsibilities change. Official department names remain locked."}
            </div>
          </aside>
        </section>
      </main>

      {modal && (
        <ModalShell
          title={
            modal === "delete"
              ? "Delete category?"
              : selected
                ? isCategories
                  ? "Edit category"
                  : "Edit department purpose"
                : "Create category"
          }
          eyebrow={modal === "delete" ? "Confirm action" : "Administration"}
          onClose={closeModal}
          locked={submitting}
        >
          {modalError && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {modalError}
            </div>
          )}

          {modal === "form" && (
            <form onSubmit={submitForm} className="space-y-5">
              <FormField
                label={isCategories ? "Category name" : "Department"}
                helper={
                  isCategories
                    ? "Use a clear name staff will recognize when submitting records."
                    : "Official names are locked to preserve assignments."
                }
              >
                <input
                  required
                  disabled={!isCategories}
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
                  rows={5}
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

              {isCategories && (
                <FormField
                  label="Retention period (years)"
                  helper="How long records in this category should normally be kept."
                >
                  <input
                    required
                    type="number"
                    min={1}
                    max={100}
                    value={form.retention_years}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        retention_years: event.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </FormField>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-xl border border-[#DED5C5] px-5 py-3 text-sm font-bold text-[#625E56] hover:bg-[#F8F5EE]"
                >
                  Cancel
                </button>
                <button
                  disabled={submitting}
                  className="rounded-xl bg-[#075A3A] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#075A3A]/15 hover:bg-[#043D28] disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          )}

          {modal === "delete" && selected && (
            <div>
              <div className="flex gap-3 rounded-2xl bg-red-50 p-4 text-red-800 ring-1 ring-red-100">
                <AlertTriangle className="mt-0.5 shrink-0" size={20} />
                <p className="text-sm leading-6">
                  You are about to delete <strong>{selected.name}</strong>.
                  This action cannot be undone.
                </p>
              </div>
              {isCategory(selected) && selected.records_count > 0 && (
                <p className="mt-4 text-sm leading-6 text-[#766F63]">
                  This category has {selected.records_count} linked record(s),
                  so the system will protect it from deletion until those records
                  are reassigned.
                </p>
              )}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-xl border border-[#DED5C5] px-5 py-3 text-sm font-bold text-[#625E56]"
                >
                  Keep category
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={submitting || (isCategory(selected) && selected.records_count > 0)}
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? "Deleting..." : "Delete category"}
                </button>
              </div>
            </div>
          )}
        </ModalShell>
      )}
    </AppShell>
  );
}

function isCategory(entry: Entry): entry is Category {
  return "retention_years" in entry;
}

function EntryCard({
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
    <article className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DED5C5] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#5F5545]/10">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#075A3A] via-[#D9961A] to-[#6B0F2B] opacity-80" />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EDF5F1] font-black text-[#075A3A]">
          {entry.name.trim().charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold leading-5 text-[#2D332F]">
            {entry.name}
          </h2>
          {!isCategory(entry) && (
            <span
              className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                entry.accepts_submissions
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-[#F0ECE4] text-[#6F6658]"
              }`}
            >
              {entry.accepts_submissions ? "Submission college" : "Administrative office"}
            </span>
          )}
        </div>
      </div>

      <p className="mt-4 min-h-12 text-sm leading-6 text-[#766F63]">
        {entry.description || "No purpose description has been added yet."}
      </p>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-[#EEE8DC] pt-4">
        <DataPill icon={<FileText size={14} />}>
          {entry.records_count} record{entry.records_count === 1 ? "" : "s"}
        </DataPill>
        {isCategory(entry) ? (
          <DataPill icon={<Clock3 size={14} />}>
            {entry.retention_years} year retention
          </DataPill>
        ) : (
          <DataPill icon={<Users size={14} />}>
            {entry.users_count} user{entry.users_count === 1 ? "" : "s"}
          </DataPill>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#F0F7F3] px-3 py-2.5 text-xs font-bold text-[#075A3A] ring-1 ring-[#CFE0D6] hover:bg-[#E2F0E9]"
        >
          <Pencil size={14} /> {isCategories ? "Edit" : "Edit purpose"}
        </button>
        {isCategories && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete category"
            className="inline-flex items-center justify-center rounded-lg bg-red-50 px-3.5 py-2.5 text-red-700 hover:bg-red-100"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </article>
  );
}

function MetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DED5C5]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#928875]">
          {label}
        </p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F7F3EA] text-[#075A3A]">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-black text-[#2D332F]">{value}</p>
      <p className="mt-1 text-xs text-[#928875]">{helper}</p>
    </article>
  );
}

function DataPill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F7F3EA] px-3 py-1.5 text-xs font-semibold text-[#6F6658]">
      {icon} {children}
    </span>
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
      className={`mt-5 flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm font-medium ${
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
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-[#DED5C5]"
      >
        <header className="flex items-start justify-between border-b border-[#E8E1D5] px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D08A0D]">
              {eyebrow}
            </p>
            <h2 id="classification-modal-title" className="mt-1 text-xl font-black text-[#2D332F]">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            aria-label="Close dialog"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0ECE4] text-[#625E56] hover:bg-[#E5DED2] disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </header>
        <div className="p-6">{children}</div>
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
    <label className="block text-sm font-bold text-[#514D46]">
      {label}
      {children}
      <span className="mt-1.5 block text-xs font-normal leading-5 text-[#928875]">
        {helper}
      </span>
    </label>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse rounded-2xl bg-white p-5 ring-1 ring-[#DED5C5]">
      <div className="flex gap-3">
        <div className="h-11 w-11 rounded-xl bg-[#EEE8DC]" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-4 w-2/3 rounded bg-[#EEE8DC]" />
          <div className="h-3 w-1/3 rounded bg-[#F4F0E8]" />
        </div>
      </div>
      <div className="mt-5 h-14 rounded bg-[#F4F0E8]" />
      <div className="mt-5 h-9 rounded bg-[#EEE8DC]" />
    </div>
  );
}

const inputClass =
  "mt-2 w-full rounded-xl border border-[#DED5C5] bg-[#FCFAF5] px-4 py-3 text-sm font-normal text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] disabled:cursor-not-allowed disabled:bg-[#EEEAE2] disabled:text-[#817766]";
