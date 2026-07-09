"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

export default function RecordDetailsPage() {
  const params = useParams();
  const id = params.id;

  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecord() {
      try {
        const data = await apiRequest(`/records/${id}`);
        setRecord(data.record);
      } catch (error) {
        console.error(error);
        alert("Failed to load record.");
      } finally {
        setLoading(false);
      }
    }

    if (id) loadRecord();
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          Loading record...
        </div>
      </AppShell>
    );
  }

  if (!record) {
    return (
      <AppShell>
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          Record not found.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full max-w-full">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-600">Record Details</p>
            <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              {record.title}
            </h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              {record.record_code}
            </p>
          </div>

          <Link
            href="/records"
            className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
          >
            Back to Records
          </Link>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 xl:col-span-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Record Information
                </h2>
                <p className="text-sm text-slate-500">
                  Metadata and archive classification.
                </p>
              </div>

              <StatusBadge status={record.status} />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Info label="Date Received" value={record.date_received} />
              <Info label="Department" value={record.department?.name} />
              <Info label="Category" value={record.category?.name} />
              <Info label="Source" value={record.source} />
              <Info label="Storage Location" value={record.storage_location} />
              <Info label="Created By" value={record.creator?.name} />
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="font-bold text-slate-900">Description</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {record.description || "No description provided."}
              </p>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="font-bold text-slate-900">Remarks</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {record.remarks || "No remarks provided."}
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">
              <h2 className="text-lg font-bold">Archive Status</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                This record is currently marked as:
              </p>
              <div className="mt-5">
                <StatusBadgeDark status={record.status} />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
              <h2 className="text-lg font-bold text-slate-900">Files</h2>

              {record.files?.length === 0 ? (
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  No files uploaded yet.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {record.files?.map((file: any) => (
                    <div
                      key={file.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"
                    >
                      <p className="truncate font-semibold text-slate-900">
                        {file.file_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {file.file_type || "Unknown file"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">Audit Trail</h2>
          <p className="mt-1 text-sm text-slate-500">
            Activity history for this record.
          </p>

          {record.audit_logs?.length === 0 ? (
            <p className="mt-5 text-sm text-slate-500">No audit logs yet.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {record.audit_logs?.map((log: any) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-bold text-slate-900">{log.action}</p>
                    <p className="text-xs text-slate-400">{log.created_at}</p>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {log.description}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    By {log.user?.name || "Unknown"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">
        {value || "N/A"}
      </p>
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
    <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold capitalize ${classes}`}>
      {label}
    </span>
  );
}

function StatusBadgeDark({ status }: { status: string }) {
  const label = status?.replace("_", " ") || "unknown";

  return (
    <span className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-bold capitalize text-white ring-1 ring-white/20">
      {label}
    </span>
  );
}