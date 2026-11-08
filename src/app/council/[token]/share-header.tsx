"use client";

export function ShareHeader({ kindLabel }: { kindLabel: string }) {
  return (
    <div className="no-print px-4 py-3 flex items-center gap-3 border-b bg-background">
      <div className="text-sm font-semibold">{kindLabel} agenda</div>
      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto text-sm underline"
      >
        Print
      </button>
    </div>
  );
}
