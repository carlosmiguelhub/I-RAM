import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata = {
  title: "Offline | IRAM",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F0E8] px-4 dark:bg-[#07101F]">
      <section className="w-full max-w-md rounded-3xl border border-[#DED5C5] bg-white p-7 text-center shadow-xl dark:border-[#2B3A51] dark:bg-[#172337] sm:p-9">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E6F2EC] text-[#075A3A] dark:bg-[#1C2A40] dark:text-[#79D6A8]">
          <WifiOff className="h-7 w-7" />
        </span>
        <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-[#075A3A] dark:text-[#79D6A8]">
          Connection unavailable
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#252A27] dark:text-[#EDF2F8]">
          IRAM is offline
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#766F63] dark:text-[#9EACC0]">
          Connect this device to the IRAM local network, then try
          again. Records and confidential files are never stored for
          offline access.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#075A3A] px-5 text-sm font-bold text-white transition hover:bg-[#043D28]"
        >
          Try Again
        </Link>
      </section>
    </main>
  );
}
