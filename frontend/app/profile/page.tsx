"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Database,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Laptop,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Save,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiRequest, clearStoredAuth } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

type ProfileData = {
  user: AuthUser;
  activity: Record<string, number>;
  security: {
    active_sessions: number;
    last_activity_at?: string | null;
    current_session?: {
      created_at?: string | null;
      last_used_at?: string | null;
      expires_at?: string | null;
    } | null;
  };
};

type ModalMode = "edit" | "password" | "sessions" | null;

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] =
    useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadProfile = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const data = (await apiRequest("/profile")) as ProfileData;
      setProfile(data);
      setName(data.user.name || "");
    } catch {
      clearStoredAuth();
      router.replace("/login");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProfile]);

  const user = profile?.user;
  const roleName = user?.role?.name || "";
  const stats = useMemo(
    () => getActivityCards(roleName, profile?.activity || {}),
    [profile?.activity, roleName]
  );
  const quickActions = useMemo(
    () => getQuickActions(roleName),
    [roleName]
  );

  function openModal(mode: Exclude<ModalMode, null>) {
    setModalMode(mode);
    setName(user?.name || "");
    setCurrentPassword("");
    setPassword("");
    setPasswordConfirmation("");
    setShowPasswords(false);
    setError("");
    setSuccess("");
  }

  function closeModal() {
    if (submitting) return;
    setModalMode(null);
    setError("");
  }

  async function updateProfile() {
    if (!name.trim()) {
      setError("Your name is required.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const data = await apiRequest("/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      setProfile((current) =>
        current
          ? { ...current, user: data.user }
          : current
      );
      const storedUser = localStorage.getItem("iram_user");
      if (storedUser) {
        localStorage.setItem(
          "iram_user",
          JSON.stringify({
            ...JSON.parse(storedUser),
            ...data.user,
          })
        );
      }
      setModalMode(null);
      setSuccess(data.message || "Profile updated successfully.");
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Profile could not be updated."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function changePassword() {
    if (!currentPassword || !password || !passwordConfirmation) {
      setError("Complete all password fields.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("New password confirmation does not match.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const data = await apiRequest("/profile/password", {
        method: "PATCH",
        body: JSON.stringify({
          current_password: currentPassword,
          password,
          password_confirmation: passwordConfirmation,
        }),
      });
      setModalMode(null);
      setSuccess(data.message || "Password changed successfully.");
      await loadProfile(true);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Password could not be changed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function logoutOtherDevices() {
    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const data = await apiRequest(
        "/profile/logout-other-devices",
        {
          method: "POST",
          body: JSON.stringify({
            current_password: currentPassword,
          }),
        }
      );
      setModalMode(null);
      setSuccess(data.message || "Other sessions were signed out.");
      await loadProfile(true);
    } catch (requestError: unknown) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Other sessions could not be signed out."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest("/logout", {
        method: "POST",
        acceptedStatuses: [401],
      });
    } catch {
      // Always remove local credentials.
    } finally {
      clearStoredAuth();
      router.replace("/login");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-[#DED5C5] bg-white">
          <Loader2 className="h-7 w-7 animate-spin text-[#075A3A]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl pb-8">
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] p-5 text-white shadow-lg shadow-[#075A3A]/15 sm:p-6">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#6B0F2B] text-2xl font-extrabold shadow-lg ring-4 ring-white/15">
                {initials(user?.name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#F4C25E] ring-1 ring-white/15">
                    {roleName || "Account"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    {capitalize(user?.status) || "Unknown"}
                  </span>
                </div>
                <h1 className="mt-2 truncate text-2xl font-extrabold sm:text-3xl">
                  {user?.name}
                </h1>
                <p className="mt-1 truncate text-sm text-[#D5E5DC]">
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openModal("edit")}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-[#075A3A] hover:bg-[#FFF9EA] sm:flex-none"
              >
                <Edit3 className="h-4 w-4" />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#6B0F2B] px-3 text-white hover:bg-[#571023]"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {success && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            {success}
          </div>
        )}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link
                key={stat.label}
                href={stat.href}
                className="group rounded-xl border border-[#E3DCCE] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#C5B89F] hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E6F2EC] text-[#075A3A]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-2xl font-extrabold text-[#252A27]">
                    {stat.value}
                  </span>
                </div>
                <p className="mt-3 text-xs font-extrabold uppercase tracking-wide text-[#766F63]">
                  {stat.label}
                </p>
              </Link>
            );
          })}
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-[#E3DCCE] bg-white shadow-sm">
              <SectionHeader
                icon={<UserRound className="h-4 w-4" />}
                title="Account Information"
                description="Identity and organizational assignment"
              />
              <dl className="grid sm:grid-cols-2">
                <Detail
                  icon={<Mail className="h-4 w-4" />}
                  label="Email address"
                  value={user?.email || "N/A"}
                />
                <Detail
                  icon={<Building2 className="h-4 w-4" />}
                  label="Department"
                  value={user?.department?.name || "Not assigned"}
                />
                <Detail
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Role"
                  value={roleName || "N/A"}
                />
                <Detail
                  icon={<UserRound className="h-4 w-4" />}
                  label="User ID"
                  value={`#${user?.id || "N/A"}`}
                />
                <Detail
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Member since"
                  value={formatDate(user?.created_at)}
                />
                <Detail
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Email verified"
                  value={formatDate(user?.email_verified_at)}
                />
                <Detail
                  icon={<ShieldCheck className="h-4 w-4" />}
                  label="Account activated"
                  value={formatDate(user?.activated_at)}
                />
                <Detail
                  icon={<Activity className="h-4 w-4" />}
                  label="Last account activity"
                  value={formatDateTime(
                    profile?.security.last_activity_at
                  )}
                />
              </dl>
              <p className="border-t border-[#EEE8DD] bg-[#FCFAF6] px-4 py-3 text-xs leading-5 text-[#766F63]">
                Email, role, department, and account status are managed
                by an Administrator.
              </p>
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#E3DCCE] bg-white shadow-sm">
              <SectionHeader
                icon={<KeyRound className="h-4 w-4" />}
                title="Security"
                description="Password and active account sessions"
              />
              <div className="divide-y divide-[#EEE8DD]">
                <SecurityAction
                  icon={<LockKeyhole className="h-4 w-4" />}
                  title="Password"
                  description="Use at least eight characters with letters and numbers."
                  action="Change password"
                  onClick={() => openModal("password")}
                />
                <SecurityAction
                  icon={<Laptop className="h-4 w-4" />}
                  title={`${profile?.security.active_sessions || 0} active session(s)`}
                  description={`Current session expires ${formatDateTime(
                    profile?.security.current_session?.expires_at
                  )}.`}
                  action="Manage sessions"
                  onClick={() => openModal("sessions")}
                />
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-[#CFE0D6] bg-gradient-to-br from-[#F0F7F3] to-[#FFF9EA] p-5 shadow-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#075A3A] text-[#F4C25E]">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-extrabold text-[#252A27]">
                Your Access
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#625E56]">
                {getRoleDescription(roleName)}
              </p>
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#E3DCCE] bg-white shadow-sm">
              <SectionHeader
                icon={<Activity className="h-4 w-4" />}
                title="Quick Actions"
                description="Shortcuts available for your role"
              />
              <nav className="grid gap-2 p-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-sm font-bold text-[#514D46] transition hover:border-[#E3DCCE] hover:bg-[#FCFAF6] hover:text-[#075A3A]"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0ECE4] text-[#075A3A]">
                        <Icon className="h-4 w-4" />
                      </span>
                      {action.label}
                    </Link>
                  );
                })}
              </nav>
            </section>
          </aside>
        </div>
      </div>

      {modalMode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17231E]/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-[#E3DCCE] px-5 py-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#075A3A]">
                  {modalMode === "edit"
                    ? "Account settings"
                    : "Account security"}
                </p>
                <h2 className="mt-1 text-lg font-extrabold text-[#252A27]">
                  {modalMode === "edit"
                    ? "Edit Profile"
                    : modalMode === "password"
                    ? "Change Password"
                    : "Manage Sessions"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-lg p-2 text-[#766F63] hover:bg-[#F8F5EE]"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-4 p-5">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
                  {error}
                </div>
              )}

              {modalMode === "edit" ? (
                <>
                  <Field label="Full name">
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={inputClass}
                      autoFocus
                    />
                  </Field>
                  <p className="text-xs leading-5 text-[#766F63]">
                    Contact an Administrator to change your email,
                    department, role, or account status.
                  </p>
                </>
              ) : (
                <>
                  {modalMode === "sessions" && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                      This signs out every other browser or device while
                      keeping this session active.
                    </div>
                  )}
                  <Field label="Current password">
                    <PasswordInput
                      value={currentPassword}
                      visible={showPasswords}
                      onChange={setCurrentPassword}
                      onToggle={() =>
                        setShowPasswords((current) => !current)
                      }
                    />
                  </Field>
                  {modalMode === "password" && (
                    <>
                      <Field label="New password">
                        <PasswordInput
                          value={password}
                          visible={showPasswords}
                          onChange={setPassword}
                          onToggle={() =>
                            setShowPasswords((current) => !current)
                          }
                        />
                      </Field>
                      <Field label="Confirm new password">
                        <PasswordInput
                          value={passwordConfirmation}
                          visible={showPasswords}
                          onChange={setPasswordConfirmation}
                          onToggle={() =>
                            setShowPasswords((current) => !current)
                          }
                        />
                      </Field>
                    </>
                  )}
                </>
              )}
            </div>

            <footer className="flex justify-end gap-2 border-t border-[#E3DCCE] bg-[#F8F5EE] px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="min-h-10 rounded-xl border border-[#D7CDBB] bg-white px-4 text-sm font-bold text-[#514D46]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={
                  modalMode === "edit"
                    ? updateProfile
                    : modalMode === "password"
                    ? changePassword
                    : logoutOtherDevices
                }
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#075A3A] px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : modalMode === "sessions" ? (
                  <LogOut className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {submitting
                  ? "Saving..."
                  : modalMode === "edit"
                  ? "Save Profile"
                  : modalMode === "password"
                  ? "Change Password"
                  : "Logout Other Devices"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-[#E3DCCE] px-4 py-3.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E6F2EC] text-[#075A3A]">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-extrabold text-[#252A27]">{title}</h2>
        <p className="mt-0.5 text-xs text-[#766F63]">{description}</p>
      </div>
    </header>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 border-b border-[#EEE8DD] px-4 py-3 odd:sm:border-r">
      <span className="mt-0.5 text-[#075A3A]">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#9B8F7C]">
          {label}
        </dt>
        <dd className="mt-1 break-words text-xs font-bold text-[#3F443F]">
          {value}
        </dd>
      </div>
    </div>
  );
}

function SecurityAction({
  icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0ECE4] text-[#075A3A]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-[#2D332F]">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-[#766F63]">
          {description}
        </p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="min-h-9 rounded-lg border border-[#CFE0D6] bg-white px-3 text-xs font-bold text-[#075A3A] hover:bg-[#F0F7F3]"
      >
        {action}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-bold text-[#514D46]">
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function PasswordInput({
  value,
  visible,
  onChange,
  onToggle,
}: {
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} pr-11`}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#766F63]"
        aria-label={visible ? "Hide passwords" : "Show passwords"}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

const inputClass =
  "min-h-11 w-full rounded-xl border border-[#DED5C5] bg-white px-3 text-sm text-[#252A27] outline-none focus:border-[#075A3A] focus:ring-2 focus:ring-[#CFE0D6]";

function getActivityCards(
  role: string,
  activity: Record<string, number>
) {
  if (role === "Staff") {
    return [
      stat("Submitted Records", activity.submitted_records, FileText, "/records"),
      stat("Active Submissions", activity.active_submissions, Activity, "/records"),
      stat("Document Requests", activity.document_requests, ClipboardList, "/document-requests"),
      stat("Released Requests", activity.released_requests, CheckCircle2, "/document-requests?status=released"),
    ];
  }

  if (role === "Records Officer") {
    return [
      stat("Records Reviewed", activity.records_reviewed, FileText, "/records"),
      stat("Records Archived", activity.records_archived, Archive, "/archive"),
      stat("Disposal Requests", activity.disposal_requests, ClipboardList, "/disposal"),
      stat("Disposal Approvals", activity.disposal_approvals, ShieldCheck, "/disposal"),
    ];
  }

  return [
    stat("Total Users", activity.total_users, Users, "/admin/users"),
    stat("Pending Accounts", activity.pending_accounts, Clock3, "/admin/users?status=inactive"),
    stat("Total Records", activity.total_records, Database, "/records"),
    stat("My Audit Actions", activity.my_audit_actions, Activity, "/audit-trail"),
  ];
}

function stat(
  label: string,
  value: number | undefined,
  icon: React.ComponentType<{ className?: string }>,
  href: string
) {
  return { label, value: value || 0, icon, href };
}

function getQuickActions(role: string) {
  if (role === "Staff") {
    return [
      { label: "Submit a new record", href: "/records/create", icon: FileText },
      { label: "View my records", href: "/records", icon: ClipboardList },
      { label: "Open archive catalog", href: "/archive-catalog", icon: Archive },
    ];
  }

  if (role === "Records Officer") {
    return [
      { label: "Continue record reviews", href: "/records?status=under_review", icon: FileText },
      { label: "Open archive repository", href: "/archive", icon: Archive },
      { label: "Manage disposal", href: "/disposal", icon: Database },
    ];
  }

  return [
    { label: "Manage users", href: "/admin/users", icon: Users },
    { label: "System settings", href: "/admin/settings", icon: Settings },
    { label: "Review audit trail", href: "/audit-trail", icon: Activity },
  ];
}

function initials(name?: string | null) {
  const parts = (name || "User").trim().split(/\s+/);
  return `${parts[0]?.[0] || "U"}${parts[1]?.[0] || ""}`.toUpperCase();
}

function capitalize(value?: string | null) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRoleDescription(role: string) {
  if (role === "Admin") {
    return "You can manage users, classifications, all records, disposal approvals, audit logs, and system-wide settings.";
  }
  if (role === "Records Officer") {
    return "You can review and archive records, manage repositories and requests, participate in controlled disposal, and inspect audit history.";
  }
  if (role === "Staff") {
    return "You can submit and track records, browse the Staff Archive Catalog, and request authorized document access.";
  }
  return "Your access is determined by the role assigned by an Administrator.";
}
