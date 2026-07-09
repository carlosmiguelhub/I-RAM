"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("admin@iram.test");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  function validateForm() {
    const errors: Record<string, string> = {};

    if (!email.trim()) {
      errors.email = "Email is required.";
    } else if (!email.includes("@")) {
      errors.email = "Enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    setLoading(true);

    try {
      const data = await apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("iram_token", data.token);
      localStorage.setItem("iram_user", JSON.stringify(data.user));

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-slate-100 px-4 py-8">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200 lg:grid-cols-2">
        <section className="hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold">
              I
            </div>

            <h1 className="mt-8 text-3xl font-bold">IRAM Archive</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Record Acquisition and Archiving Management System for secure,
              searchable, and accountable document handling.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-5 ring-1 ring-white/10">
            <p className="text-sm font-semibold">Role-Based Access</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Admins manage the system, Records Officers handle archive
              operations, and Staff submit department records.
            </p>
          </div>
        </section>

        <section className="p-6 sm:p-8 lg:p-10">
          <div>
            <p className="text-sm font-semibold text-blue-600">Welcome back</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Login to IRAM
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Access your archive dashboard and manage records securely.
            </p>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Email address
              </label>
              <input
                className={`mt-2 w-full rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
                  fieldErrors.email
                    ? "border-red-300 focus:border-red-500 focus:ring-red-50"
                    : "border-slate-200 focus:border-blue-500 focus:ring-blue-50"
                }`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="name@example.com"
              />
              {fieldErrors.email && (
                <p className="mt-2 text-xs font-medium text-red-600">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Password
              </label>

              <div className="relative mt-2">
                <input
                  className={`w-full rounded-xl border bg-slate-50 px-4 py-3 pr-20 text-sm text-slate-900 outline-none transition focus:bg-white focus:ring-4 ${
                    fieldErrors.password
                      ? "border-red-300 focus:border-red-500 focus:ring-red-50"
                      : "border-slate-200 focus:border-blue-500 focus:ring-blue-50"
                  }`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-600"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {fieldErrors.password && (
                <p className="mt-2 text-xs font-medium text-red-600">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            No account yet?{" "}
            <Link href="/register" className="font-semibold text-blue-600">
              Create an account
            </Link>
          </p>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            Demo admin account: <strong>admin@iram.test</strong> /{" "}
            <strong>password123</strong>
          </div>
        </section>
      </div>
    </main>
  );
}