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
import { CalendarDays, Users, BookOpen, Megaphone, Settings, LogOut, Menu } from "lucide-react";
import type { UserRole } from "@/lib/supabase/types";

const ITEMS = [
  { href: "/", label: "Dashboard", icon: CalendarDays, bishopricOnly: false },
  { href: "/speakers", label: "Speakers", icon: Users, bishopricOnly: true },
  { href: "/topics", label: "Topics", icon: BookOpen, bishopricOnly: true },
  { href: "/events", label: "Events", icon: Megaphone, bishopricOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, bishopricOnly: true },
];

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
        <Link href="/" className="font-semibold tracking-tight">
          Sacrament Planner
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
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "md:hidden")}
            >
              <Menu className="w-5 h-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {visibleItems.map((item) => (
                <DropdownMenuItem
                  key={item.href}
                  onClick={() => router.push(item.href)}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "hidden md:inline-flex",
              )}
            >
              {fullName}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {role === "bishopric" ? "Leadership" : "Chorister"}
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
