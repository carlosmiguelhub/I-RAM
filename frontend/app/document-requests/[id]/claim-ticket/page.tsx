"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MapPin,
  Printer,
  ShieldCheck,
  TicketCheck,
  UserRound,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { apiRequest } from "@/lib/api";
import styles from "./page.module.css";

type ClaimRequest = {
  id: number;
  claim_code?: string | null;
  preferred_format: string;
  status: string;
  purpose: string;
  review_notes?: string | null;
  created_at: string;
  ready_for_pickup_at?: string | null;
  released_at?: string | null;
  requester?: {
    name: string;
    email?: string | null;
    department?: { name: string } | null;
  } | null;
  assignee?: { name: string } | null;
  record?: {
    record_code: string;
    title: string;
    department?: { name: string } | null;
  } | null;
};

export default function ClaimTicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ClaimRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTicket() {
      try {
        const data = await apiRequest(`/document-requests/${id}`);
        const nextRequest: ClaimRequest = data.request;
        const ticketAvailable =
          nextRequest.preferred_format === "printed" &&
          Boolean(nextRequest.claim_code) &&
          ["ready_for_pickup", "released"].includes(nextRequest.status);

        if (!ticketAvailable) {
          setError("A claim ticket becomes available only after an approved printed request is marked Ready for Pickup.");
          return;
        }

        setRequest(nextRequest);
      } catch (loadError: unknown) {
        const message = loadError instanceof Error
          ? loadError.message
          : "The claim ticket could not be loaded.";

        if (message.toLowerCase().includes("unauthenticated")) {
          router.replace("/login");
          return;
        }

        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadTicket();
  }, [id, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F0E8] dark:bg-[#181714]">
        <div className="flex items-center gap-3 text-sm font-semibold text-[#766F63]">
          <Loader2 className="h-5 w-5 animate-spin text-[#075A3A]" />
          Preparing claim ticket...
        </div>
      </main>
    );
  }

  if (!request || error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F0E8] px-4 dark:bg-[#181714]">
        <section className="w-full max-w-lg rounded-3xl bg-white p-7 text-center shadow-xl ring-1 ring-[#DED5C5]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3D6] text-[#A66B00]">
            <Clock3 className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-extrabold text-[#252A27]">Claim ticket unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-[#766F63]">{error}</p>
          <Link href="/document-requests" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6B0F2B] px-5 text-sm font-bold text-white hover:bg-[#571023]">
            <ArrowLeft className="h-4 w-4" />
            Back to requests
          </Link>
        </section>
      </main>
    );
  }

  const released = request.status === "released";

  return (
    <main className={`${styles.sheet} min-h-screen bg-[#F4F0E8] px-4 py-5 dark:bg-[#181714] sm:px-6 sm:py-8 print:min-h-0 print:bg-white print:p-0`}>
      <div className="mx-auto mb-5 flex w-full max-w-4xl items-center justify-between gap-3 print:hidden">
        <Link href="/document-requests" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#D7CDBB] bg-white px-4 text-sm font-semibold text-[#514D46] shadow-sm hover:bg-[#FCFAF5]">
          <ArrowLeft className="h-4 w-4" />
          Back to requests
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#6B0F2B] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#571023]"
          >
            <Printer className="h-4 w-4" />
            Print Ticket
          </button>
        </div>
      </div>

      <article className={`${styles.ticket} mx-auto w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-[#CFC4B1] print:max-w-none print:rounded-none print:shadow-none print:ring-0`}>
        <div className="h-2 bg-gradient-to-r from-[#075A3A] via-[#D9961A] to-[#6B0F2B] print:h-1.5" />

        <header className="relative overflow-hidden bg-[#075A3A] px-6 py-6 text-white sm:px-9 sm:py-8 print:px-6 print:py-4">
          <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#D9961A]/20 blur-2xl print:hidden" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between print:flex-row print:items-start print:justify-between print:gap-3">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D9961A] text-white ring-1 ring-white/20 print:h-9 print:w-9 print:rounded-lg">
                  <TicketCheck className="h-6 w-6 print:h-5 print:w-5" />
                </span>
                <div>
                  <p className="text-xl font-extrabold tracking-wide print:text-lg">IRAM</p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F4C25E] print:text-[8px]">Integrated Records and Archive Management</p>
                </div>
              </div>
              <h1 className="mt-5 text-2xl font-extrabold tracking-tight print:mt-3 print:text-xl">Official Document Claim Ticket</h1>
              <p className="mt-1 text-xs leading-5 text-[#E5DDCC] print:text-[10px] print:leading-4">Present this ticket and a valid identification document at the Records Office.</p>
            </div>
            <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide print:px-2.5 print:py-1 print:text-[9px] ${released ? "bg-white/15 text-white" : "bg-[#F4C25E] text-[#4B3410]"}`}>
              {released ? "Released" : "Ready for Pickup"}
            </span>
          </div>
        </header>

        <section className="border-b border-dashed border-[#CFC4B1] bg-[#FFF9EA] px-6 py-6 text-center sm:px-9 print:px-6 print:py-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#A66B00]">Claim Code</p>
          <p className="mt-2 break-all font-mono text-2xl font-black tracking-[0.08em] text-[#6B0F2B] sm:text-3xl print:mt-1 print:text-xl">{request.claim_code}</p>
          <p className="mt-2 text-xs text-[#766F63] print:mt-1 print:text-[9px]">Quick lookup reference | Request #{String(request.id).padStart(6, "0")}</p>
        </section>

        <div className="p-6 sm:p-9 print:p-5">
          <section className="grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
            <TicketDetail icon={<UserRound className="h-4 w-4" />} label="Claimant" value={request.requester?.name || "Not available"} subvalue={request.requester?.email || undefined} />
            <TicketDetail icon={<ShieldCheck className="h-4 w-4" />} label="Department" value={request.requester?.department?.name || "Not assigned"} />
            <TicketDetail icon={<FileText className="h-4 w-4" />} label="Requested document" value={request.record?.title || "Archived document"} subvalue={request.record?.record_code} />
            <TicketDetail icon={<CalendarDays className="h-4 w-4" />} label="Ready date" value={formatDateTime(request.ready_for_pickup_at)} subvalue={`Prepared by ${request.assignee?.name || "Records Office"}`} />
          </section>

          <section className="mt-6 rounded-2xl border border-[#E3DCCE] bg-[#FCFAF5] p-5 print:mt-3 print:rounded-xl print:p-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#2D332F] print:text-xs">
              <MapPin className="h-5 w-5 text-[#075A3A] print:h-4 print:w-4" />
              Pickup instructions
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#625E56] print:mt-1.5 print:text-[10px] print:leading-4">
              {request.review_notes || "Proceed to the Records Office during official office hours. Present this claim ticket and a valid ID to the assigned Records Officer."}
            </p>
          </section>

          <section className="mt-6 rounded-2xl border-2 border-[#075A3A] p-5 print:mt-3 print:rounded-xl print:p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[#075A3A] print:text-xs">Records Office Use Only</p>
                <p className="mt-1 text-[11px] text-[#766F63] print:text-[9px]">Complete this section when releasing the printed document.</p>
              </div>
              <CheckCircle2 className="h-7 w-7 text-[#075A3A] print:h-5 print:w-5" />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2 print:mt-3 print:grid-cols-2 print:gap-x-5 print:gap-y-3">
              <CheckLine label="Claim code verified" />
              <CheckLine label="Valid ID verified" />
              <SignatureLine label="Recipient signature" />
              <SignatureLine label="Released by" />
              <SignatureLine label="Date and time released" />
              <SignatureLine label="Official remarks" />
            </div>
          </section>

          <footer className="mt-6 flex flex-col gap-2 border-t border-[#E3DCCE] pt-4 text-[10px] leading-4 text-[#928875] sm:flex-row sm:items-center sm:justify-between print:mt-3 print:flex-row print:items-center print:justify-between print:pt-2 print:text-[8px] print:leading-3">
            <p>This ticket is valid only for the request and claimant shown above. It is not proof of release until confirmed in IRAM.</p>
            <p className="shrink-0 font-semibold">Generated {formatDateTime(new Date().toISOString())}</p>
          </footer>
        </div>
      </article>
    </main>
  );
}

function TicketDetail({ icon, label, value, subvalue }: { icon: React.ReactNode; label: string; value: string; subvalue?: string }) {
  return (
    <div className="rounded-xl border border-[#E3DCCE] p-4 print:rounded-lg print:p-2.5">
      <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wider text-[#A09582]">
        <span className="text-[#D9961A]">{icon}</span>
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-bold text-[#2D332F] print:mt-1 print:text-xs">{value}</p>
      {subvalue && <p className="mt-1 break-words text-xs text-[#766F63] print:text-[9px]">{subvalue}</p>}
    </div>
  );
}

function CheckLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-xs font-semibold text-[#514D46] print:gap-2 print:text-[10px]">
      <span className="h-5 w-5 shrink-0 rounded border-2 border-[#766F63] print:h-4 print:w-4" />
      {label}
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="pt-5 print:pt-3">
      <div className="border-b border-[#766F63]" />
      <p className="mt-1 text-[10px] font-semibold text-[#766F63] print:text-[8px]">{label}</p>
    </div>
  );
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
