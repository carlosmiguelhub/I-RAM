"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowRight,
  Bell,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  FileCheck2,
  FilePenLine,
  FilePlus2,
  Gauge,
  Lightbulb,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

const quickLinks = [
  { href: "#getting-started", label: "Getting started", icon: Gauge },
  { href: "#submit-record", label: "Submit a record", icon: FilePlus2 },
  { href: "#track-records", label: "Track records", icon: FileCheck2 },
  { href: "#request-document", label: "Request documents", icon: Archive },
];

export default function StaffGuidePage() {
  const router = useRouter();
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    async function verifyStaffAccess() {
      try {
        const data = await apiRequest("/me");

        if (data.user?.role?.name !== "Staff") {
          router.replace("/dashboard");
          return;
        }

        setCheckingAccess(false);
      } catch {
        router.replace("/login");
      }
    }

    verifyStaffAccess();
  }, [router]);

  if (checkingAccess) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center text-sm font-semibold text-[#766F63]">
          Loading Staff Guide...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl pb-10">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-5 py-7 text-white shadow-xl shadow-[#075A3A]/15 sm:px-8 sm:py-9">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D9961A]/20 blur-2xl" />
          <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#6B0F2B]/30 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-[#F4C25E]">
                <CircleHelp className="h-4 w-4" />
                Staff Help Center
              </div>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
                How to use IRAM
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#E5DDCC]">
                A practical guide for submitting records, following reviews,
                requesting archived documents, and managing your account.
              </p>
            </div>
            <div className="flex w-fit items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 backdrop-blur">
              <ShieldCheck className="h-8 w-8 text-[#F4C25E]" />
              <div>
                <p className="text-xs font-bold text-white">Staff access guide</p>
                <p className="mt-0.5 text-[11px] text-[#E5DDCC]">Follow your department&apos;s records policy</p>
              </div>
            </div>
          </div>
        </section>

        <nav aria-label="Guide sections" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickLinks.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DED5C5] transition hover:-translate-y-0.5 hover:ring-[#91BAA3]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E6F2EC] text-[#075A3A] ring-1 ring-[#CFE0D6]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold text-[#2D332F]">{label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#A09582] transition-transform group-hover:translate-x-0.5" />
            </a>
          ))}
        </nav>

        <section id="getting-started" className="scroll-mt-24 mt-7 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <GuideCard
            number="01"
            icon={<Gauge className="h-5 w-5" />}
            eyebrow="First steps"
            title="Start from your dashboard"
            description="The dashboard is your summary of submissions and document requests. Cards show records waiting for review, currently under review, and already archived."
          >
            <StepList
              steps={[
                "Use the summary cards to open records in a specific status.",
                "Check Latest Activity for recent changes to your submissions.",
                "Use Quick Actions to submit a record or track existing work.",
                "Open the bell icon regularly for review decisions and correction notices.",
              ]}
            />
            <GuideLink href="/dashboard" label="Open dashboard" />
          </GuideCard>

          <aside className="rounded-2xl border border-[#E7D3A2] bg-[#FFF9EA] p-5 shadow-sm">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D9961A] text-white">
              <Lightbulb className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold text-[#2D332F]">Before submitting</h2>
            <ul className="mt-3 space-y-3 text-sm leading-6 text-[#766F63]">
              <Tip>Use a clear, official record title.</Tip>
              <Tip>Confirm the date and category are correct.</Tip>
              <Tip>Remove duplicate or unrelated attachments.</Tip>
              <Tip>Never upload files outside your authorized work.</Tip>
            </ul>
          </aside>
        </section>

        <section id="submit-record" className="scroll-mt-24 mt-5">
          <GuideCard
            number="02"
            icon={<FilePlus2 className="h-5 w-5" />}
            eyebrow="New Submission"
            title="Submit a record for review"
            description="A new submission is sent to the Records Office with an initial Received status. Your college is filled automatically from your account."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <MiniStep number="1" title="Enter details" text="Add the received date, a descriptive title, and the correct category." />
              <MiniStep number="2" title="Attach files" text="Upload up to 5 supported files, with a maximum of 10 MB for each file." />
              <MiniStep number="3" title="Review and submit" text="Add a description or remarks, check everything, then select Submit for Review." />
            </div>
            <div className="mt-5 rounded-xl bg-[#F8F5EE] p-4 text-xs leading-5 text-[#766F63] ring-1 ring-[#E3DCCE]">
              Supported files include PDF, Word, Excel, PowerPoint, JPG, PNG, CSV, and text documents. A permanent IRAM record code is generated after submission.
            </div>
            <GuideLink href="/records/create" label="Create a submission" />
          </GuideCard>
        </section>

        <section id="track-records" className="scroll-mt-24 mt-5">
          <GuideCard
            number="03"
            icon={<FileCheck2 className="h-5 w-5" />}
            eyebrow="My Records"
            title="Track the review process"
            description="My Records contains only the records available to your account. Search, filter by status, and open a record to see its complete details."
          >
            <StatusFlow />
            <div className="mt-5 rounded-2xl border border-[#E4CBD4] bg-[#F8E9EE] p-4">
              <div className="flex gap-3">
                <FilePenLine className="mt-0.5 h-5 w-5 shrink-0 text-[#6B0F2B]" />
                <div>
                  <p className="text-sm font-bold text-[#2D332F]">When a correction is requested</p>
                  <p className="mt-1 text-xs leading-5 text-[#766F63]">
                    Open the record, read the Records Officer&apos;s correction notes carefully, select <strong>Edit &amp; Resubmit</strong>, replace or update the requested information, and submit it again.
                  </p>
                </div>
              </div>
            </div>
            <GuideLink href="/records" label="View my records" />
          </GuideCard>
        </section>

        <section id="request-document" className="scroll-mt-24 mt-5 grid gap-5 lg:grid-cols-2">
          <GuideCard
            number="04"
            icon={<BookOpen className="h-5 w-5" />}
            eyebrow="Archive Catalog"
            title="Find and request archived documents"
            description="The catalog shows archived records available for Staff requests. It does not automatically grant access to the document file."
          >
            <StepList
              steps={[
                "Search by title, record code, description, or source.",
                "Use category, department, and access filters to narrow results.",
                "Select Request Document on the correct record.",
                "Explain the official purpose and select digital, printed, or view-only access.",
              ]}
            />
            <GuideLink href="/archive-catalog" label="Browse archive catalog" />
          </GuideCard>

          <GuideCard
            number="05"
            icon={<ClipboardList className="h-5 w-5" />}
            eyebrow="Document Requests"
            title="Monitor your request"
            description="Track each request from submission through approval, rejection, pickup, or release."
          >
            <StepList
              steps={[
                "Pending means the Records Office has not decided yet.",
                "Under Review means your request is being evaluated.",
                "Approved digital requests can provide an authorized download.",
                "Ready for Pickup means a printed copy can be collected.",
                "You may cancel a request while it is Pending or Under Review.",
              ]}
            />
            <GuideLink href="/document-requests" label="View my requests" />
          </GuideCard>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <GuideCard
            number="06"
            icon={<Bell className="h-5 w-5" />}
            eyebrow="Notifications"
            title="Stay updated"
            description="The bell icon alerts you when a submission or request changes. Unread notifications show a count badge."
          >
            <p className="text-sm leading-6 text-[#766F63]">
              Select a notification to open its related record or request. Use <strong>Mark all as read</strong> after reviewing your updates.
            </p>
          </GuideCard>

          <GuideCard
            number="07"
            icon={<UserCircle2 className="h-5 w-5" />}
            eyebrow="My Profile"
            title="Check your account information"
            description="Your role and department determine which records and features you can access."
          >
            <p className="text-sm leading-6 text-[#766F63]">
              If your name, email, department, role, or account status is incorrect, contact your Records Officer or an Administrator instead of creating another account.
            </p>
            <GuideLink href="/profile" label="Open my profile" />
          </GuideCard>
        </section>

        <section className="mt-5 rounded-2xl bg-[#17231E] p-5 text-white shadow-lg sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D9961A]">
                <CircleHelp className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-extrabold">Still need assistance?</h2>
                <p className="mt-1 text-sm leading-6 text-[#E5DDCC]">
                  Contact your department&apos;s Records Officer for submission, correction, access, or account concerns.
                </p>
              </div>
            </div>
            <Link href="/profile" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/15">
              Check my department
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function GuideCard({
  number,
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  number: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DED5C5] sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#075A3A] via-[#D9961A] to-[#6B0F2B]" />
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E6F2EC] text-[#075A3A] ring-1 ring-[#CFE0D6]">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#D9961A]">{number} · {eyebrow}</p>
          <h2 className="mt-1 text-lg font-extrabold text-[#2D332F] sm:text-xl">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-[#766F63]">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </article>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-3 text-sm leading-6 text-[#625E56]">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F0F7F3] text-[10px] font-extrabold text-[#075A3A] ring-1 ring-[#CFE0D6]">{index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

function MiniStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-[#E3DCCE] bg-[#FCFAF5] p-4">
      <span className="text-xs font-extrabold text-[#D9961A]">STEP {number}</span>
      <h3 className="mt-2 text-sm font-bold text-[#2D332F]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[#766F63]">{text}</p>
    </div>
  );
}

function StatusFlow() {
  const statuses = [
    { title: "Received", text: "Waiting for initial review", color: "bg-[#D9961A]" },
    { title: "Under Review", text: "Being evaluated", color: "bg-[#6B0F2B]" },
    { title: "Correction", text: "Changes are required", color: "bg-amber-500" },
    { title: "Archived", text: "Review is complete", color: "bg-[#075A3A]" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {statuses.map((status, index) => (
        <div key={status.title} className="relative rounded-xl border border-[#E3DCCE] bg-[#FCFAF5] p-4">
          <span className={`block h-2 w-8 rounded-full ${status.color}`} />
          <p className="mt-3 text-sm font-bold text-[#2D332F]">{status.title}</p>
          <p className="mt-1 text-[11px] leading-4 text-[#766F63]">{status.text}</p>
          {index < statuses.length - 1 && <ArrowRight className="absolute -right-2.5 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-white p-0.5 text-[#A09582] sm:block" />}
        </div>
      ))}
    </div>
  );
}

function GuideLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#6B0F2B] px-4 text-xs font-bold text-white transition hover:bg-[#571023]">
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#075A3A]" />
      <span>{children}</span>
    </li>
  );
}
