"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarDays, Users, BookOpen, Megaphone, Settings, LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import type { UserRole } from "@/lib/supabase/types";

const ITEMS = [
  { href: "/", label: "Dashboard", icon: CalendarDays, bishopricOnly: false },
  { href: "/speakers", label: "Speakers", icon: Users, bishopricOnly: true },
  { href: "/topics", label: "Topics", icon: BookOpen, bishopricOnly: true },
  { href: "/events", label: "Events", icon: Megaphone, bishopricOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, bishopricOnly: true },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppNav({ role, fullName }: { role: UserRole; fullName: string }) {
  const path = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const visibleItems = ITEMS.filter((i) => role === "bishopric" || !i.bishopricOnly);

  return (
    <header className="border-b sticky top-0 bg-background z-30">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <BrandMark
            className="w-7 h-7 text-primary"
            accentClassName="text-[var(--brand-gold)]"
          />
          <span>Rameumptom</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 ml-6 flex-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = path === item.href || (item.href !== "/" && path.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm",
                  active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              <span className="hidden md:inline">{fullName}</span>
              <span
                className="md:hidden inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                aria-hidden
              >
                {initials(fullName)}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {fullName} · {role === "bishopric" ? "Leadership" : "Chorister"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
