"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Copy, Mail } from "lucide-react";
import { PageHeader } from "@/components/carrier/PageHeader";
import { SUPPORT_EMAIL } from "@/lib/support";
import { filterHelp, type HelpItem, type HelpSection } from "@/lib/helpSearch";
import { useHelpQuery } from "./helpQuery";

// The Help page: questions and answers grouped by topic, and a card with the
// support email (copy or write). The top bar's search filters the questions
// here (see helpQuery; ?q= on first load) — the page has no search field of
// its own.
export function HelpCenter() {
  const t = useTranslations("carrier.help");
  const sections = t.raw("sections") as HelpSection[];
  const urlQuery = useSearchParams().get("q") ?? "";
  const query = (useHelpQuery() ?? urlQuery).trim();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const searching = query.length > 0;
  const visible = useMemo(() => filterHelp(sections, query), [sections, query]);

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      <PageHeader title={t("title")} bold />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="lg:sticky lg:top-0 lg:order-2">
          <SupportCard />
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          {visible.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-card-bg)] px-6 py-10 text-center">
              <p className="text-[15px] font-semibold text-[var(--ink-primary)]">{t("noResults", { query })}</p>
              <p className="mt-1 text-[13.5px] text-[var(--ink-secondary)]">{t("noResultsHint")}</p>
            </div>
          ) : (
            visible.map((section) => (
              <section key={section.id} aria-labelledby={`help-${section.id}`}>
                <h2
                  id={`help-${section.id}`}
                  className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-eyebrow)]"
                >
                  {section.title}
                </h2>
                <div className="overflow-hidden rounded-[12px] border border-[var(--border-hairline)] bg-[var(--surface-card-bg)] shadow-[var(--shadow-surface-card)]">
                  {section.items.map((item, index) => {
                    // A search opens every match; otherwise each question
                    // opens on click.
                    const key = `${section.id}:${item.q}`;
                    return (
                      <Question
                        key={key}
                        item={item}
                        first={index === 0}
                        open={searching || open.has(key)}
                        onToggle={() => toggle(key)}
                        disabled={searching}
                      />
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function Question({
  item,
  first,
  open,
  onToggle,
  disabled,
}: {
  item: HelpItem;
  first: boolean;
  open: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <div className={first ? "" : "border-t border-[var(--border-hairline)]"}>
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={onToggle}
          disabled={disabled}
          className="flex w-full items-center gap-4 px-5 py-4 text-left text-[14.5px] font-medium text-[var(--ink-primary)] transition-colors duration-[.12s] ease-out hover:bg-[var(--bg-subtle)] disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span className="min-w-0 flex-1">{item.q}</span>
          <ChevronDown
            size={17}
            strokeWidth={1.9}
            aria-hidden
            className={`shrink-0 text-[var(--ink-muted)] transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h3>
      <div
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        inert={!open}
      >
        <div className="overflow-hidden">
          <p className="max-w-[680px] px-5 pb-4 text-[14px] leading-[1.6] text-[var(--ink-body)]">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

// The support email, shown in full so it can be read or selected, with a
// button that copies it and a link that opens the mail app.
function SupportCard() {
  const t = useTranslations("carrier.help");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      ok = true;
    } catch {
      // Older browsers / no clipboard permission: copy via a selection.
      const field = document.createElement("textarea");
      field.value = SUPPORT_EMAIL;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      field.remove();
    }
    setState(ok ? "copied" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="rounded-[14px] border border-[var(--border-hairline)] bg-[var(--surface-card-bg)] p-5 shadow-[var(--shadow-surface-card)]">
      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--select-tint)] text-[var(--action-bg)]">
        <Mail size={19} strokeWidth={1.9} aria-hidden />
      </span>
      <h2 className="mt-4 text-[16px] font-semibold text-[var(--ink-primary)]">{t("contactTitle")}</h2>
      <p className="mt-1 text-[13.5px] leading-[1.55] text-[var(--ink-secondary)]">{t("contactBody")}</p>

      <p className="mt-4 text-[12.5px] font-medium text-[var(--ink-secondary)]">{t("emailLabel")}</p>
      <div className="mt-[6px] flex h-[42px] items-center gap-2 rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)] pl-3 pr-[5px]">
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="min-w-0 flex-1 truncate text-[14px] font-medium text-[var(--ink-primary)] hover:text-[var(--action-bg)] hover:underline"
        >
          {SUPPORT_EMAIL}
        </a>
        <button
          type="button"
          onClick={copy}
          className={`flex h-8 shrink-0 items-center gap-[6px] rounded-[7px] px-[10px] text-[13px] font-medium transition-colors duration-[.12s] ease-out ${
            state === "copied"
              ? "bg-[var(--status-completed-bg)] text-[var(--status-completed-text)]"
              : "bg-[var(--surface-card-bg)] text-[var(--ink-primary)] shadow-[var(--shadow-pill)] hover:bg-[var(--menu-item-hover)]"
          }`}
        >
          {state === "copied" ? <Check size={14} strokeWidth={2.2} aria-hidden /> : <Copy size={14} strokeWidth={1.9} aria-hidden />}
          {state === "copied" ? t("copied") : t("copyEmail")}
        </button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? t("copied") : ""}
      </p>
      {state === "failed" ? <p className="mt-2 text-[12.5px] text-[var(--ink-destructive)]">{t("copyFailed")}</p> : null}

      <a
        href={`mailto:${SUPPORT_EMAIL}`}
        className="mt-3 flex h-[38px] w-full items-center justify-center gap-[6px] rounded-[9px] bg-[var(--action-bg)] text-[14px] font-medium text-white transition-colors duration-[.12s] ease-out hover:bg-[var(--action-bg-hover)]"
      >
        <Mail size={16} strokeWidth={1.9} aria-hidden />
        {t("writeEmail")}
      </a>
      <p className="mt-3 text-[12.5px] leading-[1.5] text-[var(--ink-muted)]">{t("contactTip")}</p>
    </div>
  );
}
