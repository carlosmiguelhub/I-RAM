"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await apiRequest("/me");
        setUser(data.user);
      } catch (error) {
        console.error(error);
        localStorage.removeItem("iram_token");
        localStorage.removeItem("iram_user");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  async function handleLogout() {
    try {
      await apiRequest("/logout", {
        method: "POST",
      });
    } catch (error) {
      console.error(error);
    } finally {
      localStorage.removeItem("iram_token");
      localStorage.removeItem("iram_user");
      router.replace("/login");
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="rounded-2xl bg-white p-5 text-sm text-[#766F63] shadow-sm ring-1 ring-[#DED5C5]">
          Loading profile...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl pb-8">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-5 py-6 text-white shadow-xl shadow-[#075A3A]/20 sm:px-7 sm:py-7">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#6B0F2B]/30 blur-3xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F4C25E]">
                Account
              </p>

              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                My Profile
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-[#E5DDCC]">
                View your account information, assigned role, and department in IRAM.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 sm:w-auto"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </section>

        <section className="relative mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DED5C5]">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#075A3A] via-[#D9961A] to-[#6B0F2B]" />

          <div className="border-b border-[#E3DCCE] bg-gradient-to-br from-[#F0F7F3] to-[#FFF9EA] px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6B0F2B] text-2xl font-extrabold text-white shadow-lg shadow-[#6B0F2B]/20 ring-4 ring-white">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>

              <div className="min-w-0">
                <h2 className="break-words text-xl font-extrabold text-[#252A27]">
                  {user?.name}
                </h2>

                <p className="mt-1 break-all text-sm text-[#766F63]">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-[#ECE5D8] md:grid-cols-2 md:divide-x md:divide-y-0">
            <ProfileItem
              icon={<UserRound className="h-4 w-4" />}
              label="Full Name"
              value={user?.name || "N/A"}
            />

            <ProfileItem
              icon={<Mail className="h-4 w-4" />}
              label="Email Address"
              value={user?.email || "N/A"}
            />

            <ProfileItem
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Role"
              value={user?.role?.name || "N/A"}
            />

            <ProfileItem
              icon={<Building2 className="h-4 w-4" />}
              label="Department"
              value={user?.department?.name || "N/A"}
            />

            <ProfileItem
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Account Status"
              value={user?.status || "N/A"}
            />

            <ProfileItem
              icon={<UserRound className="h-4 w-4" />}
              label="User ID"
              value={String(user?.id || "N/A")}
            />
          </div>
        </section>

        <section className="relative mt-6 overflow-hidden rounded-2xl border border-[#CFE0D6] bg-gradient-to-br from-[#F0F7F3] to-[#FFF9EA] p-5 shadow-sm">
          <div className="absolute inset-y-0 left-0 w-1 bg-[#D9961A]" />

          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#075A3A] text-[#F4C25E]">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div>
              <p className="font-extrabold text-[#2D332F]">
                Role Access Summary
              </p>

              <p className="mt-1 text-sm leading-6 text-[#625E56]">
                {getRoleDescription(user?.role?.name)}
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ProfileItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-5 transition hover:bg-[#FCFAF5] sm:p-6">
      <div className="flex items-center gap-2 text-[#A09582]">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0ECE4] text-[#075A3A]">
          {icon}
        </span>

        <p className="text-xs font-extrabold uppercase tracking-[0.14em]">
          {label}
        </p>
      </div>

      <p className="mt-3 break-words text-sm font-semibold capitalize text-[#3F443F]">
        {value}
      </p>
    </div>
  );
}

function getRoleDescription(roleName: string) {
  if (roleName === "Admin") {
    return "You have full access to records, users, departments, categories, audit logs, and system settings.";
  }

  if (roleName === "Records Officer") {
    return "You can manage records, review submissions, update record status, upload files, and view audit trails.";
  }

  if (roleName === "Staff") {
    return "You can submit records and track your own or department-related submissions.";
  }

  return "Your access is based on your assigned role.";
}