"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { toZoomedPosition } from "@/lib/cssZoom";

// A small floating label for an icon-only control that already carries its
// own aria-label (this is purely a sighted-user hint, not what makes the
// control accessible) — shown on hover or keyboard focus after a short
// delay so it doesn't flash on every passing mouse movement.
//
// Portaled to document.body and positioned from the trigger's own
// getBoundingClientRect() (fixed coords) rather than absolutely within the
// trigger itself — the trigger often sits inside a panel with
// overflow-hidden (for its rounded corners), which would otherwise clip a
// tooltip wider than the icon it's attached to.
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  function show() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPosition(toZoomedPosition({ top: rect.top - 6, left: rect.left + rect.width / 2 }));
      setOpen(true);
    }, 300);
  }
  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }

  return (
    <span ref={triggerRef} className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              className="pointer-events-none fixed z-[80] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[6px] bg-[#18181B] px-2 py-1 text-[12px] font-medium text-white shadow-[var(--shadow-panel)]"
              style={{ top: position.top, left: position.left }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
