"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useParams } from "next/navigation";
import { Globe, ChevronDown, Check } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LOCALE_NAMES: Record<string, string> = { en: "English", sr: "Srpski" };
// "Language" label, used for the menu trigger's aria-label ("Jezik: srpski"
// / "Language: English") — keyed by the *current* locale, since that's the
// language the label itself reads in, not the one being switched to.
const LANGUAGE_WORD: Record<string, string> = { en: "Language", sr: "Jezik" };

export function LocaleSwitcher({ variant = "select" }: { variant?: "select" | "menu" } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const current = (params.locale as string) ?? routing.defaultLocale;

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function closeAndRefocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!triggerRef.current?.parentElement?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    // Escape closes the menu no matter which element currently has focus
    // (a mouse click opens it without moving focus into an item, so the
    // per-item keydown handler alone wouldn't catch it).
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        closeAndRefocus();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectLocale(locale: string) {
    router.replace(pathname, { locale });
    closeAndRefocus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => itemRefs.current[0]?.focus());
    }
  }

  function onItemKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      itemRefs.current[(index + 1) % routing.locales.length]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      itemRefs.current[(index - 1 + routing.locales.length) % routing.locales.length]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  if (variant === "menu") {
    return (
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-label={`${LANGUAGE_WORD[current] ?? "Language"}: ${LOCALE_NAMES[current] ?? current}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={onTriggerKeyDown}
          className="locale-switcher-trigger flex h-9 items-center gap-2 rounded-control bg-white px-[10px] transition-colors hover:bg-[var(--bg-subtle)]"
        >
          <Globe size={16} strokeWidth={1.8} className="text-[var(--ink-secondary)]" />
          <span className="text-[14px] font-medium text-[var(--ink-2)]">{current.toUpperCase()}</span>
          <ChevronDown size={14} strokeWidth={1.8} className="locale-switcher-chevron text-[var(--ink-secondary)]" />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[180px] rounded-control bg-white p-2 shadow-[var(--shadow-card)]"
          >
            {routing.locales.map((locale, index) => (
              <button
                key={locale}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                role="menuitemradio"
                aria-checked={locale === current}
                type="button"
                onClick={() => selectLocale(locale)}
                onKeyDown={(event) => onItemKeyDown(event, index)}
                className="flex h-9 w-full items-center justify-between gap-2 rounded-chip px-2 text-left text-[14px] font-medium text-[var(--ink-2)] hover:bg-[var(--bg-subtle)]"
              >
                {LOCALE_NAMES[locale] ?? locale}
                {locale === current ? <Check size={16} strokeWidth={2} className="text-[var(--action-bg)]" /> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <select
      aria-label="Language"
      className="rounded-chip border border-[var(--border-control)] bg-white px-2 py-1 text-sm"
      value={current}
      onChange={(event) => {
        router.replace(pathname, { locale: event.target.value });
      }}
    >
      {routing.locales.map((locale) => (
        <option key={locale} value={locale}>
          {locale === "sr" ? "SR" : "EN"}
        </option>
      ))}
    </select>
  );
}
