"use client";

import { createPortal } from "react-dom";
import {
  Check,
  CheckCircle2,
  FileSearch2,
  LoaderCircle,
  Send,
  ShieldCheck,
} from "lucide-react";

export type RequestProgressStage =
  | "validating"
  | "submitting"
  | "notifying"
  | "success";

const steps = [
  {
    label: "Validating request",
    detail: "Checking purpose and access details",
    icon: FileSearch2,
  },
  {
    label: "Sending securely",
    detail: "Registering your document request",
    icon: Send,
  },
  {
    label: "Notifying records office",
    detail: "Preparing the request for review",
    icon: ShieldCheck,
  },
];

export default function DocumentRequestProgressOverlay({
  open,
  stage,
  documentTitle,
}: {
  open: boolean;
  stage: RequestProgressStage;
  documentTitle: string;
}) {
  if (!open || typeof document === "undefined") return null;

  const currentStep =
    stage === "validating"
      ? 0
      : stage === "submitting"
        ? 1
        : stage === "notifying"
          ? 2
          : 3;
  const progress = ["24%", "57%", "86%", "100%"][currentStep];
  const isSuccess = stage === "success";

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-[#071710]/80 p-4 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={
        isSuccess
          ? "Document request submitted"
          : "Submitting document request"
      }
    >
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl dark:border-[#33445E] dark:bg-[#172337]">
        <header className="bg-[#075A3A] px-6 pb-6 pt-7 text-center text-white">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            {!isSuccess && (
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/20 border-t-[#F4C25E]" />
            )}
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-lg transition duration-300 ${
                isSuccess
                  ? "scale-110 bg-[#F4C25E] text-[#043D28]"
                  : "bg-white/10 text-[#F4C25E] ring-1 ring-white/20"
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="h-7 w-7" />
              ) : (
                <LoaderCircle className="h-6 w-6 animate-pulse" />
              )}
            </span>
          </div>
          <h2 className="mt-4 text-xl font-extrabold">
            {isSuccess
              ? "Request submitted"
              : "Submitting your request"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm truncate text-sm text-[#D5E5DC]">
            {isSuccess
              ? "Your request is now ready for Records Office review."
              : documentTitle}
          </p>
        </header>

        <div className="p-5 sm:p-6">
          <div className="h-2 overflow-hidden rounded-full bg-[#E9E4DB] dark:bg-[#26354A]">
            <div
              className="relative h-full rounded-full bg-[#D9961A] transition-[width] duration-500 ease-out"
              style={{ width: progress }}
            >
              {!isSuccess && (
                <span className="absolute inset-0 animate-pulse bg-white/25" />
              )}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const complete = isSuccess || index < currentStep;
              const active = index === currentStep;

              return (
                <div
                  key={step.label}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                    active
                      ? "bg-[#F0F7F3] ring-1 ring-[#CFE0D6] dark:bg-[#1C2A40] dark:ring-[#33445E]"
                      : ""
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      complete
                        ? "bg-[#075A3A] text-white"
                        : active
                          ? "bg-[#FFF3D6] text-[#A66B00]"
                          : "bg-[#F0ECE4] text-[#9A9388] dark:bg-[#223149]"
                    }`}
                  >
                    {complete ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[#2D332F] dark:text-[#EDF2F8]">
                      {step.label}
                    </span>
                    <span className="block text-xs text-[#766F63] dark:text-[#9FADBF]">
                      {step.detail}
                    </span>
                  </span>
                  {active && !isSuccess && (
                    <span className="ml-auto flex gap-1">
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D9961A]"
                          style={{ animationDelay: `${dot * 120}ms` }}
                        />
                      ))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A9388]">
            Please keep this window open
          </p>
        </div>
      </section>
    </div>,
    document.body
  );
}
