"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock3, Loader2, MailCheck, RefreshCcw, ShieldCheck } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { apiRequest } from "@/lib/api";
import { getErrorMessage } from "@/lib/types";

type VerificationState = "instructions" | "verifying" | "verified" | "error";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerificationLoading />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const verificationStarted = useRef(false);
  const id = searchParams.get("id");
  const hash = searchParams.get("hash");
  const expires = searchParams.get("expires");
  const signature = searchParams.get("signature");
  const hasVerificationLink = Boolean(id && hash && expires && signature);
  const [state, setState] = useState<VerificationState>(
    hasVerificationLink ? "verifying" : "instructions"
  );
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");

  useEffect(() => {
    if (!hasVerificationLink || verificationStarted.current) return;
    verificationStarted.current = true;

    async function verify() {
      try {
        const query = new URLSearchParams({
          expires: expires as string,
          signature: signature as string,
        });
        const data = await apiRequest(
          `/email/verify/${encodeURIComponent(id as string)}/${encodeURIComponent(hash as string)}?${query}`,
          { method: "GET" }
        );
        setMessage(data.message);
        setState("verified");
      } catch (verificationError: unknown) {
        setMessage(
          getErrorMessage(
            verificationError,
            "This verification link is invalid or has expired."
          )
        );
        setState("error");
      }
    }

    verify();
  }, [expires, hash, hasVerificationLink, id, signature]);

  async function resendVerification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResending(true);
    setResendMessage("");
    setResendError("");

    try {
      const data = await apiRequest("/email/verification-notification", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setResendMessage(data.message);
    } catch (resendRequestError: unknown) {
      setResendError(
        getErrorMessage(resendRequestError, "Unable to resend the verification email.")
      );
    } finally {
      setResending(false);
    }
  }

  const content = {
    instructions: {
      icon: <MailCheck className="h-8 w-8" />,
      eyebrow: "Check your inbox",
      title: "Verify your email address",
      description: searchParams.get("sent")
        ? "Your IRAM account was created. We sent a verification link to your email address."
        : "Open the verification link sent to your email address to continue setting up your account.",
    },
    verifying: {
      icon: <Loader2 className="h-8 w-8 animate-spin" />,
      eyebrow: "Please wait",
      title: "Verifying your email",
      description: "We are securely checking your verification link.",
    },
    verified: {
      icon: <CheckCircle2 className="h-8 w-8" />,
      eyebrow: "Email verified",
      title: "Verification complete",
      description: message || "Your email address has been verified successfully.",
    },
    error: {
      icon: <Clock3 className="h-8 w-8" />,
      eyebrow: "Link unavailable",
      title: "We could not verify this link",
      description: message,
    },
  }[state];

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F4F0E8] px-4 py-8 dark:bg-[#181714]">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#D9961A]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-[#075A3A]/20 blur-3xl" />
      <div className="absolute right-5 top-5 z-10"><ThemeToggle compact /></div>

      <section className="relative w-full max-w-xl overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl ring-1 ring-[#DED5C5] dark:bg-[#24221E] dark:ring-[#454139] sm:p-10">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#075A3A] via-[#D9961A] to-[#6B0F2B]" />
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E6F2EC] text-[#075A3A] ring-1 ring-[#CFE0D6]">
          {content.icon}
        </div>
        <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-[#D9961A]">{content.eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold text-[#252A27] sm:text-3xl">{content.title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#766F63]">{content.description}</p>

        {state === "verified" && (
          <div className="mt-6 rounded-2xl border border-[#E7D3A2] bg-[#FFF9EA] p-4 text-left">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#D9961A]" />
              <div>
                <p className="text-sm font-bold text-[#2D332F]">Account activation is still required</p>
                <p className="mt-1 text-xs leading-5 text-[#766F63]">
                  Please contact an Administrator. You cannot sign in or access IRAM features until they approve your account.
                </p>
              </div>
            </div>
          </div>
        )}

        {(state === "instructions" || state === "error") && (
          <form onSubmit={resendVerification} className="mt-6 rounded-2xl border border-[#E3DCCE] bg-[#FCFAF5] p-4 text-left">
            <label htmlFor="resend-email" className="text-sm font-semibold text-[#514D46]">Need a new verification link?</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                id="resend-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#E3DCCE] bg-white px-4 text-sm outline-none focus:border-[#075A3A] focus:ring-4 focus:ring-[#E6F2EC]"
              />
              <button
                type="submit"
                disabled={resending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#075A3A] px-4 text-sm font-bold text-white transition-colors hover:bg-[#043D28] disabled:opacity-60"
              >
                {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Resend
              </button>
            </div>
            {resendMessage && <p className="mt-3 text-xs leading-5 text-emerald-700">{resendMessage}</p>}
            {resendError && <p className="mt-3 text-xs leading-5 text-red-600">{resendError}</p>}
          </form>
        )}

        {state !== "verifying" && (
          <Link href="/login" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#6B0F2B] px-6 text-sm font-bold text-white transition-colors hover:bg-[#571023]">
            Back to sign in
          </Link>
        )}
      </section>
    </main>
  );
}

function VerificationLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F0E8] dark:bg-[#181714]">
      <Loader2 className="h-8 w-8 animate-spin text-[#075A3A]" />
    </main>
  );
}
