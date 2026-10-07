import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-hairline bg-panel p-4 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, index }: { children: ReactNode; index: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <span className="font-mono text-[11px] text-dim">{index}</span>
      <h2 className="font-mono text-[11px] font-medium tracking-[0.18em] text-faint uppercase">{children}</h2>
      <span className="h-px flex-1 bg-hairline" aria-hidden />
    </div>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded border border-hairline px-1.5 py-0.5 font-mono text-[11px] tracking-wide text-faint">
      {children}
    </span>
  );
}

export function ApprovalCard({
  title,
  impact,
  onApprove,
  onReject,
}: {
  title: string;
  impact: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-lg border border-ink/40 bg-raised p-4">
      <p className="mb-1 font-mono text-[11px] tracking-[0.18em] text-ink uppercase">
        Requiere aprobación
      </p>
      <strong className="text-sm">{title}</strong>
      <p className="mt-1 mb-3 text-sm text-faint">{impact}</p>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-transform active:scale-[0.98]"
        >
          Aprobar
        </button>
        <button
          onClick={onReject}
          className="rounded-md border border-hairline px-3 py-1.5 text-sm transition-transform active:scale-[0.98]"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action: string }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline p-8 text-center">
      <p className="mb-1 font-medium">{title}</p>
      <p className="mb-3 text-sm text-faint">{hint}</p>
      <span className="font-mono text-xs tracking-wide underline underline-offset-4">{action} →</span>
    </div>
  );
}
