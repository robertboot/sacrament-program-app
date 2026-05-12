"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { CalendarDays, Users, BookOpen, Megaphone, Settings } from "lucide-react";
import type { UserRole } from "@/lib/supabase/types";

const ITEMS = [
  { href: "/", label: "Sundays", icon: CalendarDays, bishopricOnly: false },
  { href: "/speakers", label: "Speakers", icon: Users, bishopricOnly: true },
  { href: "/topics", label: "Topics", icon: BookOpen, bishopricOnly: true },
  { href: "/events", label: "Events", icon: Megaphone, bishopricOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, bishopricOnly: true },
];

/**
 * Fixed bottom tab bar shown only on small screens. Mirrors the desktop top
 * nav items so navigation is one tap away on iPhone. Respects the iOS home
 * indicator via env(safe-area-inset-bottom).
 */
export function MobileTabBar({ role }: { role: UserRole }) {
  const path = usePathname();
  const visible = ITEMS.filter((i) => role === "bishopric" || !i.bishopricOnly);

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 no-print"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around">
        {visible.map((item) => {
          const Icon = item.icon;
          const active =
            path === item.href || (item.href !== "/" && path.startsWith(item.href));
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] font-medium transition-colors min-h-[3.5rem]",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform",
                    active && "scale-110",
                  )}
                  strokeWidth={active ? 2.4 : 1.9}
                />
                <span className="tracking-tight">{item.label}</span>
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
