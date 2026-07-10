"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
        <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          Loading profile...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Account</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              My Profile
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
              View your account information, assigned role, and department in IRAM.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 sm:w-auto"
          >
            Logout
          </button>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-950">{user?.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0">
            <ProfileItem label="Full Name" value={user?.name || "N/A"} />
            <ProfileItem label="Email Address" value={user?.email || "N/A"} />
            <ProfileItem label="Role" value={user?.role?.name || "N/A"} />
            <ProfileItem label="Department" value={user?.department?.name || "N/A"} />
            <ProfileItem label="Account Status" value={user?.status || "N/A"} />
            <ProfileItem label="User ID" value={String(user?.id || "N/A")} />
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-800">
          <p className="font-bold">Role Access Summary</p>
          <p className="mt-1">
            {getRoleDescription(user?.role?.name)}
          </p>
        </section>
      </div>
    </AppShell>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold capitalize text-slate-800">
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