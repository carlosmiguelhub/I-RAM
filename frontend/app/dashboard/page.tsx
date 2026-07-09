"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const me = await apiRequest("/me");
        const recordData = await apiRequest("/records");

        setUser(me.user);
        setRecords(recordData.data || []);
      } catch (error) {
        localStorage.removeItem("iram_token");
        localStorage.removeItem("iram_user");
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const received = records.filter((r) => r.status === "received").length;
  const underReview = records.filter((r) => r.status === "under_review").length;
  const archived = records.filter((r) => r.status === "archived").length;

  return (
    <AppShell>
      <div className="w-full max-w-full">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-600">Welcome back</p>

            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Hello, {user?.name || "IRAM Admin"}
            </h1>

            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
              Monitor acquired records, archive status, and document activity.
            </p>
          </div>

          <Link
            href="/records/create"
            className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
          >
            + Upload / Add Record
          </Link>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Records" value={records.length} note="+12% this month" />
          <StatCard title="Received" value={received} note="New acquisitions" />
          <StatCard title="Under Review" value={underReview} note="Needs validation" />
          <StatCard title="Archived" value={archived} note="Stored records" />
        </section>

        <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 xl:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Recent Archive Activity
                </h2>
                <p className="text-sm text-slate-500">
                  Latest records encoded in the system.
                </p>
              </div>

              <Link href="/records" className="text-sm font-semibold text-blue-600">
                View all →
              </Link>
            </div>

            {/* Mobile card list */}
            <div className="mt-5 space-y-3 md:hidden">
              {loading && (
                <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
                  Loading records...
                </p>
              )}

              {!loading && records.length === 0 && (
                <p className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
                  No records yet.
                </p>
              )}

              {records.slice(0, 5).map((record) => (
                <Link
                  key={record.id}
                  href={`/records/${record.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 active:bg-slate-50"
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

                    <StatusBadge status={record.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-500">
                    <p>Category: {record.category?.name || "N/A"}</p>
                    <p>Department: {record.department?.name || "N/A"}</p>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop/tablet table */}
            <div className="mt-5 hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Record</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 bg-white">
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        No records yet.
                      </td>
                    </tr>
                  )}

                  {records.slice(0, 5).map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <Link
                          href={`/records/${record.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600"
                        >
                          {record.title}
                        </Link>
                        <p className="text-xs text-slate-500">{record.record_code}</p>
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {record.category?.name || "N/A"}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {record.department?.name || "N/A"}
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status={record.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
              🛡️
            </div>

            <h2 className="mt-5 text-lg font-bold">Audit Status</h2>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              Record activity is being tracked through audit logs.
            </p>

            <div className="mt-8">
              <p className="text-sm text-slate-400">Next scheduled review</p>
              <p className="mt-1 text-3xl font-bold">14 Days</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">
                Need to archive historical records?
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Use the Add Record module to encode physical or digital archive documents.
              </p>
            </div>

            <Link
              href="/records/create"
              className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
            >
              Open Record Encoder
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StatCard({
  title,
  value,
  note,
}: {
  title: string;
  value: number;
  note: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <h2 className="mt-3 text-3xl font-bold text-slate-950">{value}</h2>
      <p className="mt-2 text-xs font-semibold text-emerald-600">{note}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status?.replace("_", " ") || "unknown";

  return (
    <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
      {label}
    </span>
  );
}