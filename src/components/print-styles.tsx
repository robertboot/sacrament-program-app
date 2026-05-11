// Shared <style> tag for print layouts. Drop into any page that should print well.
export function PrintStyles() {
  return (
    <style>{`
      @media print {
        body { background: white !important; }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        .print-page-break { page-break-after: always; break-after: page; }
        .print-back-page { page-break-before: always; break-before: page; }
        .print-avoid-break { page-break-inside: avoid; break-inside: avoid; }
      }
      .print-only { display: none; }
      @page {
        size: Letter portrait;
        margin: 0.5in;
      }
    `}</style>
  );
}
