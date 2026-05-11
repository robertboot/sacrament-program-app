"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintTrigger({ label = "Print" }: { label?: string }) {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="w-4 h-4" />
      {label}
    </Button>
  );
}
