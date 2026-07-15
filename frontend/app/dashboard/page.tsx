"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Files,
  ShieldCheck,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

type RecordItem = {
  id: number;
  record_code: string;
  title: string;
  status: string;
  date_received?: string | null;
  category?: {
    name?: string | null;
  } | null;
  department?: {
    name?: string | null;
  } | null;
};

type DashboardCounts = {
  total: number;
  received: number;
  underReview: number;
  archived: number;
};

type RequestCounts = {
  total: number;
  pending: number;
  underReview: number;
};

const initialCounts: DashboardCounts = {
  total: 0,
  received: 0,
  underReview: 0,
  archived: 0,
};

const initialRequestCounts: RequestCounts = {
  total: 0,
  pending: 0,
  underReview: 0,
};

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [recentRecords, setRecentRecords] = useState<RecordItem[]>([]);
  const [counts, setCounts] =
    useState<DashboardCounts>(initialCounts);
  const [requestCounts, setRequestCounts] =
    useState<RequestCounts>(initialRequestCounts);
  const [loading, setLoading] = useState(true);
  const [silentRefreshing, setSilentRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState("");

  const userRef = useRef<AuthUser | null>(null);
  const refreshRunningRef = useRef(false);

  const roleName = user?.role?.name || "";
  const isStaff = roleName === "Staff";

  const canManageRecords =
    roleName === "Admin" || roleName === "Records Officer";

  const recentTitle = isStaff
    ? "Recent Submissions"
    : "Recent Record Activity";

  const recentDescription = isStaff
    ? "Your five most recent record submissions."
    : "The five most recently added records in the system.";

  const workflowMessage = useMemo(() => {
    if (isStaff) {
      if (counts.received > 0) {
        return `${counts.received} submission${
          counts.received === 1 ? "" : "s"
        } waiting for Records Office review.`;
      }

      return "You have no submissions waiting for review.";
    }

    if (counts.received > 0) {
      return `${counts.received} record${
        counts.received === 1 ? "" : "s"
      } waiting to begin review.`;
    }

    if (counts.underReview > 0) {
      return `${counts.underReview} record${
        counts.underReview === 1 ? "" : "s"
      } currently under review.`;
    }

    return "There are no pending review actions.";
  }, [counts.received, counts.underReview, isStaff]);

  async function loadDashboard(silent = false) {
    if (refreshRunningRef.current) return;

    refreshRunningRef.current = true;

    if (silent) {
      setSilentRefreshing(true);
    } else {
      setLoading(true);
      setLoadError("");
    }

    try {
      let currentUser = userRef.current;

      if (!currentUser) {
        const meData = await apiRequest("/me");
        currentUser = meData.user;

        userRef.current = currentUser;
        setUser(currentUser);

        localStorage.setItem(
          "iram_user",
          JSON.stringify(currentUser)
        );
      }

      const recordRequests = [
        apiRequest("/records"),
        apiRequest("/records?status=received"),
        apiRequest("/records?status=under_review"),
        apiRequest("/records?status=archived"),
      ];

      const requestRequests = [
        apiRequest("/document-requests"),
        apiRequest("/document-requests?status=pending"),
        apiRequest("/document-requests?status=under_review"),
      ];

      const [
        recordResults,
        requestResults,
      ] = await Promise.all([
        Promise.all(recordRequests),
        Promise.all(requestRequests),
      ]);

      const [
        recentData,
        receivedData,
        underReviewData,
        archivedData,
      ] = recordResults;

      const [
        allRequestsData,
        pendingRequestsData,
        underReviewRequestsData,
      ] = requestResults;

      setRecentRecords((recentData.data || []).slice(0, 5));

      setCounts({
        total: getPaginationTotal(recentData),
        received: getPaginationTotal(receivedData),
        underReview: getPaginationTotal(underReviewData),
        archived: getPaginationTotal(archivedData),
      });

      setRequestCounts({
        total: getPaginationTotal(allRequestsData),
        pending: getPaginationTotal(pendingRequestsData),
        underReview: getPaginationTotal(
          underReviewRequestsData
        ),
      });

      setLastUpdatedAt(new Date());

      if (silent) {
        setLoadError("");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "";

      if (message === "Unauthenticated.") {
        localStorage.removeItem("iram_token");
        localStorage.removeItem("iram_user");
        router.replace("/login");
        return;
      }

      if (!silent) {
        setLoadError(
          message ||
            "Failed to load dashboard information."
        );
      }
    } finally {
      refreshRunningRef.current = false;

      if (silent) {
        setSilentRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDashboard(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [router]);

  useEffect(() => {
    function refreshDashboard() {
      if (
        document.visibilityState !== "visible" ||
        refreshRunningRef.current
      ) {
        return;
      }

      void loadDashboard(true);
    }

    const intervalId = window.setInterval(
      refreshDashboard,
      5000
    );

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshDashboard();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );
    window.addEventListener("focus", refreshDashboard);
    window.addEventListener(
      "iram:records-changed",
      refreshDashboard
    );
    window.addEventListener(
      "iram:document-requests-changed",
      refreshDashboard
    );

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("focus", refreshDashboard);
      window.removeEventListener(
        "iram:records-changed",
        refreshDashboard
      );
      window.removeEventListener(
        "iram:document-requests-changed",
        refreshDashboard
      );
    };
  }, []);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl">
        <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-3.5 py-3 text-white shadow-md shadow-[#075A3A]/10 sm:px-4">
          <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <div className="absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-[#6B0F2B]/30 blur-3xl" />
          <div className="absolute right-5 top-5 h-16 w-16 rounded-full border border-white/10" />

          <div className="relative flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D9961A] text-white shadow-sm shadow-black/10 ring-1 ring-white/20 sm:flex">
                <ShieldCheck className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#F4C25E]">
                  {isStaff
                    ? "Submission Overview"
                    : "Records Management Overview"}
                </p>

                <h1 className="mt-0.5 break-words text-lg font-extrabold tracking-tight sm:text-xl">
                  Welcome, {user?.name || "IRAM User"}
                </h1>

                <p className="mt-0.5 max-w-2xl text-[11px] leading-4 text-[#E5DDCC] sm:text-xs">
                  {isStaff
                    ? "Track your submissions and monitor their progress through review and archiving."
                    : "Monitor incoming submissions, active reviews, archived records, and document requests from one place."}
                </p>

                <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-medium text-[#D9E8E0]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      silentRefreshing
                        ? "animate-pulse bg-[#F4C25E]"
                        : "bg-emerald-300"
                    }`}
                  />
                  <span>
                    {silentRefreshing
                      ? "Updating dashboard..."
                      : lastUpdatedAt
                        ? `Auto-refresh active · ${lastUpdatedAt.toLocaleTimeString(
                            "en-PH",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                            }
                          )}`
                        : "Auto-refresh active"}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </section>

        {loadError && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 shadow-sm"
          >
            {loadError}
          </div>
        )}

        <section className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
          <StatCard
            title={isStaff ? "My Records" : "Total Records"}
            value={counts.total}
            description={
              isStaff
                ? "Records visible to your account"
                : "All records in the system"
            }
            loading={loading}
            variant="green"
          />

          <StatCard
            title={isStaff ? "Submitted" : "Received"}
            value={counts.received}
            description={
              isStaff
                ? "Waiting for initial review"
                : "Waiting for review"
            }
            loading={loading}
            href="/records?status=received"
            variant="gold"
          />

          <StatCard
            title="Under Review"
            value={counts.underReview}
            description="Currently being evaluated"
            loading={loading}
            href="/records?status=under_review"
            variant="maroon"
          />

          <StatCard
            title="Archived"
            value={counts.archived}
            description="Officially archived records"
            loading={loading}
            href="/records?status=archived"
            variant="green"
          />
        </section>

        <section className="mt-3">
            <div className="grid grid-cols-3 gap-2">
              <RequestStatCard
                title={isStaff ? "My Requests" : "Total Requests"}
                value={requestCounts.total}
                description={
                  isStaff
                    ? "All requests you submitted"
                    : "All document requests"
                }
                loading={loading}
                href="/document-requests"
                variant="green"
              />

              <RequestStatCard
                title="Pending Requests"
                value={requestCounts.pending}
                description={
                  isStaff
                    ? "Waiting for Records Office review"
                    : "Waiting for review"
                }
                loading={loading}
                href="/document-requests?status=pending"
                variant="gold"
              />

              <RequestStatCard
                title="Under Review"
                value={requestCounts.underReview}
                description="Currently being processed"
                loading={loading}
                href="/document-requests?status=under_review"
                variant="maroon"
              />
            </div>
          </section>

        <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.8fr)]">
          <div className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DED5C5]">
            <div className="flex flex-col gap-3 border-b border-[#E8E0D4] bg-[#FCFAF5] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#A09582]">
                  Latest Activity
                </p>

                <h2 className="mt-1 text-lg font-extrabold text-[#2D332F]">
                  {recentTitle}
                </h2>

                <p className="mt-1 text-sm text-[#766F63]">
                  {recentDescription}
                </p>
              </div>

              <Link
                href="/records"
                className="inline-flex items-center gap-1 text-sm font-bold text-[#075A3A] transition hover:text-[#043D28]"
              >
                View all records
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="p-4 sm:p-5">
              {loading ? (
                <RecentRecordsSkeleton />
              ) : recentRecords.length === 0 ? (
                <EmptyRecentRecords isStaff={isStaff} />
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {recentRecords.map((record) => (
                      <RecentRecordCard
                        key={record.id}
                        record={record}
                        isStaff={isStaff}
                      />
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto rounded-xl border border-[#E3DCCE] md:block">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-[#F7F3EA] text-xs uppercase tracking-wide text-[#817766]">
                        <tr>
                          <th className="px-4 py-3">Record</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3">
                            {isStaff ? "Submitted" : "Received"}
                          </th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#ECE5D8] bg-white">
                        {recentRecords.map((record) => (
                          <tr
                            key={record.id}
                            className="transition hover:bg-[#FCFAF5]"
                          >
                            <td className="px-4 py-4">
                              <Link
                                href={`/records/${record.id}`}
                                className="font-bold text-[#2D332F] transition hover:text-[#6B0F2B]"
                              >
                                {record.title}
                              </Link>

                              <p className="mt-1 text-xs text-[#8D8476]">
                                {record.record_code}
                              </p>
                            </td>

                            <td className="px-4 py-4 text-[#625E56]">
                              {record.category?.name || "N/A"}
                            </td>

                            <td className="px-4 py-4 text-[#625E56]">
                              {record.department?.name || "N/A"}
                            </td>

                            <td className="px-4 py-4 text-[#625E56]">
                              {formatDate(record.date_received)}
                            </td>

                            <td className="px-4 py-4">
                              <StatusBadge
                                status={record.status}
                                isStaff={isStaff}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          <aside className="space-y-5">
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6B0F2B] to-[#4B0B1E] p-5 text-white shadow-lg shadow-[#6B0F2B]/15">
              <div className="absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[#D9961A]/15" />
              <div className="absolute -bottom-12 left-8 h-28 w-28 rounded-full bg-white/5" />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#F4C25E]">
                    Current Workflow
                  </p>

                  <h2 className="mt-2 text-xl font-extrabold">
                    {isStaff
                      ? "Submission Progress"
                      : "Review Queue"}
                  </h2>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                  {isStaff ? (
                    <Archive className="h-5 w-5 text-[#F4C25E]" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-[#F4C25E]" />
                  )}
                </div>
              </div>

              <p className="relative mt-4 text-sm leading-6 text-[#E9D7DE]">
                {workflowMessage}
              </p>

              <div className="relative mt-5 grid grid-cols-2 gap-3">
                <MiniStat
                  label={isStaff ? "Submitted" : "Received"}
                  value={counts.received}
                />

                <MiniStat
                  label="Under Review"
                  value={counts.underReview}
                />
              </div>

              <Link
                href={
                  counts.received > 0
                    ? "/records?status=received"
                    : "/records"
                }
                className="relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#D9961A] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#C58616]"
              >
                {isStaff
                  ? "View My Submissions"
                  : counts.received > 0
                    ? "Open Review Queue"
                    : "View All Records"}

                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DED5C5]">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#A09582]">
                Shortcuts
              </p>

              <h2 className="mt-1 text-lg font-extrabold text-[#2D332F]">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm leading-6 text-[#766F63]">
                Common tasks based on your account role.
              </p>

              <div className="mt-4 grid gap-3">
                <QuickAction
                  href="/records"
                  title={
                    isStaff
                      ? "Track submissions"
                      : "Browse all records"
                  }
                  description={
                    isStaff
                      ? "Review the status of records you submitted."
                      : "Search, filter, and review archive records."
                  }
                />

                <QuickAction
                  href="/records/create"
                  title={
                    isStaff
                      ? "Submit a record"
                      : "Add a record"
                  }
                  description={
                    isStaff
                      ? "Send a new document to the Records Office."
                      : "Create a new archive record."
                  }
                />

                {canManageRecords && (
                  <QuickAction
                    href="/document-requests"
                    title="Manage document requests"
                    description="Review pending archive document requests."
                  />
                )}

                {roleName === "Admin" && (
                  <QuickAction
                    href="/admin/users"
                    title="Manage users"
                    description="Assign roles, departments, and account access."
                  />
                )}

                {canManageRecords && (
                  <QuickAction
                    href="/records?status=under_review"
                    title="Continue reviews"
                    description="Open records currently under evaluation."
                  />
                )}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({
  title,
  value,
  description,
  loading,
  href,
  variant = "green",
}: {
  title: string;
  value: number;
  description: string;
  loading: boolean;
  href?: string;
  variant?: "green" | "gold" | "maroon";
}) {
  const styles = getCardVariant(variant);

  const content = (
    <div
      className={`group relative h-full min-h-[86px] overflow-hidden rounded-xl bg-white p-3 shadow-sm ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${styles.ring}`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-1 ${styles.topBar}`}
      />

      <div
        className={`absolute -right-5 -top-5 h-12 w-12 rounded-full ${styles.decorative}`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold leading-4 text-[#6E685E]">
          {title}
        </p>

        <div
          className={`hidden h-7 w-7 items-center justify-center rounded-lg shadow-sm transition-transform duration-200 group-hover:scale-105 sm:flex ${styles.icon}`}
        >
          <Files className="h-4 w-4" />
        </div>
      </div>

      {loading ? (
        <div className="mt-3 h-7 w-16 animate-pulse rounded-lg bg-[#E8E1D5]" />
      ) : (
        <h2 className="relative mt-0.5 text-xl font-extrabold tracking-tight text-[#252A27]">
          {value}
        </h2>
      )}

      <p className="relative mt-0.5 hidden text-[10px] font-medium leading-4 text-[#8A8173] sm:block">
        {description}
      </p>
    </div>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

function RequestStatCard({
  title,
  value,
  description,
  loading,
  href,
  variant,
}: {
  title: string;
  value: number;
  description: string;
  loading: boolean;
  href: string;
  variant: "green" | "gold" | "maroon";
}) {
  const styles = getRequestVariant(variant);

  return (
    <Link href={href} className="block">
      <div
        className={`group h-full min-h-[82px] rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${styles.container}`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold leading-4 text-[#5F5A52]">
            {title}
          </p>

          <div
            className={`hidden h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm ring-1 sm:flex ${styles.icon}`}
          >
            <Files className="h-4 w-4" />
          </div>
        </div>

        {loading ? (
          <div className="mt-3 h-7 w-16 animate-pulse rounded-lg bg-[#E8E1D5]" />
        ) : (
          <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-[#252A27]">
            {value}
          </h2>
        )}

        <p className="mt-0.5 hidden text-[10px] font-medium leading-4 text-[#81796D] sm:block">
          {description}
        </p>
      </div>
    </Link>
  );
}

function RecentRecordCard({
  record,
  isStaff,
}: {
  record: RecordItem;
  isStaff: boolean;
}) {
  return (
    <Link
      href={`/records/${record.id}`}
      className="block rounded-xl border border-[#E3DCCE] bg-white p-4 shadow-sm transition active:bg-[#FCFAF5]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-[#2D332F]">
            {record.title}
          </p>

          <p className="mt-1 text-xs text-[#8D8476]">
            {record.record_code}
          </p>
        </div>

        <StatusBadge
          status={record.status}
          isStaff={isStaff}
        />
      </div>

      <div className="mt-4 grid gap-2 text-xs text-[#766F63]">
        <InfoLine
          label="Category"
          value={record.category?.name || "N/A"}
        />

        <InfoLine
          label="Department"
          value={record.department?.name || "N/A"}
        />

        <InfoLine
          label={isStaff ? "Submitted" : "Received"}
          value={formatDate(record.date_received)}
        />
      </div>
    </Link>
  );
}

function RecentRecordsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-xl border border-[#E3DCCE] p-4"
        >
          <div className="h-4 w-2/5 rounded bg-[#DED7CA]" />
          <div className="mt-3 h-3 w-1/4 rounded bg-[#F0EBE2]" />
        </div>
      ))}
    </div>
  );
}

function EmptyRecentRecords({
  isStaff,
}: {
  isStaff: boolean;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-[#D7CDBB] bg-[#FCFAF5] px-5 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#075A3A] shadow-sm ring-1 ring-[#DED5C5]">
        <Files className="h-5 w-5" />
      </div>

      <h3 className="mt-4 font-extrabold text-[#2D332F]">
        No records yet
      </h3>

      <p className="mt-1 max-w-sm text-sm leading-6 text-[#766F63]">
        {isStaff
          ? "Your submitted records will appear here."
          : "Newly added records will appear here."}
      </p>

      <Link
        href="/records/create"
        className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#6B0F2B] hover:text-[#4B0B1E]"
      >
        {isStaff
          ? "Create your first submission"
          : "Add the first record"}

        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/10">
      <p className="text-xs font-medium text-[#E9D7DE]">
        {label}
      </p>

      <p className="mt-2 text-2xl font-extrabold text-white">
        {value}
      </p>
    </div>
  );
}

function QuickAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-[#E3DCCE] px-3.5 py-3 transition hover:border-[#D7B96B] hover:bg-[#FFF9EA]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[#2D332F] transition group-hover:text-[#6B0F2B]">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-[#766F63]">
          {description}
        </p>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-[#A09582] transition group-hover:translate-x-0.5 group-hover:text-[#D9961A]" />
    </Link>
  );
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#A09582]">{label}</span>

      <span className="truncate font-semibold text-[#514D46]">
        {value}
      </span>
    </div>
  );
}

function StatusBadge({
  status,
  isStaff = false,
}: {
  status: string;
  isStaff?: boolean;
}) {
  const label =
    status === "received" && isStaff
      ? "Submitted"
      : status?.replaceAll("_", " ") || "Unknown";

  let classes = "bg-[#F0ECE4] text-[#625E56]";

  if (status === "received") {
    classes =
      "bg-[#E6F2EC] text-[#075A3A] ring-1 ring-[#C9E1D4]";
  } else if (status === "under_review") {
    classes =
      "bg-[#FFF3D6] text-[#A66B00] ring-1 ring-[#EBCF8F]";
  } else if (status === "archived") {
    classes =
      "bg-[#E7F3ED] text-[#075A3A] ring-1 ring-[#C9E1D4]";
  } else if (status === "for_disposal") {
    classes =
      "bg-[#FBE8EC] text-[#8A1735] ring-1 ring-[#EBC5D0]";
  } else if (status === "disposed") {
    classes =
      "bg-[#ECE8E0] text-[#625E56] ring-1 ring-[#DDD5C8]";
  }

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold capitalize ${classes}`}
    >
      {label}
    </span>
  );
}

function getCardVariant(
  variant: "green" | "gold" | "maroon"
) {
  if (variant === "gold") {
    return {
      ring: "ring-[#E4D5AF] hover:ring-[#D7B96B]",
      topBar: "bg-[#D9961A]",
      decorative: "bg-[#D9961A]/10",
      icon: "bg-[#FFF3D6] text-[#A66B00]",
    };
  }

  if (variant === "maroon") {
    return {
      ring: "ring-[#E2CCD3] hover:ring-[#C994A5]",
      topBar: "bg-[#6B0F2B]",
      decorative: "bg-[#6B0F2B]/8",
      icon: "bg-[#F8E9EE] text-[#6B0F2B]",
    };
  }

  return {
    ring: "ring-[#CFE0D6] hover:ring-[#91BAA3]",
    topBar: "bg-[#075A3A]",
    decorative: "bg-[#075A3A]/8",
    icon: "bg-[#E6F2EC] text-[#075A3A]",
  };
}

function getRequestVariant(
  variant: "green" | "gold" | "maroon"
) {
  if (variant === "gold") {
    return {
      container:
        "border-[#E7D3A2] bg-[#FFF9EA] hover:border-[#D7B96B]",
      icon: "text-[#A66B00] ring-[#E7D3A2]",
    };
  }

  if (variant === "maroon") {
    return {
      container:
        "border-[#E4CBD4] bg-[#FCF2F5] hover:border-[#C994A5]",
      icon: "text-[#6B0F2B] ring-[#E4CBD4]",
    };
  }

  return {
    container:
      "border-[#CFE0D6] bg-[#F0F7F3] hover:border-[#91BAA3]",
    icon: "text-[#075A3A] ring-[#CFE0D6]",
  };
}

function getPaginationTotal(data: unknown) {
  if (!data || typeof data !== "object") {
    return 0;
  }

  const pagination = data as {
    total?: unknown;
    data?: unknown;
  };

  if (typeof pagination.total === "number") {
    return pagination.total;
  }

  if (Array.isArray(pagination.data)) {
    return pagination.data.length;
  }

  return 0;
}

function formatDate(date?: string | null) {
  if (!date) {
    return "N/A";
  }

  const rawDate = date.includes("T")
    ? date
    : `${date}T00:00:00`;

  const parsedDate = new Date(rawDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return parsedDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
