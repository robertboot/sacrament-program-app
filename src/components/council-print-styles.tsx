import type { CouncilKind } from "@/lib/supabase/types";

/**
 * Per-view print CSS for the council agenda renderer.
 *
 * Each council view (editor preview, public share, print output) renders
 * exactly one agenda, so we're free to set `@page` to whichever
 * orientation that agenda needs. BC gets portrait; BYC gets landscape
 * with zero margin so the booklet fills the full 11×8.5 sheet.
 *
 * The booklet uses `transform: rotate(180deg)` on page 2's content so
 * long-edge duplex printing lands the inside spread right-side-up.
 * Firefox rejects CSS transforms during print; Chromium and Safari honor
 * them, so the printer target is browser print via a Chromium-based
 * browser (matches the owner's existing workflow).
 */
export function CouncilPrintStyles({ kind }: { kind: CouncilKind }) {
  if (kind === "branch_council") {
    return (
      <style>{`
        @page { size: Letter portrait; margin: 0.8in; }
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .council-print { max-width: none !important; padding: 0 !important; }
        }
      `}</style>
    );
  }
  return (
    <style>{`
      @page { size: Letter landscape; margin: 0; }
      @media print {
        body { background: white !important; margin: 0 !important; }
        .no-print { display: none !important; }
      }
      .council-byc { font-size: 9pt; color: black; }
      .byc-page {
        position: relative;
        width: 11in;
        height: 8.5in;
        display: flex;
        page-break-after: always;
        break-after: page;
        overflow: hidden;
      }
      .byc-page:last-child {
        page-break-after: auto;
      }
      .byc-page-2 .byc-page-2-inner {
        width: 11in;
        height: 8.5in;
        display: flex;
        transform: rotate(180deg);
        transform-origin: 50% 50%;
      }
      .byc-half {
        flex: 1 1 50%;
        padding: 0.45in 0.55in;
        position: relative;
        overflow: hidden;
      }
      .byc-fold {
        position: absolute;
        left: 50%;
        top: 0.3in;
        bottom: 0.3in;
        border-left: 1px dashed #b8bec7;
        pointer-events: none;
      }
      .byc-panel-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: #1e3a5f;
        padding-bottom: 0.15rem;
        border-bottom: 1px solid rgba(30,58,95,0.7);
        margin-bottom: 0.5rem;
      }
      .byc-watermark {
        position: absolute;
        inset: 0.5in 0.5in 0.5in 0.5in;
        background: url('/moroni-watermark.png') center center / contain no-repeat;
        opacity: 0.14;
        pointer-events: none;
      }
      @media screen {
        .council-byc {
          background: #f1f3f6;
          padding: 1rem;
          /* Scale down the 11in-wide booklet so it fits a phone / editor
             panel without clipping. zoom is honored by all current major
             browsers (Firefox since 126) and, unlike transform:scale,
             collapses the layout box. */
          zoom: 1;
        }
        .byc-page {
          background: white;
          margin: 0 auto 1rem auto;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }
      }
      @media screen and (max-width: 1280px) {
        .council-byc { zoom: 0.6; }
      }
      @media screen and (max-width: 900px) {
        .council-byc { zoom: 0.45; }
      }
      @media screen and (max-width: 640px) {
        .council-byc { zoom: 0.33; }
      }
    `}</style>
  );
}
