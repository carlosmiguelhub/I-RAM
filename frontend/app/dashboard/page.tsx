"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Files,
  FolderArchive,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

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

const initialCounts: DashboardCounts = {
  total: 0,
  received: 0,
  underReview: 0,
  archived: 0,
};

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [recentRecords, setRecentRecords] = useState<RecordItem[]>([]);
  const [counts, setCounts] =
    useState<DashboardCounts>(initialCounts);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const roleName = user?.role?.name || "";
  const isStaff = roleName === "Staff";
  const canManageRecords =
    roleName === "Admin" || roleName === "Records Officer";

  const primaryAction = isStaff
    ? {
        label: "+ New Submission",
        href: "/records/create",
      }
    : {
        label: "+ Add Record",
        href: "/records/create",
      };

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

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      setLoadError("");

      try {
        const [
          meData,
          recentData,
          receivedData,
          underReviewData,
          archivedData,
        ] = await Promise.all([
          apiRequest("/me"),
          apiRequest("/records"),
          apiRequest("/records?status=received"),
          apiRequest("/records?status=under_review"),
          apiRequest("/records?status=archived"),
        ]);

        setUser(meData.user);

        localStorage.setItem(
          "iram_user",
          JSON.stringify(meData.user)
        );

        setRecentRecords(
          (recentData.data || []).slice(0, 5)
        );

        setCounts({
          total:
            typeof recentData.total === "number"
              ? recentData.total
              : recentData.data?.length || 0,
          received:
            typeof receivedData.total === "number"
              ? receivedData.total
              : receivedData.data?.length || 0,
          underReview:
            typeof underReviewData.total === "number"
              ? underReviewData.total
              : underReviewData.data?.length || 0,
          archived:
            typeof archivedData.total === "number"
              ? archivedData.total
              : archivedData.data?.length || 0,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "";

        if (message === "Unauthenticated.") {
          localStorage.removeItem("iram_token");
          localStorage.removeItem("iram_user");
          router.replace("/login");
          return;
        }

        setLoadError(
          message || "Failed to load dashboard information."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-5 py-6 text-white shadow-xl shadow-slate-300/30 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 sm:flex">
                <ShieldCheck className="h-6 w-6 text-blue-200" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                  {isStaff
                    ? "Submission Overview"
                    : "Records Management Overview"}
                </p>

                <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">
                  Welcome, {user?.name || "IRAM User"}
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  {isStaff
                    ? "Track your submissions and monitor their progress through review and archiving."
                    : "Monitor incoming submissions, active reviews, and archived records from one place."}
                </p>
              </div>
            </div>

            <Link
              href={primaryAction.href}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-slate-100 sm:w-auto"
            >
              <FilePlus2 className="h-4 w-4" />
              {primaryAction.label.replace("+ ", "")}
            </Link>
          </div>
        </section>

        {loadError && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700"
          >
            {loadError}
          </div>
        )}

        <section className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title={isStaff ? "My Records" : "Total Records"}
            value={counts.total}
            description={
              isStaff
                ? "Records visible to your account"
                : "All records in the archive"
            }
            loading={loading}
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
          />

          <StatCard
            title="Under Review"
            value={counts.underReview}
            description="Currently being evaluated"
            loading={loading}
            href="/records?status=under_review"
          />

          <StatCard
            title="Archived"
            value={counts.archived}
            description="Officially archived records"
            loading={loading}
            href="/records?status=archived"
          />
        </section>

        <section className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.8fr)]">
          <div className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {recentTitle}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {recentDescription}
                </p>
              </div>

              <Link
                href="/records"
                className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
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

                  <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Record</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">
                            Department
                          </th>
                          <th className="px-4 py-3">
                            {isStaff
                              ? "Submitted"
                              : "Received"}
                          </th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-200 bg-white">
                        {recentRecords.map((record) => (
                          <tr
                            key={record.id}
                            className="transition hover:bg-slate-50"
                          >
                            <td className="px-4 py-4">
                              <Link
                                href={`/records/${record.id}`}
                                className="font-semibold text-slate-900 transition hover:text-blue-600"
                              >
                                {record.title}
                              </Link>

                              <p className="mt-1 text-xs text-slate-500">
                                {record.record_code}
                              </p>
                            </td>

                            <td className="px-4 py-4 text-slate-600">
                              {record.category?.name || "N/A"}
                            </td>

                            <td className="px-4 py-4 text-slate-600">
                              {record.department?.name || "N/A"}
                            </td>

                            <td className="px-4 py-4 text-slate-600">
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
            <section className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                    Current workflow
                  </p>

                  <h2 className="mt-2 text-xl font-bold">
                    {isStaff
                      ? "Submission Progress"
                      : "Review Queue"}
                  </h2>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg">
                  {isStaff ? <Archive className="h-5 w-5 text-blue-200" /> : <CheckCircle2 className="h-5 w-5 text-emerald-300" />}
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300">
                {workflowMessage}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
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
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                {isStaff
                  ? "View My Submissions"
                  : counts.received > 0
                  ? "Open Review Queue"
                  : "View All Records"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                Quick Actions
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
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
}: {
  title: string;
  value: number;
  description: string;
  loading: boolean;
  href?: string;
}) {
  const content = (
    <div className="h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Files className="h-4.5 w-4.5" />
        </div>
      </div>

      {loading ? (
        <div className="mt-4 h-9 w-20 animate-pulse rounded-lg bg-slate-200" />
      ) : (
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {value}
        </h2>
      )}

      <p className="mt-2 text-xs font-medium text-slate-500">
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
      className="block rounded-xl border border-slate-200 bg-white p-4 transition active:bg-slate-50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">
            {record.title}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {record.record_code}
          </p>
        </div>

        <StatusBadge
          status={record.status}
          isStaff={isStaff}
        />
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-500">
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
          className="animate-pulse rounded-xl border border-slate-200 p-4"
        >
          <div className="h-4 w-2/5 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-1/4 rounded bg-slate-100" />
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
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200">
        <Files className="h-5 w-5" />
      </div>

      <h3 className="mt-4 font-bold text-slate-900">
        No records yet
      </h3>

      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {isStaff
          ? "Your submitted records will appear here."
          : "Newly added records will appear here."}
      </p>

      <Link
        href="/records/create"
        className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
      >
        {isStaff
          ? "Create your first submission"
          : "Add the first record"}{" "}
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
      <p className="text-xs font-medium text-slate-300">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-white">
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
      className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 transition hover:border-blue-200 hover:bg-blue-50/50"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 transition group-hover:text-blue-700">
          {title}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
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
      <span className="text-slate-400">{label}</span>
      <span className="truncate font-medium text-slate-700">
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

  let classes = "bg-slate-100 text-slate-700";

  if (status === "received") {
    classes = "bg-blue-50 text-blue-700";
  } else if (status === "under_review") {
    classes = "bg-amber-50 text-amber-700";
  } else if (status === "archived") {
    classes = "bg-emerald-50 text-emerald-700";
  } else if (status === "for_disposal") {
    classes = "bg-red-50 text-red-700";
  } else if (status === "disposed") {
    classes = "bg-slate-200 text-slate-700";
  }

  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize ${classes}`}
    >
      {label}
    </span>
  );
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