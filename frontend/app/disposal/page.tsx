"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  CalendarClock,
  FileText,
  Loader2,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import ViewModeToggle, {
  usePersistentViewMode,
} from "@/components/archive/ViewModeToggle";
import { apiRequest } from "@/lib/api";

type DisposalRecord = {
  id: number;
  record_code: string;
  title: string;
  description?: string | null;
  retention_years?: number | null;
  retention_unit?: "years" | "minutes";
  retention_expires_at?: string | null;
  for_disposal_at?: string | null;
  category?: { name?: string | null } | null;
  department?: { name?: string | null } | null;
  files?: Array<{ id: number }>;
};

type ActionMode = "restore" | "dispose";

export default function DisposalRepositoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<DisposalRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] =
    useState<DisposalRecord | null>(null);
  const [actionMode, setActionMode] =
    useState<ActionMode>("restore");
  const [retentionType, setRetentionType] =
    useState<"permanent" | "temporary">("temporary");
  const [retentionYears, setRetentionYears] = useState("1");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewMode, changeView] = usePersistentViewMode(
    "disposal-record-view",
    "grid"
  );
  const [retentionUnit, setRetentionUnit] =
    useState<"years" | "minutes">("years");
  const searchRef = useRef("");
  const roleVerifiedRef = useRef(false);
  const syncingRef = useRef(false);

  async function loadRecords(
    searchValue = search,
    silent = false
  ) {
    if (syncingRef.current) return;
    syncingRef.current = true;

    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      if (!roleVerifiedRef.current) {
        const me = await apiRequest("/me");
        const role = me.user?.role?.name;

        if (!["Admin", "Records Officer"].includes(role)) {
          router.replace("/dashboard");
          return;
        }

        roleVerifiedRef.current = true;
      }

      const params = new URLSearchParams();
      if (searchValue.trim()) {
        params.set("search", searchValue.trim());
      }

      const data = await apiRequest(
        `/disposal/records?${params.toString()}`
      );
      setRecords(data.data || []);
    } catch (err: unknown) {
      if (!silent) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load the For Disposal Repository."
        );
      }
    } finally {
      syncingRef.current = false;
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadRecords("");
    }, 0);
    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadRecords(searchRef.current, true);
      }
    }, 5000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(pollId);
    };
  }, []);

  function openAction(
    record: DisposalRecord,
    mode: ActionMode
  ) {
    setSelected(record);
    setActionMode(mode);
    setRetentionType("temporary");
    setRetentionYears("1");
    setRetentionUnit("years");
    setNotes("");
    setError("");
    setSuccess("");
  }

  async function submitAction() {
    if (!selected) return;

    const years = Number(retentionYears);
    if (
      actionMode === "restore" &&
      retentionType === "temporary" &&
      (!Number.isInteger(years) ||
        years < 1 ||
        years > 100 ||
        (retentionUnit === "minutes" && years !== 1))
    ) {
      setError("Enter a whole number from 1 to 100 years.");
      return;
    }
    if (actionMode === "dispose" && !notes.trim()) {
      setError("Disposal notes are required for the audit trail.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const endpoint =
        actionMode === "restore" ? "restore" : "dispose";
      const body =
        actionMode === "restore"
          ? {
              retention_type: retentionType,
              retention_years:
                retentionType === "temporary" ? years : null,
              retention_unit:
                retentionType === "temporary"
                  ? retentionUnit
                  : "years",
              notes: notes.trim() || null,
            }
          : { disposal_notes: notes.trim() };

      const data = await apiRequest(
        `/disposal/records/${selected.id}/${endpoint}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      setSelected(null);
      setSuccess(data.message || "Record updated successfully.");
      await loadRecords(search);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "The disposal action could not be completed."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl">
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6B0F2B] via-[#571023] to-[#350714] px-5 py-5 text-white shadow-lg shadow-[#6B0F2B]/15 sm:px-7">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#D9961A]/20 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <ShieldAlert className="h-6 w-6 text-[#F4C25E]" />
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F4C25E]">
                Restricted Repository
              </p>
              <h1 className="mt-1 text-2xl font-extrabold">
                For Disposal
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#E5DDCC]">
                Records whose temporary retention periods have ended.
                These records are hidden from the Archive Repository
                and all Staff views.
              </p>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-xl border border-[#E3DCCE] bg-white p-3 shadow-sm sm:p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadRecords(search);
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <label className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9B8F7C]" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  searchRef.current = event.target.value;
                }}
                placeholder="Search record code, title, or description"
                className="min-h-11 w-full rounded-xl border border-[#DED5C5] pl-10 pr-3 text-sm outline-none focus:border-[#6B0F2B] focus:ring-2 focus:ring-[#6B0F2B]/10"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="min-h-11 rounded-xl bg-[#6B0F2B] px-5 text-sm font-bold text-white hover:bg-[#571023] disabled:opacity-50"
            >
              Search
            </button>
            <div className="hidden h-8 w-px bg-[#E3DCCE] sm:block" />
            <ViewModeToggle
              value={viewMode}
              onChange={changeView}
            />
          </form>
        </section>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        )}

        <section className="mt-5">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-[#E3DCCE] bg-white">
              <Loader2 className="h-7 w-7 animate-spin text-[#6B0F2B]" />
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D7CDBB] bg-white px-6 py-16 text-center">
              <Trash2 className="mx-auto h-10 w-10 text-[#B6AA98]" />
              <h2 className="mt-3 text-lg font-bold text-[#2D332F]">
                No records awaiting disposal
              </h2>
              <p className="mt-1 text-sm text-[#766F63]">
                Temporary records appear here automatically when
                their retention period ends.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {records.map((record) => (
                <DisposalCard
                  key={record.id}
                  record={record}
                  onRestore={() => openAction(record, "restore")}
                  onDispose={() => openAction(record, "dispose")}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#E3DCCE] bg-white shadow-sm">
              <div className="hidden grid-cols-[minmax(250px,1.4fr)_170px_170px_130px_230px] gap-4 border-b border-[#E3DCCE] bg-[#F8F5EE] px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-[#766F63] lg:grid">
                <span>Record</span>
                <span>Classification</span>
                <span>Retention</span>
                <span>Files</span>
                <span className="text-right">Actions</span>
              </div>
              {records.map((record) => (
                <DisposalListRow
                  key={record.id}
                  record={record}
                  onRestore={() => openAction(record, "restore")}
                  onDispose={() => openAction(record, "dispose")}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17231E]/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-[#E3DCCE] px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#6B0F2B]">
                  {selected.record_code}
                </p>
                <h2 className="mt-1 text-lg font-extrabold text-[#252A27]">
                  {actionMode === "restore"
                    ? "Return to Archive"
                    : "Confirm Disposal"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => !saving && setSelected(null)}
                aria-label="Close"
                className="rounded-lg p-2 text-[#766F63] hover:bg-[#F8F5EE]"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-4 p-5">
              {actionMode === "restore" ? (
                <>
                  <p className="text-sm leading-6 text-[#766F63]">
                    Choose a new retention schedule. The record will
                    return to its previous archive folder.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
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
                        {
                          label: "Permanent",
                          type: "permanent",
                          unit: "years",
                        },
                      ] as const
                    ).map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => {
                            setRetentionType(option.type);
                            setRetentionUnit(option.unit);
                            if (option.unit === "minutes") {
                              setRetentionYears("1");
                            }
                          }}
                          className={`rounded-xl border px-2 py-3 text-xs font-bold ${
                            retentionType === option.type &&
                            retentionUnit === option.unit
                              ? "border-[#075A3A] bg-[#E6F2EC] text-[#075A3A]"
                              : "border-[#DED5C5] text-[#514D46]"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                  </div>
                  {retentionType === "temporary" &&
                    retentionUnit === "years" && (
                    <label className="block text-sm font-bold text-[#514D46]">
                      Additional years
                      <div className="relative mt-1.5">
                        <CalendarClock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9B8F7C]" />
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={retentionYears}
                          onChange={(event) =>
                            setRetentionYears(event.target.value)
                          }
                          className="min-h-11 w-full rounded-xl border border-[#DED5C5] pl-10 pr-3 outline-none focus:border-[#075A3A]"
                        />
                      </div>
                    </label>
                  )}
                </>
              ) : (
                <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-800">
                  This marks the record as disposed and removes it
                  from this queue. Metadata and the audit trail are
                  retained; attached files are not physically deleted
                  by this action.
                </p>
              )}

              <label className="block text-sm font-bold text-[#514D46]">
                {actionMode === "dispose"
                  ? "Disposal notes (required)"
                  : "Review notes (optional)"}
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={
                    actionMode === "dispose"
                      ? "Reference the approved disposal authority, method, and date."
                      : "Reason for extending or making this record permanent."
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#DED5C5] p-3 text-sm outline-none focus:border-[#6B0F2B] focus:ring-2 focus:ring-[#6B0F2B]/10"
                />
              </label>
            </div>

            <footer className="flex justify-end gap-2 border-t border-[#E3DCCE] bg-[#F8F5EE] px-5 py-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => setSelected(null)}
                className="min-h-10 rounded-xl border border-[#D7CDBB] bg-white px-4 text-sm font-bold text-[#514D46]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={submitAction}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50 ${
                  actionMode === "restore"
                    ? "bg-[#075A3A]"
                    : "bg-[#6B0F2B]"
                }`}
              >
                {saving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {saving
                  ? "Saving..."
                  : actionMode === "restore"
                  ? "Return to Archive"
                  : "Mark Disposed"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function DisposalCard({
  record,
  onRestore,
  onDispose,
}: {
  record: DisposalRecord;
  onRestore: () => void;
  onDispose: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-xl border border-[#E3DCCE] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="h-1 bg-gradient-to-r from-[#6B0F2B] via-[#A43A55] to-[#D9961A]" />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FCECEE] text-[#6B0F2B]">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#9B2C49]">
              {record.record_code}
            </p>
            <h2 className="mt-0.5 line-clamp-2 text-sm font-extrabold leading-5 text-[#252A27]">
              {record.title}
            </h2>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-[#EEE8DD] py-3 text-xs">
          <CompactMeta
            label="Department"
            value={record.department?.name || "N/A"}
          />
          <CompactMeta
            label="Category"
            value={record.category?.name || "N/A"}
          />
          <CompactMeta
            label="Retention ended"
            value={formatDate(record.retention_expires_at)}
          />
          <CompactMeta
            label="Transferred"
            value={formatDate(record.for_disposal_at)}
          />
        </dl>
        <RecordActions
          onRestore={onRestore}
          onDispose={onDispose}
        />
      </div>
    </article>
  );
}

function DisposalListRow({
  record,
  onRestore,
  onDispose,
}: {
  record: DisposalRecord;
  onRestore: () => void;
  onDispose: () => void;
}) {
  return (
    <article className="grid gap-3 border-b border-[#EEE8DD] p-4 last:border-b-0 hover:bg-[#FCFAF6] lg:grid-cols-[minmax(250px,1.4fr)_170px_170px_130px_230px] lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FCECEE] text-[#6B0F2B]">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-extrabold text-[#252A27]">
            {record.title}
          </h2>
          <p className="mt-0.5 text-[11px] font-bold text-[#9B2C49]">
            {record.record_code}
          </p>
        </div>
      </div>
      <div className="text-xs text-[#625E56]">
        <p className="font-bold text-[#3F443F]">
          {record.category?.name || "N/A"}
        </p>
        <p className="mt-0.5 truncate">
          {record.department?.name || "N/A"}
        </p>
      </div>
      <div className="text-xs text-[#625E56]">
        <p>{formatDate(record.retention_expires_at)}</p>
        <p className="mt-0.5 text-[10px] text-[#9B8F7C]">
          Moved {formatDate(record.for_disposal_at)}
        </p>
      </div>
      <span className="text-xs font-bold text-[#514D46]">
        {record.files?.length || 0} attachment(s)
      </span>
      <RecordActions
        onRestore={onRestore}
        onDispose={onDispose}
        compact
      />
    </article>
  );
}

function RecordActions({
  onRestore,
  onDispose,
  compact = false,
}: {
  onRestore: () => void;
  onDispose: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-2 ${
        compact ? "" : "mt-4"
      }`}
    >
      <button
        type="button"
        onClick={onRestore}
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[#CFE0D6] bg-white px-2 text-[11px] font-bold text-[#075A3A] hover:bg-[#E6F2EC]"
      >
        <ArchiveRestore className="h-3.5 w-3.5" />
        Return
      </button>
      <button
        type="button"
        onClick={onDispose}
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#6B0F2B] px-2 text-[11px] font-bold text-white hover:bg-[#571023]"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Dispose
      </button>
    </div>
  );
}

function CompactMeta({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] font-extrabold uppercase tracking-wide text-[#9B8F7C]">
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-semibold text-[#514D46]">
        {value}
      </dd>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
