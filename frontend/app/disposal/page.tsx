"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
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
  disposed_at?: string | null;
  legal_hold?: boolean;
  legal_hold_reason?: string | null;
  latest_disposal_case?: DisposalCase | null;
};

type DisposalCase = {
  id: number;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled"
    | "completed";
  authority_reference: string;
  reason: string;
  disposal_method: string;
  notes?: string | null;
  rejection_reason?: string | null;
  certificate_number?: string | null;
  requested_at?: string | null;
  approved_at?: string | null;
  scheduled_purge_at?: string | null;
  completed_at?: string | null;
  requested_by?: number | null;
  requester?: { id: number; name: string } | null;
  approver?: { id: number; name: string } | null;
};

type ActionMode =
  | "restore"
  | "request"
  | "approve"
  | "reject"
  | "cancel"
  | "hold"
  | "release_hold"
  | "certificate";

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
  const [repositoryView, setRepositoryView] =
    useState<"queue" | "disposed">("queue");
  const [currentUserId, setCurrentUserId] =
    useState<number | null>(null);
  const [currentRole, setCurrentRole] = useState("");
  const [authorityReference, setAuthorityReference] =
    useState("");
  const [disposalReason, setDisposalReason] = useState("");
  const [disposalMethod, setDisposalMethod] =
    useState("secure_digital_deletion");
  const [confirmation, setConfirmation] = useState("");
  const [graceDays, setGraceDays] = useState(30);
  const [viewMode, changeView] = usePersistentViewMode(
    "disposal-record-view",
    "grid"
  );
  const [retentionUnit, setRetentionUnit] =
    useState<"years" | "minutes">("years");
  const searchRef = useRef("");
  const roleVerifiedRef = useRef(false);
  const syncingRef = useRef(false);
  const repositoryViewRef = useRef<"queue" | "disposed">("queue");

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

        setCurrentUserId(me.user?.id ?? null);
        setCurrentRole(role || "");
        roleVerifiedRef.current = true;
      }

      const params = new URLSearchParams();
      if (searchValue.trim()) {
        params.set("search", searchValue.trim());
      }

      const endpoint =
        repositoryViewRef.current === "disposed"
          ? "/disposal/disposed"
          : "/disposal/records";
      const data = await apiRequest(`${endpoint}?${params.toString()}`);
      setRecords(data.data || []);
      setGraceDays(data.grace_days || 30);
    } catch (err: unknown) {
      if (!silent) {
        setError(
          err instanceof Error
            ? err.message
          : "Failed to load the disposal repository."
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
    setAuthorityReference("");
    setDisposalReason("");
    setDisposalMethod("secure_digital_deletion");
    setConfirmation("");
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
    if (
      actionMode === "request" &&
      (!authorityReference.trim() || !disposalReason.trim())
    ) {
      setError(
        "Authority reference and disposal reason are required."
      );
      return;
    }
    if (actionMode === "approve" && confirmation !== selected.record_code) {
      setError("Type the exact record code to confirm approval.");
      return;
    }
    if (
      ["reject", "cancel", "hold"].includes(actionMode) &&
      !notes.trim()
    ) {
      setError("A reason is required for this action.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const disposalCase = selected.latest_disposal_case;
      let endpoint = "";
      let method = "POST";
      let body: Record<string, unknown> = {};

      if (actionMode === "restore") {
        endpoint = `/disposal/records/${selected.id}/restore`;
        body = {
              retention_type: retentionType,
              retention_years:
                retentionType === "temporary" ? years : null,
              retention_unit:
                retentionType === "temporary"
                  ? retentionUnit
                  : "years",
              notes: notes.trim() || null,
        };
      } else if (actionMode === "request") {
        endpoint = `/disposal/records/${selected.id}/request`;
        body = {
          authority_reference: authorityReference.trim(),
          reason: disposalReason.trim(),
          disposal_method: disposalMethod,
          notes: notes.trim() || null,
        };
      } else if (actionMode === "approve" && disposalCase) {
        endpoint = `/disposal/cases/${disposalCase.id}/approve`;
        body = { confirmation };
      } else if (actionMode === "reject" && disposalCase) {
        endpoint = `/disposal/cases/${disposalCase.id}/reject`;
        body = { rejection_reason: notes.trim() };
      } else if (actionMode === "cancel" && disposalCase) {
        endpoint = `/disposal/cases/${disposalCase.id}/cancel`;
        body = { reason: notes.trim() };
      } else if (
        actionMode === "hold" ||
        actionMode === "release_hold"
      ) {
        endpoint = `/disposal/records/${selected.id}/legal-hold`;
        method = "PATCH";
        body = {
          legal_hold: actionMode === "hold",
          reason: actionMode === "hold" ? notes.trim() : null,
        };
      }

      if (!endpoint) {
        throw new Error("This action is not available.");
      }

      const data = await apiRequest(endpoint, {
          method,
          body: JSON.stringify(body),
      });

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

  function changeRepositoryView(
    value: "queue" | "disposed"
  ) {
    setRepositoryView(value);
    repositoryViewRef.current = value;
    setSelected(null);
    setSuccess("");
    setError("");
    window.setTimeout(() => void loadRecords(searchRef.current), 0);
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
                Disposal Management
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#E5DDCC]">
                Controlled approval, legal hold, grace-period
                monitoring, and permanent attachment deletion.
              </p>
            </div>
          </div>
        </header>

        <div className="mt-4 flex w-fit rounded-xl border border-[#D7CDBB] bg-white p-1 shadow-sm">
          {(
            [
              ["queue", "For Disposal"],
              ["disposed", "Disposed Records"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => changeRepositoryView(value)}
              className={`rounded-lg px-4 py-2 text-xs font-extrabold transition ${
                repositoryView === value
                  ? "bg-[#6B0F2B] text-white shadow-sm"
                  : "text-[#625E56] hover:bg-[#F8F5EE]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

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
                placeholder={`Search ${
                  repositoryView === "disposed"
                    ? "disposed records"
                    : "records awaiting disposal"
                }`}
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
                {repositoryView === "disposed"
                  ? "No completed disposals"
                  : "No records awaiting disposal"}
              </h2>
              <p className="mt-1 text-sm text-[#766F63]">
                {repositoryView === "disposed"
                  ? "Approved disposals appear here after physical attachments are deleted."
                  : "Temporary records appear here automatically when their retention period ends."}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {records.map((record) => (
                <DisposalCard
                  key={record.id}
                  record={record}
                  repositoryView={repositoryView}
                  currentUserId={currentUserId}
                  currentRole={currentRole}
                  onAction={(mode) => openAction(record, mode)}
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
                  repositoryView={repositoryView}
                  currentUserId={currentUserId}
                  currentRole={currentRole}
                  onAction={(mode) => openAction(record, mode)}
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
                  {actionMode === "certificate" &&
                  selected.latest_disposal_case?.status !== "completed"
                    ? "Disposal Authorization"
                    : actionTitle(actionMode)}
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

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}
              {actionMode === "certificate" ? (
                <CertificateView record={selected} />
              ) : actionMode === "restore" ? (
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
              ) : actionMode === "request" ? (
                <>
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    Submitting creates a pending request. A different
                    authorized officer must approve it before the
                    {graceDays}-day grace period begins.
                  </p>
                  <label className="block text-sm font-bold text-[#514D46]">
                    Disposal authority / reference
                    <input
                      value={authorityReference}
                      onChange={(event) =>
                        setAuthorityReference(event.target.value)
                      }
                      placeholder="Example: Disposal Authority 2026-014"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-[#DED5C5] px-3 text-sm outline-none focus:border-[#6B0F2B]"
                    />
                  </label>
                  <label className="block text-sm font-bold text-[#514D46]">
                    Disposal method
                    <select
                      value={disposalMethod}
                      onChange={(event) =>
                        setDisposalMethod(event.target.value)
                      }
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-[#DED5C5] bg-white px-3 text-sm outline-none focus:border-[#6B0F2B]"
                    >
                      <option value="secure_digital_deletion">
                        Secure digital deletion
                      </option>
                      <option value="physical_shredding">
                        Physical shredding
                      </option>
                      <option value="certified_destruction">
                        Certified destruction
                      </option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="block text-sm font-bold text-[#514D46]">
                    Reason for disposal
                    <textarea
                      rows={3}
                      value={disposalReason}
                      onChange={(event) =>
                        setDisposalReason(event.target.value)
                      }
                      placeholder="Explain why this record is authorized for disposal."
                      className="mt-1.5 w-full rounded-xl border border-[#DED5C5] p-3 text-sm outline-none focus:border-[#6B0F2B]"
                    />
                  </label>
                  <label className="block text-sm font-bold text-[#514D46]">
                    Additional notes (optional)
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(event) =>
                        setNotes(event.target.value)
                      }
                      className="mt-1.5 w-full rounded-xl border border-[#DED5C5] p-3 text-sm outline-none focus:border-[#6B0F2B]"
                    />
                  </label>
                </>
              ) : actionMode === "approve" ? (
                <>
                  <CaseSummary record={selected} />
                  <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">
                    Approval starts a {graceDays}-day grace period. After it
                    ends, physical attachments are permanently deleted
                    while metadata and the certificate remain.
                  </p>
                  <label className="block text-sm font-bold text-[#514D46]">
                    Type <strong>{selected.record_code}</strong> to approve
                    <input
                      value={confirmation}
                      onChange={(event) =>
                        setConfirmation(event.target.value)
                      }
                      autoComplete="off"
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-red-200 px-3 font-mono text-sm outline-none focus:border-red-500"
                    />
                  </label>
                </>
              ) : (
                <>
                  <CaseSummary record={selected} />
                  <p className="rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] p-3 text-xs leading-5 text-[#625E56]">
                    {actionDescription(actionMode)}
                  </p>
                  {actionMode !== "release_hold" && (
                    <label className="block text-sm font-bold text-[#514D46]">
                      Reason
                      <textarea
                        rows={4}
                        value={notes}
                        onChange={(event) =>
                          setNotes(event.target.value)
                        }
                        className="mt-1.5 w-full rounded-xl border border-[#DED5C5] p-3 text-sm outline-none focus:border-[#6B0F2B]"
                      />
                    </label>
                  )}
                </>
              )}
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
              {actionMode === "certificate" ? (
                <button
                  type="button"
                  onClick={() => printCertificate(selected)}
                  className="min-h-10 rounded-xl bg-[#075A3A] px-4 text-sm font-bold text-white"
                >
                  Print Certificate
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={submitAction}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-white disabled:opacity-50 ${
                    ["restore", "approve", "release_hold"].includes(
                      actionMode
                    )
                      ? "bg-[#075A3A]"
                      : "bg-[#6B0F2B]"
                  }`}
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {saving ? "Saving..." : actionButtonLabel(actionMode)}
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function DisposalCard({
  record,
  repositoryView,
  currentUserId,
  currentRole,
  onAction,
}: {
  record: DisposalRecord;
  repositoryView: "queue" | "disposed";
  currentUserId: number | null;
  currentRole: string;
  onAction: (mode: ActionMode) => void;
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
          <DisposalStatusBadge record={record} />
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
            label={
              repositoryView === "disposed"
                ? "Disposed"
                : "Retention ended"
            }
            value={formatDate(
              repositoryView === "disposed"
                ? record.disposed_at
                : record.retention_expires_at
            )}
          />
          <CompactMeta
            label="Transferred"
            value={formatDate(record.for_disposal_at)}
          />
        </dl>
        <RecordActions
          record={record}
          repositoryView={repositoryView}
          currentUserId={currentUserId}
          currentRole={currentRole}
          onAction={onAction}
        />
      </div>
    </article>
  );
}

function DisposalListRow({
  record,
  repositoryView,
  currentUserId,
  currentRole,
  onAction,
}: {
  record: DisposalRecord;
  repositoryView: "queue" | "disposed";
  currentUserId: number | null;
  currentRole: string;
  onAction: (mode: ActionMode) => void;
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
        <p>
          {formatDate(
            repositoryView === "disposed"
              ? record.disposed_at
              : record.retention_expires_at
          )}
        </p>
        <p className="mt-0.5 text-[10px] text-[#9B8F7C]">
          {repositoryView === "disposed"
            ? record.latest_disposal_case?.certificate_number ||
              "Certificate retained"
            : `Moved ${formatDate(record.for_disposal_at)}`}
        </p>
      </div>
      <span className="text-xs font-bold text-[#514D46]">
        {record.files?.length || 0} attachment(s)
      </span>
      <RecordActions
        record={record}
        repositoryView={repositoryView}
        currentUserId={currentUserId}
        currentRole={currentRole}
        onAction={onAction}
        compact
      />
    </article>
  );
}

function RecordActions({
  record,
  repositoryView,
  currentUserId,
  currentRole,
  onAction,
  compact = false,
}: {
  record: DisposalRecord;
  repositoryView: "queue" | "disposed";
  currentUserId: number | null;
  currentRole: string;
  onAction: (mode: ActionMode) => void;
  compact?: boolean;
}) {
  const disposalCase = record.latest_disposal_case;
  const canCancel =
    disposalCase &&
    (disposalCase.requested_by === currentUserId ||
      currentRole === "Admin");

  let actions: Array<{
    mode: ActionMode;
    label: string;
    tone?: "primary" | "danger" | "neutral";
  }> = [];

  if (repositoryView === "disposed") {
    actions = [
      {
        mode: "certificate",
        label: "Certificate",
        tone: "primary",
      },
    ];
  } else if (record.legal_hold) {
    actions = [
      {
        mode: "release_hold",
        label: "Release Hold",
        tone: "primary",
      },
      ...(canCancel &&
      ["pending", "approved"].includes(disposalCase?.status || "")
        ? [
            {
              mode: "cancel" as ActionMode,
              label: "Cancel Request",
              tone: "neutral" as const,
            },
          ]
        : []),
    ];
  } else if (disposalCase?.status === "pending") {
    actions =
      disposalCase.requested_by === currentUserId
        ? [
            {
              mode: "cancel",
              label: "Cancel Request",
              tone: "neutral",
            },
            { mode: "hold", label: "Legal Hold", tone: "danger" },
          ]
        : [
            { mode: "approve", label: "Approve", tone: "primary" },
            { mode: "reject", label: "Reject", tone: "danger" },
            { mode: "hold", label: "Legal Hold", tone: "neutral" },
          ];
  } else if (disposalCase?.status === "approved") {
    actions = [
      { mode: "certificate", label: "Certificate", tone: "primary" },
      { mode: "hold", label: "Legal Hold", tone: "danger" },
      ...(canCancel
        ? [
            {
              mode: "cancel" as ActionMode,
              label: "Cancel",
              tone: "neutral" as const,
            },
          ]
        : []),
    ];
  } else {
    actions = [
      { mode: "restore", label: "Return", tone: "neutral" },
      { mode: "request", label: "Request Approval", tone: "primary" },
      { mode: "hold", label: "Legal Hold", tone: "danger" },
    ];
  }

  return (
    <div
      className={`grid grid-cols-2 gap-2 ${
        compact ? "" : "mt-4"
      }`}
    >
      {actions.map((action) => (
        <button
          key={action.mode}
          type="button"
          onClick={() => onAction(action.mode)}
          className={`inline-flex min-h-9 items-center justify-center rounded-lg px-2 text-[11px] font-bold transition ${
            action.tone === "primary"
              ? "bg-[#075A3A] text-white hover:bg-[#064D33]"
              : action.tone === "danger"
              ? "bg-[#6B0F2B] text-white hover:bg-[#571023]"
              : "border border-[#D7CDBB] bg-white text-[#514D46] hover:bg-[#F8F5EE]"
          }`}
        >
          {action.label}
        </button>
      ))}
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

function DisposalStatusBadge({
  record,
}: {
  record: DisposalRecord;
}) {
  if (record.legal_hold) {
    return (
      <span className="shrink-0 rounded-full bg-violet-50 px-2 py-1 text-[9px] font-extrabold uppercase text-violet-700 ring-1 ring-violet-200">
        Legal hold
      </span>
    );
  }

  const status = record.latest_disposal_case?.status;
  const label =
    status === "pending"
      ? "Pending approval"
      : status === "approved"
      ? "Grace period"
      : status === "completed"
      ? "Disposed"
      : "Awaiting request";

  return (
    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[9px] font-extrabold uppercase text-amber-800 ring-1 ring-amber-200">
      {label}
    </span>
  );
}

function CaseSummary({
  record,
}: {
  record: DisposalRecord;
}) {
  const item = record.latest_disposal_case;
  if (!item) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-[#E3DCCE] bg-[#FCFAF6] p-4 text-xs">
      <CompactMeta
        label="Requested by"
        value={item.requester?.name || "N/A"}
      />
      <CompactMeta
        label="Authority"
        value={item.authority_reference}
      />
      <CompactMeta
        label="Method"
        value={formatMethod(item.disposal_method)}
      />
      <CompactMeta
        label="Scheduled purge"
        value={formatDate(item.scheduled_purge_at)}
      />
      <div className="col-span-2">
        <dt className="text-[9px] font-extrabold uppercase tracking-wide text-[#9B8F7C]">
          Reason
        </dt>
        <dd className="mt-1 leading-5 text-[#514D46]">
          {item.reason}
        </dd>
      </div>
    </dl>
  );
}

function CertificateView({
  record,
}: {
  record: DisposalRecord;
}) {
  const item = record.latest_disposal_case;
  const completed = item?.status === "completed";

  return (
    <div className="rounded-xl border-2 border-[#075A3A] bg-[#FCFFFD] p-5 text-center">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#075A3A]">
        IRAM Records Management
      </p>
      <h3 className="mt-2 text-xl font-extrabold text-[#252A27]">
        {completed
          ? "Certificate of Disposal"
          : "Disposal Authorization"}
      </h3>
      <p className="mt-1 font-mono text-xs font-bold text-[#6B0F2B]">
        {item?.certificate_number || "Certificate pending"}
      </p>
      <div className="my-5 h-px bg-[#CFE0D6]" />
      <p className="text-sm font-extrabold text-[#252A27]">
        {record.title}
      </p>
      <p className="mt-1 text-xs font-bold text-[#6B0F2B]">
        {record.record_code}
      </p>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-left">
        <CompactMeta
          label="Authority"
          value={item?.authority_reference || "N/A"}
        />
        <CompactMeta
          label="Method"
          value={formatMethod(item?.disposal_method || "")}
        />
        <CompactMeta
          label="Requested by"
          value={item?.requester?.name || "N/A"}
        />
        <CompactMeta
          label="Approved by"
          value={item?.approver?.name || "N/A"}
        />
        <CompactMeta
          label="Approved"
          value={formatDate(item?.approved_at)}
        />
        <CompactMeta
          label="Completed"
          value={formatDate(item?.completed_at)}
        />
      </dl>
      <p className="mt-5 border-t border-[#CFE0D6] pt-4 text-xs leading-5 text-[#625E56]">
        {completed
          ? "Physical attachments were permanently deleted. Record metadata, file inventory, approval history, and this certificate remain preserved."
          : `Disposal is approved and scheduled for ${formatDate(
              item?.scheduled_purge_at
            )}. It may still be cancelled or placed on legal hold before that date.`}
      </p>
    </div>
  );
}

function actionTitle(mode: ActionMode) {
  return {
    restore: "Return to Archive",
    request: "Request Disposal Approval",
    approve: "Approve Disposal",
    reject: "Reject Disposal Request",
    cancel: "Cancel Disposal",
    hold: "Place Legal Hold",
    release_hold: "Release Legal Hold",
    certificate: "Disposal Certificate",
  }[mode];
}

function actionButtonLabel(mode: ActionMode) {
  return {
    restore: "Return to Archive",
    request: "Submit for Approval",
    approve: "Approve Disposal",
    reject: "Reject Request",
    cancel: "Cancel Disposal",
    hold: "Place Legal Hold",
    release_hold: "Release Hold",
    certificate: "Print Certificate",
  }[mode];
}

function actionDescription(mode: ActionMode) {
  const descriptions: Partial<Record<ActionMode, string>> = {
    reject:
      "Rejecting returns the record to the disposal queue. No files will be deleted.",
    cancel:
      "Cancellation immediately stops a pending request or approved scheduled deletion.",
    hold:
      "Legal hold blocks approval and permanent deletion until an authorized officer releases it.",
    release_hold:
      "Releasing the hold restarts a full grace period for any previously approved disposal.",
  };

  return descriptions[mode] || "";
}

function formatMethod(value: string) {
  return value
    ? value
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) => character.toUpperCase())
    : "N/A";
}

function printCertificate(record: DisposalRecord) {
  const item = record.latest_disposal_case;
  if (!item?.certificate_number) return;
  const completed = item.status === "completed";
  const documentTitle = completed
    ? "Certificate of Disposal"
    : "Disposal Authorization";

  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) return;

  printWindow.document.write(`<!doctype html>
    <html><head><title>${escapeHtml(item.certificate_number)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#1f2937;padding:48px}
      main{max-width:760px;margin:auto;border:3px solid #075A3A;padding:48px;text-align:center}
      .eyebrow{color:#075A3A;font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase}
      h1{margin:12px 0 4px;font-size:30px}.number{color:#6B0F2B;font-family:monospace;font-weight:700}
      hr{border:0;border-top:1px solid #CFE0D6;margin:28px 0}
      dl{display:grid;grid-template-columns:1fr 1fr;gap:18px;text-align:left;margin-top:28px}
      dt{font-size:10px;text-transform:uppercase;color:#6b7280;font-weight:700}dd{margin:5px 0 0;font-size:14px;font-weight:600}
      footer{margin-top:36px;padding-top:18px;border-top:1px solid #CFE0D6;font-size:11px;color:#6b7280}
    </style></head><body><main>
      <p class="eyebrow">IRAM Records Management</p>
      <h1>${escapeHtml(documentTitle)}</h1>
      <p class="number">${escapeHtml(item.certificate_number)}</p><hr>
      <h2>${escapeHtml(record.title)}</h2>
      <p>${escapeHtml(record.record_code)}</p>
      <dl>
        ${certificateField("Authority", item.authority_reference)}
        ${certificateField("Method", formatMethod(item.disposal_method))}
        ${certificateField("Requested by", item.requester?.name || "N/A")}
        ${certificateField("Approved by", item.approver?.name || "N/A")}
        ${certificateField("Approved", formatDate(item.approved_at))}
        ${certificateField("Completed", formatDate(item.completed_at))}
      </dl>
      <footer>${
        completed
          ? "Physical attachments were permanently deleted while record metadata, file inventory, approval history, and this certificate were retained."
          : `Approved disposal is scheduled for ${escapeHtml(
              formatDate(item.scheduled_purge_at)
            )}. It may be cancelled or placed on legal hold before that date.`
      }</footer>
    </main></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

function certificateField(label: string, value: string) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(
    value
  )}</dd></div>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
