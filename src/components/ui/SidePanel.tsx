"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { ASSISTANT_DOCK_WIDTH, useAssistantDocked } from "@/components/carrier/assistant/assistantDock";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A right-edge slide-in panel that overlays the page without dimming it —
// unlike a centered modal, whatever's behind (the calendar, specifically)
// stays fully visible, legible and interactive while the panel is open.
// Deliberately no backdrop/scrim and no click-outside-to-close: a full-page
// click-catcher would block interacting with the page behind it, and the
// calendar needs to stay live (e.g. scrolling to a date picked in a form)
// while a panel is open. Close via the panel's own close control or Escape.
export function SidePanel({
  onClose,
  label,
  children,
}: {
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  // Mounted one tick after the initial (off-screen) paint, then flipped to
  // its resting position — a plain CSS transition needs the "closed" state
  // to actually paint before switching to "open" for the slide-in to show.
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // While the assistant is pinned to the right, this panel opens in that same
  // column, over the chat, with a way back to it — the calendar keeps its
  // width instead of being covered by a second right-hand panel.
  const assistantDocked = useAssistantDocked();
  const t = useTranslations("carrier.assistant");

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Seed focus into the panel once it's finished sliding in, and hand it
  // back to whatever opened the panel when it unmounts.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      focusable?.focus();
    }, 220);
    return () => {
      clearTimeout(timer);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={`fixed top-2 bottom-2 right-2 z-40 flex w-full flex-col overflow-hidden rounded-panel border border-[var(--border-container)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)] transition-transform duration-[.22s] ease-[cubic-bezier(.32,.72,0,1)] ${
        assistantDocked ? "" : "max-w-[480px]"
      } ${entered ? "translate-x-0" : "translate-x-full"}`}
      style={assistantDocked ? { maxWidth: ASSISTANT_DOCK_WIDTH } : undefined}
    >
      {assistantDocked ? (
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 shrink-0 items-center gap-[6px] border-b border-[#F0F0F2] bg-[var(--bg-subtle)] px-4 text-[13px] font-semibold text-[var(--action-bg)] hover:bg-[var(--select-tint)]"
        >
          <ArrowLeft size={14} strokeWidth={2.2} aria-hidden />
          {t("backToAssistant")}
        </button>
      ) : null}
      {children}
    </div>
  );
}
