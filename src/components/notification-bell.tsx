"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { Bell, Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Notification } from "@/lib/supabase/types";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications-actions";

const REFRESH_MS = 60_000; // poll once a minute; keeps it simple, no realtime.

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadedList, setLoadedList] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  // Cheap poll: only the unread count comes back on the interval. The
  // full 30-row list is fetched exactly when the dropdown opens (below).
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (cancelled) return;
      const n = await countUnreadNotifications();
      if (!cancelled) setUnreadCount(n);
    }
    tick();
    const id = setInterval(() => {
      // Skip the poll while the tab is backgrounded — iOS Safari
      // throttles it anyway, and we don't need fresh counts nobody's
      // looking at.
      if (typeof document !== "undefined" && document.hidden) return;
      tick();
    }, REFRESH_MS);
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) tick();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      cancelled = true;
      clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    // Lazy-load the actual row list the first time the dropdown opens
    // (and on every subsequent open, so it stays fresh).
    (async () => {
      const rows = await listNotifications();
      setItems(rows);
      setLoadedList(true);
      setUnreadCount(rows.filter((n) => !n.read_at).length);
    })();
  }, [open]);

  function handleItemClick(n: Notification) {
    if (!n.read_at) {
      setUnreadCount((c) => Math.max(0, c - 1));
      start(async () => {
        await markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((p) =>
            p.id === n.id ? { ...p, read_at: new Date().toISOString() } : p,
          ),
        );
      });
    }
    setOpen(false);
    if (n.action_url) router.push(n.action_url);
  }

  function handleMarkAll() {
    setUnreadCount(0);
    start(async () => {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((p) => ({ ...p, read_at: p.read_at ?? now })));
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "relative text-primary-foreground hover:bg-white/10 hover:text-primary-foreground",
        )}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 max-h-[70vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="text-sm font-semibold">Notifications</div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={pending}
              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {!loadedList ? (
            <p className="text-sm text-muted-foreground text-center py-6 px-3">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 px-3">
              You&rsquo;re all caught up.
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={cn(
                      "w-full text-left px-3 py-2 hover:bg-accent transition-colors block",
                      !n.read_at && "bg-blue-50/60 dark:bg-blue-950/20",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && (
                        <span
                          className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0"
                          aria-hidden
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium leading-tight">
                          {n.title}
                        </div>
                        {n.body && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {n.body}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {formatDistanceToNowStrict(parseISO(n.created_at), {
                            addSuffix: true,
                          })}
                        </div>
                      </div>
                      {n.read_at && (
                        <Check className="w-3 h-3 text-muted-foreground/40 mt-1 shrink-0" />
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t px-3 py-1.5">
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Notification settings →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
