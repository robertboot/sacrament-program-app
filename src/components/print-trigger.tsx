"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import type { ComponentProps } from "react";

export function PrintTrigger({
  label = "Print",
  variant = "default",
  size = "default",
  className,
}: {
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  return (
    <Button onClick={() => window.print()} variant={variant} size={size} className={className}>
      <Printer className="w-4 h-4" />
      {label}
    </Button>
  );
}
