"use client";

import { usePathname } from "next/navigation";

/**
 * Site-wide disclaimer required because this is an independent member project,
 * not an official Church property. Appears at the bottom of every page —
 * authenticated app, public bulletin, confirm page, privacy, terms.
 *
 * Suppressed on /home, which inlines its own disclaimer directly below the
 * version number, on /asthma (a standalone personal tool with no Church
 * connection), and on print so it doesn't clutter the bulletin handout.
 */
export function SiteDisclaimer() {
  const path = usePathname();
  if (path === "/home" || path.startsWith("/asthma")) return null;

  return (
    <footer className="no-print mt-auto border-t bg-muted/30">
      <div className="max-w-4xl mx-auto px-4 py-4 text-[11px] leading-relaxed text-muted-foreground text-center">
        This is not an official website of The Church of Jesus Christ of
        Latter-day Saints. This site is operated independently by a member and
        does not represent or imply endorsement by the Church.
      </div>
    </footer>
  );
}
