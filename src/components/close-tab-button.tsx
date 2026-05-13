"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Close button for printable views that were opened in a new tab. Tries to
 * close the tab first; if the browser won't let us (only tabs opened by
 * window.open can be auto-closed), falls back to navigating to `fallbackHref`.
 */
export function CloseTabButton({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        window.close();
        // If close() didn't work (tab not opened via JS), fall back to a route.
        setTimeout(() => {
          if (!window.closed) router.push(fallbackHref);
        }, 50);
      }}
    >
      <X className="w-4 h-4" />
      Close
    </Button>
  );
}
