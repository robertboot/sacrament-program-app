"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Eye, Printer, Share2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Toolbar shown above the printed bulletin on the public share page.
 *  - Close  → window.close() if opened in a new tab, otherwise history.back()
 *  - Print  → window.print()
 *  - Share  → Web Share API if available, otherwise copy-to-clipboard fallback
 */
export function PublicViewToolbar({
  title,
  conductorHref,
}: {
  title: string;
  /** When provided (signed-in viewer), shows a one-tap toggle to the
   *  matching conductor view of the same program. */
  conductorHref?: string | null;
}) {
  const [pending, setPending] = useState(false);

  function close() {
    // close() only works for tabs opened via script. If it fails, fall back.
    try {
      window.close();
    } catch {
      /* noop */
    }
    // If still open after 50ms, navigate back instead.
    setTimeout(() => {
      if (!window.closed) {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/";
      }
    }, 50);
  }

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        setPending(true);
        await navigator.share({ title, url });
      } catch {
        /* user cancelled or share failed — silent */
      } finally {
        setPending(false);
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <div className="max-w-[7.5in] mx-auto px-4 mb-4 no-print">
      <div className="mb-2">
        <h1 className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
          Public Program
        </h1>
        <p className="text-[11px] text-muted-foreground">
          The congregation-facing bulletin shared via the public link
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={close}>
          <ArrowLeft className="w-4 h-4" />
          Close
        </Button>
        {conductorHref && (
          <Link
            href={conductorHref}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            title="Switch to the conductor's detailed view"
          >
            <Eye className="w-4 h-4" />
            Conductor view
          </Link>
        )}
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4" />
          Print
        </Button>
        <Button variant="outline" size="sm" onClick={share} disabled={pending}>
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </div>
    </div>
  );
}
