"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Settings } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { CompanyMark } from "@/components/carrier/CompanyMark";

// The avatar in the carrier top bar — previously a generic account menu
// (name/email + profile + language + logout), now a company-branded
// switcher: the company's own mark/name instead of the signed-in user's,
// opening onto company-scoped actions, language switcher carried over from
// the old menu. Deliberately has no "Team"/"My profile" items — neither a
// multi-user-per-carrier model nor a distinct personal-profile page exists
// yet, so both would be dead links; flagged to the user rather than added
// or silently invented.
export function CompanyMenu({
  companyName,
  logoUrl,
  email,
}: {
  companyName: string;
  logoUrl: string | null;
  email: string | null;
}) {
  const t = useTranslations("carrier.companyMenu");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLAnchorElement>(null);
  const signOutRef = useRef<HTMLButtonElement>(null);

  function closeAndRefocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") closeAndRefocus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => settingsRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  // Only two real menu items (Company settings, Log out) sit either side of
  // the embedded language <select>, which has its own native keyboard
  // handling — Down/Up just moves between the two buttons, same roving
  // pattern as UserMenu.
  function onItemKeyDown(event: KeyboardEvent, isSettings: boolean) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      (isSettings ? signOutRef.current : settingsRef.current)?.focus();
    } else if (event.key === "Tab" && !event.shiftKey && !isSettings) {
      setOpen(false);
    } else if (event.key === "Tab" && event.shiftKey && isSettings) {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        aria-label={companyName}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-white transition-colors duration-[.12s] ease-out hover:bg-[var(--topbar-hover)] xl:w-auto xl:justify-start xl:gap-[10px] xl:pl-1 xl:pr-[10px]"
      >
        <CompanyMark companyName={companyName} logoUrl={logoUrl} size={32} />
        <span
          className="hidden truncate text-[14px] font-medium text-[var(--ink)] xl:block"
          style={{ maxWidth: 160 }}
        >
          {companyName}
        </span>
        <ChevronDown size={14} className="hidden shrink-0 text-[var(--ink-muted)] xl:block" aria-hidden="true" />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={companyName}
          className="absolute right-0 top-full z-30 mt-2 w-[280px] rounded-[12px] bg-white p-2 shadow-[var(--shadow-panel)]"
        >
          <div className="flex items-center gap-[10px] px-2 py-2">
            <CompanyMark companyName={companyName} logoUrl={logoUrl} size={36} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[var(--ink)]">{companyName}</p>
              {email ? <p className="truncate text-[12px]" style={{ color: "var(--ink-secondary)" }}>{email}</p> : null}
            </div>
          </div>

          <div className="my-1 h-px bg-[var(--border-soft)]" />

          <Link
            ref={settingsRef}
            href="/carrier/onboarding"
            role="menuitem"
            onClick={() => setOpen(false)}
            onKeyDown={(event) => onItemKeyDown(event, true)}
            className="flex h-9 items-center gap-[10px] rounded-[8px] px-2 text-[14px] font-medium text-[var(--ink-2)] hover:bg-[var(--menu-item-hover)]"
          >
            <Settings size={16} className="shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
            {t("companySettings")}
          </Link>

          <div className="flex items-center justify-between gap-[10px] px-2 py-2">
            <span className="text-[14px] font-medium text-[var(--ink-2)]">{tCommon("language")}</span>
            <LocaleSwitcher />
          </div>

          <div className="my-1 h-px bg-[var(--border-soft)]" />

          <SignOutButton
            itemRef={(el) => {
              signOutRef.current = el;
            }}
            role="menuitem"
            onKeyDown={(event) => onItemKeyDown(event, false)}
            label={t("logout")}
            className="flex h-9 w-full items-center rounded-[8px] px-2 text-left text-[14px] font-medium text-[var(--ink-2)] hover:bg-[var(--menu-item-hover)]"
          />
        </div>
      ) : null}
    </div>
  );
}
