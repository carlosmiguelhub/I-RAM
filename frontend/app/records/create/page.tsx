"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

export default function CreateRecordPage() {
  const router = useRouter();

  const [departments, setDepartments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    record_code: "",
    title: "",
    description: "",
    category_id: "",
    department_id: "",
    date_received: "",
    source: "",
    status: "received",
    storage_location: "",
    remarks: "",
  });

  useEffect(() => {
    async function loadOptions() {
      try {
        const data = await apiRequest("/options");
        setDepartments(data.departments || []);
        setCategories(data.categories || []);
        setStatuses(data.statuses || []);
      } catch (error) {
        console.error(error);
        alert("Failed to load form options.");
      }
    }

    loadOptions();
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      await apiRequest("/records", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          category_id: Number(form.category_id),
          department_id: Number(form.department_id),
        }),
      });

      router.push("/records");
    } catch (error: any) {
      alert(error.message || "Failed to create record.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Record Encoder</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Add New Record
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
              Encode a newly acquired physical or digital document into the IRAM archive.
            </p>
          </div>

          <Link
            href="/records"
            className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:w-auto"
          >
            Back to Records
          </Link>
        </section>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">Basic Information</h2>
            <p className="mt-1 text-sm text-slate-500">
              Required details for identifying and classifying the record.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="Record Code"
                name="record_code"
                value={form.record_code}
                onChange={handleChange}
                placeholder="IRAM-2026-0001"
                required
              />

              <FormInput
                label="Date Received"
                name="date_received"
                type="date"
                value={form.date_received}
                onChange={handleChange}
                required
              />

              <div className="md:col-span-2">
                <FormInput
                  label="Title"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Enter record title"
                  required
                />
              </div>

              <FormSelect
                label="Category"
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                required
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </FormSelect>

              <FormSelect
                label="Department"
                name="department_id"
                value={form.department_id}
                onChange={handleChange}
                required
              >
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </FormSelect>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">Archive Details</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add source, status, location, and notes for archive tracking.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="Source / Sender"
                name="source"
                value={form.source}
                onChange={handleChange}
                placeholder="Registrar Office"
              />

              <FormSelect
                label="Status"
                name="status"
                value={form.status}
                onChange={handleChange}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ")}
                  </option>
                ))}
              </FormSelect>

              <div className="md:col-span-2">
                <FormInput
                  label="Storage Location"
                  name="storage_location"
                  value={form.storage_location}
                  onChange={handleChange}
                  placeholder="Cabinet A - Drawer 1"
                />
              </div>

              <div className="md:col-span-2">
                <FormTextarea
                  label="Description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Briefly describe the record..."
                />
              </div>

              <div className="md:col-span-2">
                <FormTextarea
                  label="Remarks"
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
          </section>

          <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Link
                href="/records"
                className="flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 sm:w-auto"
              >
                Cancel
              </Link>

              <button
                disabled={loading}
                className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
              >
                {loading ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function FormInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
      />
    </label>
  );
}

function FormSelect({
  label,
  name,
  value,
  onChange,
  children,
  required = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
      >
        {children}
      </select>
    </label>
  );
}

function FormTextarea({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={4}
        className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
      />
    </label>
  );
}