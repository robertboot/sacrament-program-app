"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Printer, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Toolbar shown above the printed bulletin on the public share page.
 *  - Close  → window.close() if opened in a new tab, otherwise history.back()
 *  - Print  → window.print()
 *  - Share  → Web Share API if available, otherwise copy-to-clipboard fallback
 */
export function PublicViewToolbar({ title }: { title: string }) {
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
    <div className="grid grid-cols-3 gap-2 max-w-[7.5in] mx-auto px-4 mb-4 no-print">
      <Button variant="outline" size="sm" onClick={close}>
        <ArrowLeft className="w-4 h-4" />
        Close
      </Button>
      <Button size="sm" onClick={() => window.print()}>
        <Printer className="w-4 h-4" />
        Print
      </Button>
      <Button variant="outline" size="sm" onClick={share} disabled={pending}>
        <Share2 className="w-4 h-4" />
        Share
      </Button>
    </div>
  );
}
