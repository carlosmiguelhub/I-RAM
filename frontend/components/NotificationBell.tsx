"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  CircleAlert,
  FileCheck2,
  FileClock,
  Inbox,
  Loader2,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

type NotificationData = {
  title?: string;
  message?: string;
  type?: string;
  url?: string;
  actor?: {
    id?: number;
    name?: string;
    role?: string | null;
  };
};

type NotificationItem = {
  id: string;
  data: NotificationData;
  read_at: string | null;
  created_at: string;
};

type NotificationResponse = {
  notifications: NotificationItem[];
  unread_count: number;
};

export default function NotificationBell() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadNotifications(silent = false) {
    if (!silent) setLoading(true);

    try {
      const data: NotificationResponse = await apiRequest(
        "/notifications"
      );

      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
      setError("");
    } catch (requestError: unknown) {
      if (!silent) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Notifications could not be loaded."
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoadId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);
    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadNotifications(true);
      }
    }, 5000);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  async function openNotification(item: NotificationItem) {
    if (!item.read_at) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, read_at: new Date().toISOString() }
            : notification
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));

      try {
        const data = await apiRequest(
          `/notifications/${item.id}/read`,
          { method: "PATCH" }
        );
        setUnreadCount(data.unread_count ?? 0);
      } catch {
        void loadNotifications(true);
      }
    }

    setOpen(false);

    if (item.data.url) {
      router.push(item.data.url);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0) return;

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at || new Date().toISOString(),
      }))
    );
    setUnreadCount(0);

    try {
      await apiRequest("/notifications/read-all", {
        method: "PATCH",
      });
    } catch {
      void loadNotifications(true);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          if (!open) void loadNotifications(true);
        }}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#8B1538] px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[4.5rem] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[24rem]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="font-bold text-slate-950">Notifications</p>
              <p className="text-xs text-slate-500">
                {unreadCount > 0
                  ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                  : "You're all caught up"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#075A3A] transition hover:bg-[#F0F7F3] disabled:cursor-default disabled:opacity-40"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          </div>

          <div className="max-h-[min(70vh,32rem)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading notifications...
              </div>
            ) : error ? (
              <div className="px-4 py-10 text-center">
                <CircleAlert className="mx-auto h-7 w-7 text-red-500" />
                <p className="mt-2 text-sm text-red-700">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadNotifications()}
                  className="mt-3 text-sm font-semibold text-slate-900 underline"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-12 text-center text-slate-500">
                <Inbox className="mx-auto h-8 w-8" />
                <p className="mt-2 text-sm font-semibold">
                  No notifications yet
                </p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openNotification(item)}
                  className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50 ${
                    item.read_at ? "bg-white" : "bg-[#F7FBF8]"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${notificationColors(
                      item.data.type
                    )}`}
                  >
                    {item.data.type?.includes("approved") ||
                    item.data.type?.includes("archived") ||
                    item.data.type?.includes("released") ? (
                      <FileCheck2 className="h-4 w-4" />
                    ) : (
                      <FileClock className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {item.data.title || "IRAM update"}
                      </span>
                      {!item.read_at && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#8B1538]" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-600">
                      {item.data.message || "A workflow item was updated."}
                    </span>
                    <span className="mt-1 block text-[11px] font-medium text-slate-400">
                      {relativeTime(item.created_at)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function notificationColors(type?: string): string {
  if (type?.includes("rejected") || type?.includes("correction")) {
    return "bg-red-50 text-red-700";
  }

  if (
    type?.includes("approved") ||
    type?.includes("archived") ||
    type?.includes("released")
  ) {
    return "bg-emerald-50 text-emerald-700";
  }

  return "bg-amber-50 text-amber-700";
}

function relativeTime(value: string): string {
  const date = new Date(value);
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  );

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear()
        ? undefined
        : "numeric",
  }).format(date);
}
