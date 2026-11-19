"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { SignOutButton } from "./SignOutButton";

const MENU_ITEM_CLASS =
  "block w-full rounded-chip px-3 py-2 text-left text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--bg-subtle)]";

function initialsFor(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "?";
}

// Avatar in the header — click opens a dropdown showing who's signed in
// (company name + email) and the account actions that used to be flat
// links in the header (Profile, language, sign out).
export function UserMenu({
  name,
  email,
  image,
  profileHref,
  size = 32,
}: {
  name: string;
  email: string | null;
  image?: string | null;
  profileHref: string | null;
  size?: 32 | 34;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLAnchorElement>(null);
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
    const raf = requestAnimationFrame(() => (profileRef.current ?? signOutRef.current)?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  // Only two real menu items (Profile link, Sign out button) sit either
  // side of the embedded language <select>, which has its own native
  // keyboard handling — Down/Up just moves between the two buttons.
  function onItemKeyDown(event: KeyboardEvent, isProfile: boolean) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      (isProfile ? signOutRef.current : profileRef.current)?.focus();
    } else if (event.key === "Tab" && !event.shiftKey && !isProfile) {
      setOpen(false);
    } else if (event.key === "Tab" && event.shiftKey && isProfile) {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onTriggerKeyDown}
        aria-label={t("accountMenu")}
        aria-expanded={open}
        aria-haspopup="menu"
        style={{ height: size, width: size }}
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ink-strong)] text-xs font-medium text-white transition-opacity duration-[.12s] ease-out hover:opacity-80"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          initialsFor(name)
        )}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={t("accountMenu")}
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-control border border-[var(--border-control)] bg-white p-2 shadow-[var(--shadow-card)]"
        >
          <div className="border-b border-[var(--border-soft)] px-3 py-2">
            <p className="truncate text-sm font-medium text-[var(--ink-primary)]">{name}</p>
            {email ? <p className="truncate text-xs text-[var(--ink-muted)]">{email}</p> : null}
          </div>
          <div className="flex flex-col gap-0.5 py-1">
            {profileHref ? (
              <Link
                ref={profileRef}
                href={profileHref}
                role="menuitem"
                onClick={() => setOpen(false)}
                onKeyDown={(event) => onItemKeyDown(event, true)}
                className={MENU_ITEM_CLASS}
              >
                {t("profile")}
              </Link>
            ) : null}
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-medium text-[var(--ink-2)]">{tCommon("language")}</span>
              <LocaleSwitcher />
            </div>
            <SignOutButton
              itemRef={(el) => {
                signOutRef.current = el;
              }}
              role="menuitem"
              onKeyDown={(event) => onItemKeyDown(event, false)}
              label={t("logout")}
              className={MENU_ITEM_CLASS}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
