import type { ReactNode } from "react";

// Title row — sits inside the page's own max-width wrapper (PageContent),
// directly above the work surface. Search/notifications/avatar live in the
// page-agnostic TopBar instead, rendered once by the gated layout.
export function PageHeader({
  title,
  context,
  actions,
}: {
  title: string;
  context?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-[36px] shrink-0 items-center justify-between gap-4">
      <div className="flex min-w-0 items-baseline gap-3">
        {/* One title weight on every page. */}
        <h1 className="truncate text-[24px] font-extrabold tracking-[-0.02em] text-[var(--ink-primary)]">
          {title}
        </h1>
        {context ? <span className="shrink-0 text-[14px] text-[var(--ink-secondary)]">{context}</span> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  );
}
