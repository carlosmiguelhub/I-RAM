"use client";

import { createPortal } from "react-dom";
import {
  Check,
  CheckCircle2,
  CloudUpload,
  FileCheck2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

export type SubmissionStage =
  | "preparing"
  | "uploading"
  | "finalizing"
  | "success";

const steps = [
  {
    label: "Preparing",
    detail: "Validating record information",
    icon: FileCheck2,
  },
  {
    label: "Uploading",
    detail: "Sending attachments securely",
    icon: CloudUpload,
  },
  {
    label: "Registering",
    detail: "Creating the official record",
    icon: ShieldCheck,
  },
];

export default function SubmissionProgressOverlay({
  open,
  stage,
  fileCount,
  action = "submit",
}: {
  open: boolean;
  stage: SubmissionStage;
  fileCount: number;
  action?: "submit" | "resubmit";
}) {
  if (!open || typeof document === "undefined") return null;

  const currentStep =
    stage === "preparing"
      ? 0
      : stage === "uploading"
        ? 1
        : stage === "finalizing"
          ? 2
          : 3;
  const progress =
    stage === "preparing"
      ? "22%"
      : stage === "uploading"
        ? "58%"
        : stage === "finalizing"
          ? "84%"
          : "100%";
  const title =
    stage === "success"
      ? action === "resubmit"
        ? "Record resubmitted"
        : "Submission received"
      : action === "resubmit"
        ? "Resubmitting your record"
        : "Submitting your record";
  const message =
    stage === "success"
      ? "Everything was saved successfully. Opening your records now."
      : stage === "preparing"
        ? "Checking the record details before upload."
        : stage === "uploading"
          ? `${fileCount} attachment${fileCount === 1 ? "" : "s"} ${
              fileCount === 1 ? "is" : "are"
            } being transferred securely.`
          : "Assigning the record number and completing the workflow.";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#071710]/80 p-4 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <section className="w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl dark:border-[#33445E] dark:bg-[#172337]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-6 pb-7 pt-8 text-center text-white">
          <span className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <span className="absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-white/5 blur-xl" />

          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            {stage !== "success" && (
              <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/15 border-t-[#F4C25E]" />
            )}
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition-all duration-300 ${
                stage === "success"
                  ? "scale-110 bg-emerald-400 text-[#043D28]"
                  : "bg-white/12 text-[#F4C25E] ring-1 ring-white/20"
              }`}
            >
              {stage === "success" ? (
                <CheckCircle2 className="h-7 w-7" />
              ) : (
                <LoaderCircle className="h-6 w-6 animate-pulse" />
              )}
            </span>
          </div>

          <h2 className="relative mt-4 text-xl font-extrabold">
            {title}
          </h2>
          <p className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-[#D5E5DC]">
            {message}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="h-2 overflow-hidden rounded-full bg-[#E9E4DB] dark:bg-[#26354A]">
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-[#075A3A] to-[#D9961A] transition-[width] duration-500 ease-out"
              style={{ width: progress }}
            >
              {stage !== "success" && (
                <span className="absolute inset-0 animate-pulse bg-white/20" />
              )}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const completed =
                stage === "success" || index < currentStep;
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
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                      completed
                        ? "bg-[#075A3A] text-white"
                        : active
                          ? "bg-[#FFF3D6] text-[#A66B00]"
                          : "bg-[#F0ECE4] text-[#9A9388] dark:bg-[#223149]"
                    }`}
                  >
                    {completed ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[#2D332F]">
                      {step.label}
                    </span>
                    <span className="block text-xs text-[#766F63]">
                      {step.detail}
                    </span>
                  </span>
                  {active && stage !== "success" && (
                    <span className="ml-auto flex gap-1">
                      {[0, 1, 2].map((dot) => (
                        <span
                          key={dot}
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#D9961A]"
                          style={{
                            animationDelay: `${dot * 120}ms`,
                          }}
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
