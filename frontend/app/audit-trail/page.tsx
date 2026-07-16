"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileClock,
  FileText,
  Filter,
  FolderArchive,
  History,
  Loader2,
  Monitor,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

type UserSummary = {
  id: number;
  name: string;
  email?: string;
  role?: { name: string } | null;
};

type AuditLog = {
  id: number;
  action: string;
  description?: string | null;
  ip_address?: string | null;
  created_at: string;
  user?: UserSummary | null;
  target_user?: UserSummary | null;
  record?: {
    id: number;
    record_code: string;
    title: string;
    status: string;
  } | null;
};

type AuditResponse = {
  data: AuditLog[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number | null;
  to?: number | null;
  filters: {
    actions: string[];
    users: UserSummary[];
  };
  summary: {
    total: number;
    today: number;
    last_seven_days: number;
    active_users: number;
  };
};

const emptySummary = {
  total: 0,
  today: 0,
  last_seven_days: 0,
  active_users: 0,
};

export default function AuditTrailPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [range, setRange] = useState({ from: 0, to: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  async function loadLogs(targetPage = 1, overrides?: { reset?: boolean }) {
    setLoading(true);
    setError("");
    try {
      const meData = await apiRequest("/me");
      const role = meData.user?.role?.name;
      if (!["Admin", "Records Officer"].includes(role)) {
        router.replace("/dashboard");
        return;
      }

      const query = new URLSearchParams({
        page: String(targetPage),
        per_page: "20",
        sort: overrides?.reset ? "newest" : sort,
      });
      if (!overrides?.reset) {
        if (search.trim()) query.set("search", search.trim());
        if (action) query.set("action", action);
        if (userId) query.set("user_id", userId);
        if (dateFrom) query.set("date_from", dateFrom);
        if (dateTo) query.set("date_to", dateTo);
      }

      const data = (await apiRequest(`/audit-trail?${query.toString()}`)) as AuditResponse;
      setLogs(data.data || []);
      setActions(data.filters?.actions || []);
      setUsers(data.filters?.users || []);
      setSummary(data.summary || emptySummary);
      setPage(data.current_page || 1);
      setLastPage(data.last_page || 1);
      setTotal(data.total || 0);
      setRange({ from: data.from || 0, to: data.to || 0 });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load the audit trail.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLogs(1), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function resetFilters() {
    setSearch("");
    setAction("");
    setUserId("");
    setDateFrom("");
    setDateTo("");
    setSort("newest");
    void loadLogs(1, { reset: true });
  }

  const activeFilters = [search.trim(), action, userId, dateFrom, dateTo].filter(Boolean).length;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl pb-8">
        <header className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-5 py-5 text-white shadow-md">
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#F4C25E] ring-1 ring-white/15">
              <History className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F4C25E]">Accountability & Security</p>
              <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">Audit Trail</h1>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-[#E5DDCC] sm:text-sm">
                A read-only history of important record, archive, request, user, and system actions.
              </p>
            </div>
          </div>
        </header>

        <section className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <SummaryCard label="All Events" value={summary.total} icon={<FileClock className="h-5 w-5" />} tone="green" />
          <SummaryCard label="Today" value={summary.today} icon={<Clock3 className="h-5 w-5" />} tone="gold" />
          <SummaryCard label="Last 7 Days" value={summary.last_seven_days} icon={<Activity className="h-5 w-5" />} tone="maroon" />
          <SummaryCard label="Active Actors" value={summary.active_users} icon={<Users className="h-5 w-5" />} tone="blue" />
        </section>

        {error && <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

        <section className="mt-3 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[#DED5C5]">
          <div className="border-b border-[#E3DCCE] bg-[#FCFAF5] p-3">
            <form onSubmit={(event) => { event.preventDefault(); void loadLogs(1); }} className="grid gap-2.5 lg:grid-cols-[minmax(220px,1.5fr)_minmax(170px,1fr)_minmax(160px,1fr)_150px_150px_auto]">
              <label className="relative min-w-0">
                <span className="sr-only">Search audit trail</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#766F63]" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search actor, record, action, IP..." className="min-h-10 w-full rounded-lg border border-[#CFC4B1] bg-white py-2 pl-10 pr-3 text-sm font-medium text-[#252A27] outline-none placeholder:font-normal placeholder:text-[#766F63] focus:border-[#075A3A] focus:ring-4 focus:ring-[#E6F2EC]" />
              </label>
              <FilterSelect label="Action" value={action} onChange={setAction}>
                <option value="">All actions</option>
                {actions.map((item) => <option key={item} value={item}>{actionLabel(item)}</option>)}
              </FilterSelect>
              <FilterSelect label="Actor" value={userId} onChange={setUserId}>
                <option value="">All actors</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </FilterSelect>
              <label className="relative"><span className="sr-only">From date</span><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#766F63]" /><input type="date" title="From date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="min-h-10 w-full rounded-lg border border-[#CFC4B1] bg-white py-2 pl-9 pr-2 text-xs font-medium text-[#252A27] outline-none focus:border-[#075A3A]" /></label>
              <label className="relative"><span className="sr-only">To date</span><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#766F63]" /><input type="date" title="To date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="min-h-10 w-full rounded-lg border border-[#CFC4B1] bg-white py-2 pl-9 pr-2 text-xs font-medium text-[#252A27] outline-none focus:border-[#075A3A]" /></label>
              <button type="submit" disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#075A3A] px-4 text-xs font-bold text-white hover:bg-[#043D28] disabled:opacity-60">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Apply</button>
            </form>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#766F63]"><Filter className="mr-1 inline h-3.5 w-3.5" />{activeFilters ? `${activeFilters} active filter${activeFilters === 1 ? "" : "s"}` : "Showing all logged events"}</p>
              <div className="flex items-center gap-2">
                <select aria-label="Sort audit events" value={sort} onChange={(event) => { setSort(event.target.value); }} className="min-h-8 rounded-lg border border-[#CFC4B1] bg-white px-2 text-xs font-semibold text-[#514D46] outline-none">
                  <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
                </select>
                <button type="button" onClick={resetFilters} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#CFC4B1] bg-white px-3 text-xs font-semibold text-[#514D46] hover:bg-[#F8F5EE]"><RotateCcw className="h-3.5 w-3.5" />Reset</button>
              </div>
            </div>
          </div>

          <div className="p-3">
            {loading ? <LoadingState /> : logs.length === 0 ? <EmptyState filtered={activeFilters > 0} /> : (
              <>
                <div className="hidden overflow-x-auto rounded-lg border border-[#E3DCCE] md:block">
                  <table className="w-full min-w-[850px] table-fixed border-collapse">
                    <thead><tr className="bg-[#F8F5EE] text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#766F63]"><th className="w-[19%] px-3 py-2.5">Date & Time</th><th className="w-[20%] px-3 py-2.5">Actor</th><th className="w-[20%] px-3 py-2.5">Action</th><th className="w-[33%] px-3 py-2.5">Event</th><th className="w-[8%] px-3 py-2.5 text-center">Details</th></tr></thead>
                    <tbody>{logs.map((log) => <AuditRow key={log.id} log={log} onOpen={() => setSelectedLog(log)} />)}</tbody>
                  </table>
                </div>
                <div className="space-y-2 md:hidden">{logs.map((log) => <AuditCard key={log.id} log={log} onOpen={() => setSelectedLog(log)} />)}</div>
              </>
            )}
          </div>

          {!loading && total > 0 && <div className="flex flex-col gap-3 border-t border-[#E3DCCE] bg-[#FCFAF5] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[#766F63]">Showing <strong className="text-[#252A27]">{range.from}–{range.to}</strong> of <strong className="text-[#252A27]">{total}</strong> matching events</p><div className="flex items-center gap-2"><button type="button" onClick={() => void loadLogs(page - 1)} disabled={page <= 1 || loading} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#CFC4B1] bg-white px-3 text-xs font-semibold text-[#514D46] disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Previous</button><span className="min-w-20 text-center text-xs font-semibold text-[#514D46]">Page {page} of {lastPage}</span><button type="button" onClick={() => void loadLogs(page + 1)} disabled={page >= lastPage || loading} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#CFC4B1] bg-white px-3 text-xs font-semibold text-[#514D46] disabled:opacity-40">Next<ChevronRight className="h-4 w-4" /></button></div></div>}
        </section>
      </div>

      {selectedLog && <AuditDetail log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </AppShell>
  );
}

function SummaryCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: "green" | "gold" | "maroon" | "blue" }) {
  const styles = { green: "bg-[#E6F2EC] text-[#075A3A]", gold: "bg-[#FFF3D6] text-[#A66B00]", maroon: "bg-[#F8E9EE] text-[#6B0F2B]", blue: "bg-blue-50 text-blue-700" }[tone];
  return <article className="flex min-h-20 items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-[#DED5C5]"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles}`}>{icon}</div><div className="min-w-0"><p className="truncate text-[11px] font-semibold text-[#766F63]">{label}</p><p className="mt-0.5 text-xl font-extrabold text-[#252A27]">{value.toLocaleString()}</p></div></article>;
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-10 w-full rounded-lg border border-[#CFC4B1] bg-white px-3 text-xs font-medium text-[#252A27] outline-none focus:border-[#075A3A] focus:ring-4 focus:ring-[#E6F2EC]">{children}</select></label>;
}

function AuditRow({ log, onOpen }: { log: AuditLog; onOpen: () => void }) {
  const style = eventStyle(log.action);
  const Icon = style.icon;
  return <tr className="border-t border-[#EEE8DD] text-sm hover:bg-[#FCFAF5]"><td className="px-3 py-3"><p className="font-semibold text-[#252A27]">{formatDate(log.created_at)}</p><p className="mt-0.5 text-[11px] text-[#766F63]">{formatTime(log.created_at)}</p></td><td className="px-3 py-3"><p className="truncate font-semibold text-[#252A27]">{log.user?.name || "System"}</p><p className="truncate text-[11px] text-[#766F63]">{log.user?.role?.name || log.user?.email || "Automated event"}</p></td><td className="px-3 py-3"><span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${style.badge}`}><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{actionLabel(log.action)}</span></span></td><td className="px-3 py-3"><p className="line-clamp-2 text-xs leading-5 text-[#514D46]">{log.description || "No event description was recorded."}</p>{log.record && <p className="mt-1 truncate text-[11px] font-semibold text-[#075A3A]">{log.record.record_code} · {log.record.title}</p>}</td><td className="px-3 py-3 text-center"><button type="button" onClick={onOpen} aria-label="View event details" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D7CDBB] bg-white text-[#6B0F2B] hover:border-[#6B0F2B] hover:bg-[#F8E9EE]"><ChevronRight className="h-4 w-4" /></button></td></tr>;
}

function AuditCard({ log, onOpen }: { log: AuditLog; onOpen: () => void }) {
  const style = eventStyle(log.action); const Icon = style.icon;
  return <button type="button" onClick={onOpen} className="w-full rounded-xl border border-[#E3DCCE] bg-white p-3 text-left hover:border-[#B9D5C5] hover:shadow-sm"><div className="flex items-start justify-between gap-3"><span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${style.badge}`}><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{actionLabel(log.action)}</span></span><span className="shrink-0 text-[10px] text-[#766F63]">{formatDate(log.created_at)}</span></div><p className="mt-3 line-clamp-2 text-xs leading-5 text-[#514D46]">{log.description || "No event description was recorded."}</p><div className="mt-3 flex items-center justify-between border-t border-[#EEE8DD] pt-2"><span className="truncate text-xs font-semibold text-[#252A27]">{log.user?.name || "System"}</span><ChevronRight className="h-4 w-4 text-[#6B0F2B]" /></div></button>;
}

function AuditDetail({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const style = eventStyle(log.action); const Icon = style.icon;
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#17231E]/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div className="flex items-start gap-3"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${style.badge}`}><Icon className="h-5 w-5" /></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-[#D9961A]">Audit Event #{log.id}</p><h2 id="audit-detail-title" className="mt-1 text-lg font-bold text-[#252A27]">{actionLabel(log.action)}</h2></div></div><button type="button" onClick={onClose} aria-label="Close details" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#514D46] hover:bg-[#F0ECE4]"><X className="h-5 w-5" /></button></div><p className="mt-5 rounded-xl bg-[#F8F5EE] p-4 text-sm leading-6 text-[#3F4541] ring-1 ring-[#E3DCCE]">{log.description || "No event description was recorded."}</p><dl className="mt-5 divide-y divide-[#EEE8DD] rounded-xl border border-[#E3DCCE] px-4"><DetailRow icon={<Clock3 className="h-4 w-4" />} label="Date and time" value={formatDateTime(log.created_at)} /><DetailRow icon={<UserRound className="h-4 w-4" />} label="Performed by" value={log.user ? `${log.user.name}${log.user.role?.name ? ` (${log.user.role.name})` : ""}` : "System / deleted user"} /><DetailRow icon={<Monitor className="h-4 w-4" />} label="IP address" value={log.ip_address || "Not recorded"} /><DetailRow icon={<ShieldCheck className="h-4 w-4" />} label="Action key" value={log.action} mono />{log.target_user && <DetailRow icon={<Users className="h-4 w-4" />} label="Affected user" value={`${log.target_user.name} (${log.target_user.email || "no email"})`} />}</dl>{log.record && <div className="mt-4 rounded-xl border border-[#CFE0D6] bg-[#F0F7F3] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#075A3A]">Related Record</p><p className="mt-2 font-bold text-[#252A27]">{log.record.title}</p><p className="mt-1 text-xs text-[#514D46]">{log.record.record_code} · {statusLabel(log.record.status)}</p><Link href={`/records?search=${encodeURIComponent(log.record.record_code)}`} onClick={onClose} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#075A3A] hover:underline"><FileText className="h-4 w-4" />Find this record</Link></div>}<div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className="rounded-lg bg-[#6B0F2B] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#571023]">Close</button></div></section></div>;
}

function DetailRow({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) { return <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 py-3 text-sm"><dt className="flex items-center gap-2 font-semibold text-[#766F63]">{icon}{label}</dt><dd className={`break-words text-right font-semibold text-[#252A27] ${mono ? "font-mono text-xs" : ""}`}>{value}</dd></div>; }

function eventStyle(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes("authenticated_session") || normalized.includes("registered")) return { icon: ShieldCheck, badge: "bg-cyan-50 text-cyan-800 ring-cyan-200" };
  if (normalized.includes("archive_folder") || normalized.includes("archived_record") || normalized.includes("archive_staff")) return { icon: FolderArchive, badge: "bg-amber-50 text-amber-800 ring-amber-200" };
  if (normalized.includes("user") || normalized.includes("password")) return { icon: Users, badge: "bg-violet-50 text-violet-700 ring-violet-200" };
  if (normalized.includes("settings") || normalized.includes("development")) return { icon: Settings, badge: "bg-slate-100 text-slate-700 ring-slate-200" };
  if (normalized.includes("request")) return { icon: FileClock, badge: "bg-blue-50 text-blue-700 ring-blue-200" };
  return { icon: FileText, badge: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
}

function actionLabel(action: string) { return action.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function statusLabel(status: string) { return actionLabel(status); }
function parseDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date; }
function formatDate(value: string) { const date = parseDate(value); return date ? date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : value; }
function formatTime(value: string) { const date = parseDate(value); return date ? date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : ""; }
function formatDateTime(value: string) { const date = parseDate(value); return date ? date.toLocaleString("en-PH", { dateStyle: "long", timeStyle: "medium" }) : value; }
function LoadingState() { return <div className="flex min-h-64 flex-col items-center justify-center rounded-xl bg-[#F8F5EE]"><Loader2 className="h-7 w-7 animate-spin text-[#075A3A]" /><p className="mt-3 text-sm font-medium text-[#766F63]">Loading accountability records...</p></div>; }
function EmptyState({ filtered }: { filtered: boolean }) { return <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#D7CDBB] bg-[#F8F5EE] px-5 text-center"><History className="h-9 w-9 text-[#A09582]" /><h2 className="mt-3 font-bold text-[#252A27]">{filtered ? "No matching audit events" : "No audit events yet"}</h2><p className="mt-1 max-w-md text-sm text-[#766F63]">{filtered ? "Try changing or clearing your filters." : "Important system activity will appear here automatically."}</p></div>; }
