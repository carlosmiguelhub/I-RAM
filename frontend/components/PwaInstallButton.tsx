"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

export default function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    function handleInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }

    function handleInstalled() {
      setInstallPrompt(null);
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleInstallPrompt
    );
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleInstallPrompt
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (!installPrompt) return null;

  async function install() {
    await installPrompt?.prompt();
    await installPrompt?.userChoice;
    setInstallPrompt(null);
  }

  return (
    <button
      type="button"
      onClick={() => void install()}
      className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#CFE0D6] bg-[#F0F7F3] px-2.5 text-xs font-bold text-[#075A3A] transition hover:border-[#91BAA3] hover:bg-[#E6F2EC] dark:border-[#33445E] dark:bg-[#172337] dark:text-[#79D6A8] dark:hover:bg-[#223149] sm:px-3"
      title="Install IRAM on this device"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Install</span>
    </button>
  );
}
