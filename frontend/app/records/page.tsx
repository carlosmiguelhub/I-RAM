"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

const allTabs = [
  { label: "All", value: "" },
  { label: "Received", value: "received" },
  { label: "Under Review", value: "under_review" },
  { label: "Archived", value: "archived" },
  { label: "For Disposal", value: "for_disposal" },
];

const staffTabs = [
  { label: "All", value: "" },
  { label: "Received", value: "received" },
  { label: "Under Review", value: "under_review" },
];

export default function RecordsPage() {
  const router = useRouter();

  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const roleName = user?.role?.name || "";
  const isStaff = roleName === "Staff";
  const tabs = useMemo(() => (isStaff ? staffTabs : allTabs), [isStaff]);

  async function loadRecords(searchValue = search, statusValue = activeStatus) {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (searchValue) params.append("search", searchValue);
      if (statusValue) params.append("status", statusValue);

      const query = params.toString();
      const endpoint = query ? `/records?${query}` : "/records";

      const data = await apiRequest(endpoint);
      setRecords(data.data || []);
    } catch (error: any) {
      console.error(error);

      if (error.message === "Unauthenticated.") {
        localStorage.removeItem("iram_token");
        localStorage.removeItem("iram_user");
        router.replace("/login");
        return;
      }

      alert("Failed to load records.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initPage() {
      try {
        const meData = await apiRequest("/me");
        setUser(meData.user);
        localStorage.setItem("iram_user", JSON.stringify(meData.user));

        await loadRecords("", "");
      } catch (error) {
        console.error(error);
        localStorage.removeItem("iram_token");
        localStorage.removeItem("iram_user");
        router.replace("/login");
      }
    }

    initPage();
  }, [router]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadRecords(search, activeStatus);
  }

  function handleTabChange(status: string) {
    setActiveStatus(status);
    loadRecords(search, status);
  }

  return (
    <AppShell>
      <div className="w-full max-w-full">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-600">
              {isStaff ? "Submission Tracking" : "Document Archive"}
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {isStaff ? "My Submissions" : "All Records"}
            </h1>

            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
              {isStaff
                ? "Track the records you submitted for archive review."
                : "Search, filter, and manage acquired records in the IRAM system."}
            </p>
          </div>

          <Link
            href="/records/create"
            className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
          >
            {isStaff ? "+ New Submission" : "+ Add Record"}
          </Link>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
              placeholder="Search by code, title, description, or source..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
              Search
            </button>
          </form>

          <div className="mt-5 overflow-x-auto">
            <div className="flex min-w-max gap-2">
              {tabs.map((tab) => {
                const active = activeStatus === tab.value;

                return (
                  <button
                    key={tab.label}
                    onClick={() => handleTabChange(tab.value)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-5 space-y-3 md:hidden">
          {loading && (
            <EmptyCard text="Loading records..." />
          )}

          {!loading && records.length === 0 && (
            <EmptyCard text="No records found." />
          )}

          {!loading &&
            records.map((record) => (
              <Link
                key={record.id}
                href={`/records/${record.id}`}
                className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-slate-900">
                      {record.title}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {record.record_code}
                    </p>
                  </div>

                  <StatusBadge status={record.status} />
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <InfoRow label="Category" value={record.category?.name || "N/A"} />
                  <InfoRow label="Department" value={record.department?.name || "N/A"} />
                  <InfoRow label="Received" value={record.date_received || "N/A"} />
                </div>
              </Link>
            ))}
        </section>

        <section className="mt-5 hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">Record</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Department</th>
                  <th className="px-5 py-4">Date Received</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-slate-500">
                      Loading records...
                    </td>
                  </tr>
                )}

                {!loading && records.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-slate-500">
                      No records found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  records.map((record) => (
                    <tr key={record.id} className="transition hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">{record.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {record.record_code}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {record.category?.name || "N/A"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {record.department?.name || "N/A"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {record.date_received || "N/A"}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge status={record.status} />
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          href={`/records/${record.id}`}
                          className="font-semibold text-blue-600 hover:text-blue-700"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <Link
          href="/records/create"
          className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white shadow-lg shadow-blue-600/30 transition active:scale-95 md:hidden"
          aria-label={isStaff ? "New submission" : "Add record"}
        >
          +
        </Link>
      </div>
    </AppShell>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status?.replace("_", " ") || "unknown";

  let classes = "bg-slate-100 text-slate-700";

  if (status === "received") classes = "bg-blue-50 text-blue-700";
  if (status === "under_review") classes = "bg-amber-50 text-amber-700";
  if (status === "archived") classes = "bg-emerald-50 text-emerald-700";
  if (status === "for_disposal") classes = "bg-red-50 text-red-700";
  if (status === "disposed") classes = "bg-slate-200 text-slate-700";

  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold capitalize ${classes}`}>
      {label}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="truncate font-medium text-slate-700">{value}</span>
    </div>
  );
}