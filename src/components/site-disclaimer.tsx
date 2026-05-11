/**
 * Site-wide disclaimer required because this is an independent member project,
 * not an official Church property. Appears at the bottom of every page —
 * authenticated app, public bulletin, confirm page, privacy, terms.
 *
 * Hidden when printing (no-print) so it doesn't clutter the program handout.
 */
export function SiteDisclaimer() {
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
