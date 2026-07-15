"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { getErrorMessage } from "@/lib/types";

type Department = {
  id: number;
  name: string;
};

export default function RegisterPage() {
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    department_id: "",
    password: "",
    password_confirmation: "",
  });

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      try {
        const data = await apiRequest("/options");
        setDepartments(data.departments || []);
      } catch (error) {
        console.error("Failed to load departments:", error);
      }
    }

    loadOptions();
  }, []);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function validateForm() {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors.name = "Full name is required.";
    }

    if (!form.email.trim()) {
      errors.email = "Email is required.";
    } else if (!form.email.includes("@")) {
      errors.email = "Enter a valid email address.";
    }

    if (!form.department_id) {
      errors.department_id = "Department is required.";
    }

    if (!form.password) {
      errors.password = "Password is required.";
    } else if (form.password.length < 8) {
      errors.password = "Password must be at least 8 characters.";
    } else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      errors.password = "Password must contain letters and numbers.";
    }

    if (!form.password_confirmation) {
      errors.password_confirmation = "Please confirm your password.";
    } else if (form.password_confirmation !== form.password) {
      errors.password_confirmation = "Passwords do not match.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    setLoading(true);

    try {
      const data = await apiRequest("/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          department_id: Number(form.department_id),
          password: form.password,
          password_confirmation: form.password_confirmation,
        }),
      });

      localStorage.setItem("iram_token", data.token);
      localStorage.setItem("iram_user", JSON.stringify(data.user));

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Registration failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:p-8">
        <div>
          <p className="text-sm font-semibold text-blue-600">Create account</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Register for IRAM
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            New accounts are registered as Staff by default. Higher access roles
            are assigned only by the system administrator.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="mt-6 grid gap-5">
          <FieldErrorInput
            label="Full Name"
            name="name"
            value={form.name}
            onChange={handleChange}
            error={fieldErrors.name}
            placeholder="Juan Dela Cruz"
          />

          <FieldErrorInput
            label="Email Address"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            error={fieldErrors.email}
            placeholder="name@example.com"
          />

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Department
            </label>
            <select
              name="department_id"
              value={form.department_id}
              onChange={handleChange}
              className={`mt-2 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
                fieldErrors.department_id
                  ? "border-red-300 focus:border-red-500 focus:ring-red-50"
                  : "border-slate-200 focus:border-blue-500 focus:ring-blue-50"
              }`}
            >
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            {fieldErrors.department_id && (
              <p className="mt-2 text-xs font-medium text-red-600">
                {fieldErrors.department_id}
              </p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FieldErrorInput
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              error={fieldErrors.password}
              placeholder="Minimum 8 characters"
            />

            <FieldErrorInput
              label="Confirm Password"
              name="password_confirmation"
              type="password"
              value={form.password_confirmation}
              onChange={handleChange}
              error={fieldErrors.password_confirmation}
              placeholder="Repeat password"
            />
          </div>

          <button
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-blue-600">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}

function FieldErrorInput({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`mt-2 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-50"
            : "border-slate-200 focus:border-blue-500 focus:ring-blue-50"
        }`}
      />
      {error && (
        <p className="mt-2 text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
