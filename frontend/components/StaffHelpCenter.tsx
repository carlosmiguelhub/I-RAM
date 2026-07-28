"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  Bell,
  Check,
  ClipboardList,
  FileCheck2,
  FilePlus2,
  LifeBuoy,
  ShieldCheck,
  UserCircle2,
  X,
} from "lucide-react";
import {
  defaultClientSystemSettings,
  loadClientSystemSettings,
} from "@/lib/system-settings";

const workflowStatuses = [
  ["Received", "Waiting for review"],
  ["Under Review", "Being verified"],
  ["Correction", "Action required"],
  ["Archived", "Review completed"],
];

export default function StaffHelpCenter() {
  const [isStaff, setIsStaff] = useState(false);
  const [open, setOpen] = useState(false);
  const [systemSettings, setSystemSettings] = useState(
    defaultClientSystemSettings
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        const savedUser = localStorage.getItem("iram_user");
        const roleName = savedUser
          ? JSON.parse(savedUser)?.role?.name
          : "";
        setIsStaff(roleName === "Staff");
      } catch {
        setIsStaff(false);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    void loadClientSystemSettings()
      .then(setSystemSettings)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  if (!isStaff) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-4 z-40 flex min-h-12 items-center gap-2 rounded-2xl bg-[#075A3A] px-3.5 text-sm font-extrabold text-white shadow-xl shadow-[#075A3A]/25 ring-1 ring-white/20 transition hover:-translate-y-1 hover:bg-[#043D28] hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 sm:bottom-6 sm:right-6 sm:px-4"
        aria-label="Open Staff Help Center"
        title="Open Staff Help Center"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/12 text-[#F4C25E]">
          <LifeBuoy className="h-[1.1rem] w-[1.1rem]" />
        </span>
        <span className="hidden sm:inline">Help Center</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[210] flex items-end justify-center bg-[#071710]/80 backdrop-blur-md sm:items-center sm:p-5"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setOpen(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="staff-help-title"
              className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl border border-white/15 bg-[#FCFAF6] shadow-2xl dark:border-[#33445E] dark:bg-[#101B2D] sm:max-h-[88dvh] sm:rounded-3xl"
            >
              <header className="relative overflow-hidden bg-gradient-to-r from-[#063D2A] via-[#075A3A] to-[#043D28] px-5 py-5 text-white sm:px-7 sm:py-6">
                <span className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#D9961A]/15 blur-2xl" />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#F4C25E] ring-1 ring-white/15">
                      <LifeBuoy className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#F4C25E]">
                        Staff assistance
                      </p>
                      <h2
                        id="staff-help-title"
                        className="mt-1 text-xl font-extrabold sm:text-2xl"
                      >
                        {systemSettings.general.system_name} Help Center
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-[#D5E5DC]">
                        Quick guidance for submitting, tracking, and
                        requesting official documents.
                        {systemSettings.general.contact_email && (
                          <>
                            {" "}
                            Records Office:{" "}
                            {systemSettings.general.contact_email}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Close Help Center"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <section className="grid gap-4 md:grid-cols-2">
                  <GuideCard
                    icon={<FilePlus2 className="h-5 w-5" />}
                    title="Submit a document record"
                    description="Create a clear record and send it to the Records Office for formal review."
                    steps={[
                      "Enter the official title, date, and category.",
                      "Attach up to 10 supported files; the current size and type rules appear on the submission form.",
                      "Review the details, then select Submit for Review.",
                    ]}
                    href="/records/create"
                    action="Create submission"
                    onNavigate={() => setOpen(false)}
                  />
                  <GuideCard
                    icon={<FileCheck2 className="h-5 w-5" />}
                    title="Track your records"
                    description="Follow every submission and respond when a Records Officer requests a correction."
                    steps={[
                      "Open My Document Records.",
                      "Use status filters to find the submission.",
                      "For Correction records, read the notes and use Edit & Resubmit.",
                    ]}
                    href="/records"
                    action="View my records"
                    onNavigate={() => setOpen(false)}
                  />
                  <GuideCard
                    icon={<Archive className="h-5 w-5" />}
                    title="Find archived documents"
                    description="Search the Records Repository without automatically receiving file access."
                    steps={[
                      "Open the Archive Catalog.",
                      "Search by title, code, category, or department.",
                      "Select the correct record and submit an official access purpose.",
                    ]}
                    href="/archive-catalog"
                    action="Browse catalog"
                    onNavigate={() => setOpen(false)}
                  />
                  <GuideCard
                    icon={<ClipboardList className="h-5 w-5" />}
                    title="Monitor document requests"
                    description="Check whether a requested copy is pending, approved, ready for pickup, or released."
                    steps={[
                      "Open My Document Requests.",
                      "Review the latest request status and remarks.",
                      "Approved digital files are available only during authorized access.",
                    ]}
                    href="/document-requests"
                    action="View my requests"
                    onNavigate={() => setOpen(false)}
                  />
                </section>

                <section className="mt-5 rounded-2xl border border-[#D9D2C4] bg-white p-4 shadow-sm dark:border-[#33445E] dark:bg-[#172337] sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF3D6] text-[#A66B00] dark:bg-[#26354A] dark:text-[#F1C768]">
                      <ShieldCheck className="h-[1.1rem] w-[1.1rem]" />
                    </span>
                    <div>
                      <h3 className="font-extrabold text-[#2D332F]">
                        Submission status guide
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[#766F63]">
                        These statuses show where your record is in the
                        review process.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    {workflowStatuses.map(([status, detail], index) => (
                      <div
                        key={status}
                        className="rounded-xl border border-[#E3DCCE] bg-[#FCFAF6] p-3 dark:border-[#33445E] dark:bg-[#101B2D]"
                      >
                        <span className="text-[10px] font-extrabold text-[#D9961A]">
                          0{index + 1}
                        </span>
                        <p className="mt-1 text-sm font-bold text-[#2D332F]">
                          {status}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#766F63]">
                          {detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="mt-5 flex flex-col gap-4 rounded-2xl bg-[#17231E] p-4 text-white sm:flex-row sm:items-center sm:justify-between sm:p-5 dark:bg-[#0A1425] dark:ring-1 dark:ring-[#33445E]">
                  <div className="flex items-start gap-3">
                    <Bell className="mt-0.5 h-5 w-5 shrink-0 text-[#F4C25E]" />
                    <div>
                      <h3 className="text-sm font-extrabold">
                        Need account or department assistance?
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-[#D5E5DC]">
                        Check your profile first. Contact an Administrator
                        if your assignment or account details are
                        incorrect.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-white/10 px-4 text-xs font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15"
                  >
                    <UserCircle2 className="h-4 w-4" />
                    Open Profile
                  </Link>
                </section>
              </div>
            </section>
          </div>,
          document.body
        )}
    </>
  );
}

function GuideCard({
  icon,
  title,
  description,
  steps,
  href,
  action,
  onNavigate,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  steps: string[];
  href: string;
  action: string;
  onNavigate: () => void;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-[#DED5C5] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#33445E] dark:bg-[#172337] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E6F2EC] text-[#075A3A] dark:bg-[#1C2A40] dark:text-[#79D6A8]">
          {icon}
        </span>
        <div>
          <h3 className="font-extrabold text-[#2D332F]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#766F63]">
            {description}
          </p>
        </div>
      </div>
      <ol className="mt-4 flex-1 space-y-2">
        {steps.map((step) => (
          <li
            key={step}
            className="flex items-start gap-2 text-xs leading-5 text-[#625E56]"
          >
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#075A3A] text-white">
              <Check className="h-2.5 w-2.5" />
            </span>
            {step}
          </li>
        ))}
      </ol>
      <Link
        href={href}
        onClick={onNavigate}
        className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#CFE0D6] bg-[#F0F7F3] px-4 text-xs font-extrabold text-[#075A3A] transition hover:border-[#91BAA3] hover:bg-[#E6F2EC] dark:border-[#33445E] dark:bg-[#1C2A40] dark:text-[#79D6A8]"
      >
        {action}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}
