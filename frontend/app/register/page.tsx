"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Archive,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadOptions() {
      try {
        const data = await apiRequest("/options");
        setDepartments(data.departments || []);
      } catch (loadError) {
        console.error("Failed to load departments:", loadError);
      }
    }

    loadOptions();
  }, []);

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((current) => ({ ...current, [name]: "" }));
    }
  }

  function validateForm() {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) errors.name = "Full name is required.";

    if (!form.email.trim()) {
      errors.email = "Email is required.";
    } else if (!form.email.includes("@")) {
      errors.email = "Enter a valid email address.";
    }

    if (!form.department_id) errors.department_id = "Department is required.";

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

  async function handleRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!validateForm()) return;
    setLoading(true);

    try {
      await apiRequest("/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          department_id: Number(form.department_id),
          password: form.password,
          password_confirmation: form.password_confirmation,
        }),
      });

      router.push(
        `/verify-email?sent=1&email=${encodeURIComponent(form.email.trim())}`
      );
    } catch (requestError: unknown) {
      setError(getErrorMessage(requestError, "Registration failed."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#F4F0E8] px-4 py-5 transition-colors dark:bg-[#181714] sm:px-6 sm:py-8 lg:flex lg:items-center lg:justify-center">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#D9961A]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-[#075A3A]/20 blur-3xl" />

      <div className="absolute right-7 top-7 z-20 sm:right-10 sm:top-10 lg:right-8 lg:top-8">
        <ThemeToggle compact />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-[#7D6F5A]/20 ring-1 ring-[#DED5C5] transition-colors dark:bg-[#24221E] dark:shadow-black/25 dark:ring-[#454139] lg:grid-cols-[0.82fr_1.18fr]">
        <section className="relative overflow-hidden bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] p-6 text-white sm:p-8 lg:flex lg:flex-col lg:justify-between lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,150,26,0.25),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(107,15,43,0.3),transparent_38%)]" />

          <div className="relative">
            <div className="mr-12 flex h-[92px] max-w-[390px] items-center overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-white/20 sm:mr-0 sm:h-[122px]">
              <Image
                src="/iram-logo.png"
                alt="IRAM logo"
                width={1000}
                height={450}
                priority
                className="h-full w-full scale-[1.18] object-cover object-center"
              />
            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#D9961A]/30 bg-[#D9961A]/10 px-3 py-1.5 text-xs font-bold text-[#F4C25E] backdrop-blur">
              <ShieldCheck className="h-4 w-4" />
              Secure staff registration
            </div>

            <h1 className="mt-5 max-w-md text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              Join your institution&apos;s records workspace.
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#E5DDCC]">
              Create your staff account to submit, monitor, and access records
              through one secure system.
            </p>
          </div>

          <div className="relative mt-7 hidden space-y-3 lg:block">
            <RegistrationBenefit icon={<FileCheck2 className="h-4 w-4" />} text="Structured record submission and tracking" />
            <RegistrationBenefit icon={<Archive className="h-4 w-4" />} text="Organized, searchable institutional archive" />
            <RegistrationBenefit icon={<CheckCircle2 className="h-4 w-4" />} text="Staff access ready immediately after registration" />
          </div>
        </section>

        <section className="bg-white px-5 py-7 transition-colors dark:bg-[#24221E] sm:px-8 sm:py-9 lg:px-12 lg:py-10">
          <div className="mx-auto max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#D9961A]">
              Create account
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#252A27] dark:text-[#F3EEE5] sm:text-3xl">
              Register for IRAM
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#766F63] dark:text-[#B9B0A2]">
              Accounts begin with Staff access. Administrators manage elevated roles.
            </p>

            {error && (
              <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5" noValidate>
              <FormInput
                label="Full name"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={fieldErrors.name}
                placeholder="Juan Dela Cruz"
                autoComplete="name"
                icon={<UserRound className="h-5 w-5" />}
              />

              <FormInput
                label="Email address"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                error={fieldErrors.email}
                placeholder="name@example.com"
                autoComplete="email"
                icon={<Mail className="h-5 w-5" />}
              />

              <div className="sm:col-span-2">
                <label htmlFor="department_id" className="text-sm font-semibold text-[#514D46] dark:text-[#E8E2D8]">
                  Department
                </label>
                <div className="relative mt-2">
                  <Building2 className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A09582]" />
                  <select
                    id="department_id"
                    name="department_id"
                    value={form.department_id}
                    onChange={handleChange}
                    aria-invalid={Boolean(fieldErrors.department_id)}
                    className={`h-12 w-full appearance-none rounded-xl border bg-[#FCFAF5] pl-12 pr-10 text-sm text-[#2D332F] outline-none transition focus:bg-white focus:ring-4 dark:bg-[#2C2923] dark:text-[#F0EBE2] dark:focus:bg-[#322F29] ${
                      fieldErrors.department_id
                        ? "border-red-300 focus:border-red-500 focus:ring-red-50 dark:border-red-800 dark:focus:ring-red-950"
                        : "border-[#E3DCCE] focus:border-[#075A3A] focus:ring-[#E6F2EC] dark:border-[#49443B] dark:focus:border-[#B9934C] dark:focus:ring-[#D9961A]/12"
                    }`}
                  >
                    <option value="">Select your department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </div>
                <FieldError message={fieldErrors.department_id} />
              </div>

              <FormInput
                label="Password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={handleChange}
                error={fieldErrors.password}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                icon={<LockKeyhole className="h-5 w-5" />}
                action={
                  <PasswordToggle visible={showPassword} onClick={() => setShowPassword((current) => !current)} />
                }
              />

              <FormInput
                label="Confirm password"
                name="password_confirmation"
                type={showConfirmation ? "text" : "password"}
                value={form.password_confirmation}
                onChange={handleChange}
                error={fieldErrors.password_confirmation}
                placeholder="Repeat your password"
                autoComplete="new-password"
                icon={<LockKeyhole className="h-5 w-5" />}
                action={
                  <PasswordToggle visible={showConfirmation} onClick={() => setShowConfirmation((current) => !current)} />
                }
              />

              <p className="text-xs leading-5 text-[#928875] dark:text-[#AFA699] sm:col-span-2">
                Use at least 8 characters with a combination of letters and numbers.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-5 text-sm font-bold text-white shadow-lg shadow-[#6B0F2B]/20 transition hover:-translate-y-0.5 hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 sm:col-span-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[#766F63] dark:text-[#B9B0A2]">
              Already have an account?{" "}
              <Link href="/login" className="font-bold text-[#075A3A] transition-colors hover:text-[#6B0F2B] dark:text-[#89B79D] dark:hover:text-[#E8C77F]">
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function RegistrationBenefit({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-[#E5DDCC] backdrop-blur">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D9961A] text-white">{icon}</span>
      {text}
    </div>
  );
}

function FormInput({
  label,
  name,
  value,
  onChange,
  error,
  placeholder,
  icon,
  action,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-semibold text-[#514D46] dark:text-[#E8E2D8]">{label}</label>
      <div className="relative mt-2">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A09582]">{icon}</span>
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          className={`h-12 w-full rounded-xl border bg-[#FCFAF5] pl-12 ${action ? "pr-12" : "pr-4"} text-base text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:bg-white focus:ring-4 dark:bg-[#2C2923] dark:text-[#F0EBE2] dark:focus:bg-[#322F29] sm:text-sm ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-50 dark:border-red-800 dark:focus:ring-red-950"
              : "border-[#E3DCCE] focus:border-[#075A3A] focus:ring-[#E6F2EC] dark:border-[#49443B] dark:focus:border-[#B9934C] dark:focus:ring-[#D9961A]/12"
          }`}
        />
        {action}
      </div>
      <FieldError message={error} />
    </div>
  );
}

function PasswordToggle({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={visible ? "Hide password" : "Show password"}
      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#A09582] transition-colors hover:bg-[#F0ECE4] hover:text-[#075A3A] dark:hover:bg-[#3A362F] dark:hover:text-[#D8B873]"
    >
      {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">{message}</p> : null;
}
