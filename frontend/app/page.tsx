import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Archive,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileLock2,
  FileSearch,
  FolderTree,
  History,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "IRAM | Record Acquisition and Archiving Management",
  description:
    "A secure institutional platform for record acquisition, review, archiving, retention, and controlled access.",
};

const capabilities = [
  {
    icon: FileCheck2,
    title: "Structured record lifecycle",
    description:
      "Move every submission through a clear process for receipt, verification, correction, and final archiving.",
  },
  {
    icon: FolderTree,
    title: "Organized digital archive",
    description:
      "Classify records by department and category, then organize official copies into searchable archive folders.",
  },
  {
    icon: FileLock2,
    title: "Controlled document access",
    description:
      "Handle digital, printed, and view-only requests with approvals, claim tickets, and role-based permissions.",
  },
];

const workflow = [
  {
    number: "01",
    title: "Acquire",
    description: "Capture records, metadata, and supporting files.",
  },
  {
    number: "02",
    title: "Review",
    description: "Verify submissions and resolve corrections.",
  },
  {
    number: "03",
    title: "Archive",
    description: "Apply storage and retention controls.",
  },
  {
    number: "04",
    title: "Access",
    description: "Process accountable document requests.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F7F8F6] text-[#17231E] dark:bg-[#07101F] dark:text-[#EDF2F8]">
      <header className="relative z-40 border-b border-[#E1E6E2] bg-white/95 backdrop-blur-xl dark:border-[#26354A] dark:bg-[#0A1425]/95">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="IRAM home"
            className="flex h-12 w-44 shrink-0 items-center overflow-hidden rounded-lg bg-white"
          >
            <Image
              src="/iram-logo.png"
              alt="IRAM — Record Acquisition and Archiving Management System"
              width={1000}
              height={450}
              priority
              className="h-full w-full scale-[1.22] object-cover object-center"
            />
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 text-sm font-semibold text-[#56615A] dark:text-[#B9C5D5] md:flex"
          >
            <a href="#platform" className="transition hover:text-[#075A3A]">
              Platform
            </a>
            <a href="#workflow" className="transition hover:text-[#075A3A]">
              Workflow
            </a>
            <a href="#governance" className="transition hover:text-[#075A3A]">
              Governance
            </a>
          </nav>

          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#075A3A] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#06472F] focus:outline-none focus:ring-4 focus:ring-[#CFE0D6]"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <section className="relative">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(10,153,126,0.14),transparent_27%),radial-gradient(circle_at_12%_8%,rgba(217,150,26,0.12),transparent_24%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(480px,0.92fr)] lg:px-8 lg:py-24">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#CFE0D6] bg-white px-3 py-1.5 text-xs font-bold text-[#075A3A] shadow-sm dark:border-[#33445E] dark:bg-[#172337] dark:text-[#78D6A7]">
              <ShieldCheck className="h-4 w-4" />
              Secure institutional records management
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.035em] text-[#15231D] dark:text-white sm:text-5xl lg:text-[3.75rem]">
              Every record.
              <span className="block text-[#075A3A] dark:text-[#78D6A7]">
                Accountable from acquisition to archive.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-[#667169] dark:text-[#B9C5D5] sm:text-lg sm:leading-8">
              IRAM gives institutions one secure workspace to receive,
              verify, organize, retain, and provide controlled access to
              official records.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#6B0F2B] px-5 text-sm font-bold text-white shadow-lg shadow-[#6B0F2B]/15 transition hover:-translate-y-0.5 hover:bg-[#571023]"
              >
                Access IRAM
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#platform"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-[#D6DDD8] bg-white px-5 text-sm font-bold text-[#354139] transition hover:border-[#AFC4B7] hover:bg-[#F2F6F3] dark:border-[#33445E] dark:bg-[#172337] dark:text-white"
              >
                Explore the platform
              </a>
            </div>

            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-[#667169] dark:text-[#AAB8C9] sm:text-sm">
              {[
                "Role-based access",
                "Auditable workflows",
                "Retention controls",
              ].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E4F0E9] text-[#075A3A] dark:bg-[#1C3B31] dark:text-[#78D6A7]">
                    <Check className="h-3 w-3" />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <SystemPreview />
        </div>
      </section>

      <section className="border-y border-[#E1E6E2] bg-white dark:border-[#26354A] dark:bg-[#0A1425]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-[#E4E8E5] px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6 lg:px-8 dark:divide-[#26354A]">
          <TrustPoint
            icon={Layers3}
            title="One source of truth"
            description="Centralized institutional records"
          />
          <TrustPoint
            icon={History}
            title="Traceable by design"
            description="Actions recorded for accountability"
          />
          <TrustPoint
            icon={LockKeyhole}
            title="Access with purpose"
            description="Permissions aligned to user roles"
          />
        </div>
      </section>

      <section
        id="platform"
        className="scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="A complete records workspace"
            title="Built around the work records teams actually perform."
            description="IRAM connects submission, review, archiving, retention, and document access without fragmenting the record trail."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {capabilities.map((capability) => {
              const Icon = capability.icon;

              return (
                <article
                  key={capability.title}
                  className="group rounded-2xl border border-[#E0E5E1] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-[#BFD1C5] hover:shadow-xl hover:shadow-[#173D2C]/[0.06] dark:border-[#2B3A51] dark:bg-[#111D2F]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E7F0EB] text-[#075A3A] transition group-hover:bg-[#075A3A] group-hover:text-white dark:bg-[#1C3B31] dark:text-[#78D6A7]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold text-[#1D2821] dark:text-white">
                    {capability.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#68736B] dark:text-[#AAB8C9]">
                    {capability.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="scroll-mt-20 bg-[#EEF3EF] px-4 py-20 dark:bg-[#0A1425] sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Clear by default"
            title="A record lifecycle everyone can understand."
            description="Each stage has a clear purpose, owner, and next action—giving staff visibility without sacrificing control."
          />

          <div className="relative mt-12 grid gap-4 lg:grid-cols-4">
            <div className="absolute left-[12.5%] right-[12.5%] top-8 hidden h-px bg-[#C5D2CA] lg:block dark:bg-[#33445E]" />
            {workflow.map((step) => (
              <article
                key={step.number}
                className="relative rounded-2xl border border-[#DCE4DE] bg-white p-5 shadow-sm dark:border-[#2B3A51] dark:bg-[#111D2F]"
              >
                <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#075A3A] text-xs font-bold text-white ring-8 ring-white dark:ring-[#111D2F]">
                  {step.number}
                </span>
                <h3 className="mt-5 text-base font-bold text-[#253029] dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#6B756E] dark:text-[#AAB8C9]">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="governance"
        className="scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8 lg:py-24"
      >
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-3xl bg-[#11251C] text-white shadow-2xl shadow-[#11251C]/15 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative overflow-hidden p-7 sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#D9961A]/20 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F4C25E]">
                Governance and protection
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Control without creating friction.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-7 text-[#C5D2CA] sm:text-base">
                Keep sensitive records appropriately protected while giving
                authorized teams a practical way to complete their work.
              </p>
            </div>
          </div>

          <div className="grid gap-px bg-white/10 sm:grid-cols-2">
            <GovernanceItem
              icon={Users}
              title="Role-aware workspaces"
              description="Focused experiences for Staff, Records Officers, and Administrators."
            />
            <GovernanceItem
              icon={ClipboardCheck}
              title="Review accountability"
              description="Named reviewers, timestamps, remarks, and traceable decisions."
            />
            <GovernanceItem
              icon={Archive}
              title="Retention governance"
              description="Permanent and temporary schedules with controlled disposal."
            />
            <GovernanceItem
              icon={FileSearch}
              title="Auditable access"
              description="Document requests move through review, approval, pickup, and release."
            />
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8 lg:pb-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-2xl border border-[#D8E2DB] bg-white p-7 shadow-sm dark:border-[#2B3A51] dark:bg-[#111D2F] sm:p-9 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#D08A0D]">
              Institutional records, responsibly managed
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#1D2821] dark:text-white sm:text-3xl">
              Continue to your secure IRAM workspace.
            </h2>
          </div>
          <Link
            href="/login"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#075A3A] px-5 text-sm font-bold text-white transition hover:bg-[#06472F]"
          >
            Sign in to IRAM
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#E1E6E2] bg-white dark:border-[#26354A] dark:bg-[#0A1425]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex h-11 w-40 items-center overflow-hidden rounded-lg bg-white">
            <Image
              src="/iram-logo.png"
              alt="IRAM"
              width={1000}
              height={450}
              className="h-full w-full scale-[1.22] object-cover object-center"
            />
          </div>
          <p className="text-xs leading-5 text-[#778079] dark:text-[#93A2B5]">
            Record Acquisition and Archiving Management System
          </p>
          <Link
            href="/login"
            className="text-sm font-bold text-[#075A3A] dark:text-[#78D6A7]"
          >
            Secure sign in
          </Link>
        </div>
      </footer>
    </main>
  );
}

function SystemPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-[#075A3A]/15 via-transparent to-[#D9961A]/15 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/30 bg-[#10261C] p-3 shadow-[0_30px_80px_rgba(13,44,30,0.24)] sm:p-4">
        <div className="flex items-center justify-between px-1 pb-3 text-white">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#F4C25E]">
              Records workspace
            </p>
            <p className="mt-1 text-sm font-bold">Archive overview</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/20" />
            <span className="h-2 w-2 rounded-full bg-white/20" />
            <span className="h-2 w-2 rounded-full bg-[#F4C25E]" />
          </div>
        </div>

        <div className="rounded-xl bg-[#F7F8F6] p-4">
          <div className="grid grid-cols-3 gap-2">
            <PreviewMetric label="Received" value="12" tone="gold" />
            <PreviewMetric label="Under review" value="08" tone="maroon" />
            <PreviewMetric label="Archived" value="246" tone="green" />
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-[#E0E5E1] bg-white">
            <div className="flex items-center justify-between border-b border-[#E8ECE9] px-3 py-2.5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#8A938C]">
                  Active record
                </p>
                <p className="mt-0.5 text-xs font-bold text-[#27322B]">
                  Institutional Quality Manual
                </p>
              </div>
              <span className="rounded-full bg-[#FFF3D6] px-2 py-1 text-[9px] font-bold text-[#946100]">
                Under Review
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3">
              <PreviewField label="Record code" value="IRAM-2026-R000128" />
              <PreviewField label="Department" value="Records Office" />
              <PreviewField label="Category" value="Administrative" />
              <PreviewField label="Files" value="4 attachments" />
            </div>

            <div className="border-t border-[#E8ECE9] px-3 py-3">
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wide text-[#7B857E]">
                <span>Record progress</span>
                <span className="text-[#075A3A]">Verification in progress</span>
              </div>
              <div className="mt-3 grid grid-cols-[auto_1fr_auto_1fr_auto] items-center">
                <PreviewStep complete label="Received" />
                <span className="h-px bg-[#8DB4A0]" />
                <PreviewStep active label="Review" />
                <span className="h-px bg-[#D8DFDA]" />
                <PreviewStep label="Archive" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#EAF2ED] px-3 py-2.5 text-[10px] font-semibold text-[#075A3A]">
            <CheckCircle2 className="h-4 w-4" />
            Every workflow action is recorded in the audit trail.
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "gold" | "maroon";
}) {
  const colors = {
    green: "bg-[#E7F0EB] text-[#075A3A]",
    gold: "bg-[#FFF3D6] text-[#946100]",
    maroon: "bg-[#F8E9EE] text-[#6B0F2B]",
  };

  return (
    <div className={`rounded-lg p-2.5 ${colors[tone]}`}>
      <p className="text-[9px] font-bold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F7F9F7] px-2.5 py-2">
      <p className="text-[8px] font-bold uppercase tracking-wide text-[#8A938C]">
        {label}
      </p>
      <p className="mt-1 truncate text-[10px] font-semibold text-[#354139]">
        {value}
      </p>
    </div>
  );
}

function PreviewStep({
  label,
  complete = false,
  active = false,
}: {
  label: string;
  complete?: boolean;
  active?: boolean;
}) {
  return (
    <div className="flex flex-col items-center">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full ${
          complete || active
            ? "bg-[#075A3A] text-white"
            : "bg-[#E8ECE9] text-[#919A93]"
        } ${active ? "ring-4 ring-[#DCEAE2]" : ""}`}
      >
        {complete ? (
          <Check className="h-3 w-3" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>
      <span className="mt-1.5 text-[8px] font-bold text-[#6D776F]">
        {label}
      </span>
    </div>
  );
}

function TrustPoint({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-6 sm:px-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E7F0EB] text-[#075A3A] dark:bg-[#1C3B31] dark:text-[#78D6A7]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-bold text-[#28322C] dark:text-white">
          {title}
        </p>
        <p className="mt-0.5 text-xs text-[#737D76] dark:text-[#93A2B5]">
          {description}
        </p>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#B87510]">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-[-0.025em] text-[#1D2821] dark:text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-[#68736B] dark:text-[#AAB8C9]">
        {description}
      </p>
    </div>
  );
}

function GovernanceItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <article className="bg-white/[0.04] p-6 sm:p-7">
      <Icon className="h-5 w-5 text-[#F4C25E]" />
      <h3 className="mt-4 text-sm font-bold text-white">{title}</h3>
      <p className="mt-2 text-xs leading-6 text-[#B8C7BF]">{description}</p>
    </article>
  );
}
