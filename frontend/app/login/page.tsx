"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Archive,
  Eye,
  EyeOff,
  FileCheck2,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import {
  defaultClientSystemSettings,
  loadPublicSystemSettings,
} from "@/lib/system-settings";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [systemIdentity, setSystemIdentity] = useState(
    defaultClientSystemSettings.general
  );
  const [registrationAllowed, setRegistrationAllowed] =
    useState(true);

  useEffect(() => {
    void loadPublicSystemSettings()
      .then((settings) => {
        setSystemIdentity(settings.general);
        setRegistrationAllowed(
          settings.security.allow_registration
        );
      })
      .catch(() => undefined);
  }, []);

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

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!validateForm()) return;

    setLoading(true);

    try {
      const data = await apiRequest("/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      localStorage.setItem("iram_token", data.token);
      localStorage.setItem("iram_user", JSON.stringify(data.user));

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateEmail(value: string) {
    setEmail(value);

    if (fieldErrors.email) {
      setFieldErrors((current) => ({
        ...current,
        email: "",
      }));
    }
  }

  function updatePassword(value: string) {
    setPassword(value);

    if (fieldErrors.password) {
      setFieldErrors((current) => ({
        ...current,
        password: "",
      }));
    }
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#F4F0E8] transition-colors dark:bg-[#181714] lg:flex lg:items-center lg:justify-center lg:px-4 lg:py-5">
      <div className="pointer-events-none absolute -left-24 -top-24 hidden h-72 w-72 rounded-full bg-[#D9961A]/25 blur-3xl sm:block" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 hidden h-80 w-80 rounded-full bg-[#075A3A]/20 blur-3xl sm:block" />

      <div className="absolute right-4 top-4 z-20 lg:right-7 lg:top-7">
        <ThemeToggle compact />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full overflow-hidden bg-white shadow-2xl shadow-[#7D6F5A]/20 transition-colors dark:bg-[#24221E] dark:shadow-black/25 lg:min-h-[610px] lg:max-w-5xl lg:grid-cols-[0.95fr_1.05fr] lg:rounded-3xl lg:ring-1 lg:ring-[#DED5C5] dark:lg:ring-[#454139]">
        <section className="relative hidden min-h-[610px] overflow-hidden bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] p-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,150,26,0.22),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(107,15,43,0.22),transparent_34%)]" />

          <div className="relative">
            <div className="flex h-[148px] w-full max-w-[420px] items-center overflow-hidden rounded-2xl shadow-lg ring-1 ring-white/20">
              <Image
                src="/iram-logo.png"
                alt="IRAM logo"
                width={1000}
                height={450}
                priority
                className="h-full w-full scale-[1.18] object-cover object-center"
              />
            </div>

            <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-[#D9961A]/30 bg-[#D9961A]/10 px-3 py-1.5 text-xs font-bold text-[#F4C25E] backdrop-blur">
              <ShieldCheck className="h-4 w-4 text-[#F4C25E]" />
              Secure records management
            </div>

            <h1 className="mt-5 max-w-md text-3xl font-bold leading-tight tracking-tight">
              Manage institutional records with confidence.
            </h1>

            <p className="mt-4 max-w-md text-sm leading-6 text-[#E5DDCC]">
              A centralized platform for record acquisition, review, correction,
              archiving, and controlled access.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <Feature
                icon={<FileCheck2 className="h-5 w-5" />}
                title="Structured workflow"
                text="Submit, review, correct, and archive."
              />

              <Feature
                icon={<Archive className="h-5 w-5" />}
                title="Organized archive"
                text="Keep records searchable and properly filed."
              />
            </div>
          </div>


        </section>

        <section className="flex min-h-screen flex-col bg-white transition-colors dark:bg-[#24221E] lg:min-h-[610px] lg:justify-center">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-5 pb-7 pt-5 text-white lg:hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,150,26,0.24),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(107,15,43,0.22),transparent_40%)]" />

            <div className="relative">
              <div className="mx-auto flex h-[84px] w-full max-w-[400px] items-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-white/20">
                <Image
                  src="/iram-logo.png"
                  alt="IRAM logo"
                  width={1000}
                  height={450}
                  priority
                  className="h-full w-full scale-[1.18] object-cover object-center"
                />
              </div>

              <div className="mt-5 flex items-center justify-center gap-2 text-center text-xs font-semibold text-[#F4C25E]">
                <ShieldCheck className="h-4 w-4 text-[#F4C25E]" />
                Secure records management
              </div>
            </div>
          </div>

          <div className="flex flex-1 items-center px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10">
            <div className="mx-auto w-full max-w-md">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#D9961A] sm:text-sm">
                Welcome back
              </p>

              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#252A27] sm:text-3xl">
                Sign in to {systemIdentity.system_name}
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#766F63]">
                Enter your account details to access the records management
                dashboard.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
                >
                  {error}
                </div>
              )}

              <form
                onSubmit={handleLogin}
                className="mt-6 space-y-4 sm:space-y-5"
                noValidate
              >
                <div>
                  <label
                    htmlFor="email"
                    className="text-sm font-semibold text-[#514D46]"
                  >
                    Email address
                  </label>

                  <div className="relative mt-2">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A09582]" />

                    <input
                      id="email"
                      value={email}
                      onChange={(event) => updateEmail(event.target.value)}
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="name@example.com"
                      aria-invalid={Boolean(fieldErrors.email)}
                      className={`h-12 w-full rounded-xl border bg-[#FCFAF5] pl-12 pr-4 text-base text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:bg-white focus:ring-4 sm:text-sm ${
                        fieldErrors.email
                          ? "border-red-300 focus:border-red-500 focus:ring-red-50"
                          : "border-[#E3DCCE] focus:border-[#075A3A] focus:ring-[#E6F2EC]"
                      }`}
                    />
                  </div>

                  {fieldErrors.email && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="text-sm font-semibold text-[#514D46]"
                  >
                    Password
                  </label>

                  <div className="relative mt-2">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A09582]" />

                    <input
                      id="password"
                      value={password}
                      onChange={(event) => updatePassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      aria-invalid={Boolean(fieldErrors.password)}
                      className={`h-12 w-full rounded-xl border bg-[#FCFAF5] pl-12 pr-12 text-base text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:bg-white focus:ring-4 sm:text-sm ${
                        fieldErrors.password
                          ? "border-red-300 focus:border-red-500 focus:ring-red-50"
                          : "border-[#E3DCCE] focus:border-[#075A3A] focus:ring-[#E6F2EC]"
                      }`}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-[#A09582] transition hover:bg-[#F4F0E8] hover:text-[#075A3A]"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>

                  {fieldErrors.password && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-5 text-sm font-bold text-white shadow-lg shadow-[#6B0F2B]/20 transition hover:-translate-y-0.5 hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Signing in..." : "Sign in"}
                </button>
              </form>

              {registrationAllowed && (
                <p className="mt-5 text-center text-sm text-[#766F63] sm:mt-6">
                  No account yet?{" "}
                  <Link
                    href="/register"
                    className="font-semibold text-[#075A3A] transition hover:text-[#075A3A]"
                  >
                    Create an account
                  </Link>
                </p>
              )}

              <p className="mt-2 text-center text-xs text-[#928875]">
                Didn&apos;t receive your verification email?{" "}
                <Link
                  href="/verify-email"
                  className="font-semibold text-[#075A3A] transition-colors hover:text-[#6B0F2B]"
                >
                  Resend it
                </Link>
              </p>

              <p className="mt-5 text-center text-[11px] leading-5 text-[#A09582] lg:hidden">
                {systemIdentity.organization_name}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D9961A] text-white shadow-sm">
        {icon}
      </div>

      <p className="mt-3 text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[#E5DDCC]">{text}</p>
    </div>
  );
}
