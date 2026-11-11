"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bus, CalendarDays, CircleHelp, Inbox, Search, StickyNote, User, X } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { filterHelp, type HelpSection } from "@/lib/helpSearch";
import { setHelpQuery } from "@/components/carrier/help/helpQuery";
import type { SearchResults, SearchRide } from "@/app/api/carrier/search/route";

const HELP_PATH = "/carrier/help";
const MIN_QUERY = 2;
const DEBOUNCE_MS = 180;
const HELP_LIMIT = 4;

interface ResultItem {
  key: string;
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
}

interface ResultGroup {
  id: string;
  label: string;
  items: ResultItem[];
}

const ICON_PROPS = { size: 15, strokeWidth: 1.9, "aria-hidden": true } as const;

// The ride's calendar day in the browser's time zone (YYYY-MM-DD), which is
// what the calendar's ?date= deep link expects.
function localDay(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The top bar's search.
// - Everywhere but Help it's a global search: rides, open requests,
//   vehicles, drivers, notes and help answers, in a results list under the
//   field. Arrow keys move through it, Enter opens, Esc closes.
// - On the Help page it filters that page's questions instead (through
//   ?q= in the URL, which HelpCenter reads), so the page has one search.
// ⌘K / Ctrl+K focuses it from anywhere.
export function TopBarSearch() {
  const t = useTranslations("carrier.search");
  const tHelp = useTranslations("carrier.help");
  const tNotes = useTranslations("carrier.notes");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onHelp = pathname === HELP_PATH;
  const listId = useId();

  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(() => (onHelp ? searchParams.get("q") ?? "" : ""));
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ query: string; data: SearchResults } | null>(null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [shortcut, setShortcut] = useState("⌘K");

  // Moving to another page resets the field: on Help it starts from ?q=
  // (a help result links there pre-filtered), elsewhere it's emptied.
  const [syncedPath, setSyncedPath] = useState(pathname);
  if (syncedPath !== pathname) {
    setSyncedPath(pathname);
    setQuery(onHelp ? searchParams.get("q") ?? "" : "");
    setOpen(false);
  }
  // The Help page's filter starts from the URL again on every visit.
  useEffect(() => {
    setHelpQuery(null);
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("Ctrl K");
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close the results when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const trimmed = query.trim();
  const searching = !onHelp && trimmed.length >= MIN_QUERY;

  // Fetch results a moment after typing stops; a newer query cancels the
  // request for an older one.
  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/carrier/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        setResults({ query: trimmed, data: (await res.json()) as SearchResults });
        setFailed(false);
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Search failed", err);
          setFailed(true);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searching, trimmed]);

  const helpSections = tHelp.raw("sections") as HelpSection[];
  const groups = useMemo<ResultGroup[]>(() => {
    if (!searching) return [];
    const intlLocale = locale === "sr" ? "sr-Latn" : "en-GB";
    const when = new Intl.DateTimeFormat(intlLocale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const ride = (r: SearchRide, href: string, icon: ReactNode): ResultItem => ({
      key: href,
      href,
      icon,
      title: r.route,
      subtitle: `${when.format(new Date(r.departureAt))} · ${r.client}`,
    });
    const data = results?.data;
    const help = filterHelp(helpSections, trimmed)
      .flatMap((section) => section.items.map((item) => ({ section, item })))
      .slice(0, HELP_LIMIT);

    // Direct hits (a driver's name, a plate) before rides, which also
    // match through their driver, vehicle and client.
    const list: ResultGroup[] = data
      ? [
          {
            id: "vehicles",
            label: t("vehicles"),
            items: data.vehicles.map((v) => ({
              key: `vehicle:${v.id}`,
              href: `/carrier/fleet?edit=${v.id}`,
              icon: <Bus {...ICON_PROPS} />,
              title: v.model,
              subtitle: [v.licensePlate, t("seats", { count: v.seats })].filter(Boolean).join(" · "),
            })),
          },
          {
            id: "drivers",
            label: t("drivers"),
            items: data.drivers.map((d) => ({
              key: `driver:${d.id}`,
              href: `/carrier/drivers?edit=${d.id}`,
              icon: <User {...ICON_PROPS} />,
              title: d.name,
              subtitle: d.phone,
            })),
          },
          {
            id: "rides",
            label: t("rides"),
            items: data.rides.map((r) =>
              ride(r, `/carrier/dashboard?ride=${r.id}&date=${localDay(r.departureAt)}`, <CalendarDays {...ICON_PROPS} />),
            ),
          },
          {
            id: "requests",
            label: t("requests"),
            items: data.requests.map((r) => ride(r, `/carrier/requests/${r.id}`, <Inbox {...ICON_PROPS} />)),
          },
          {
            id: "notes",
            label: t("notes"),
            items: data.notes.map((n) => ({
              key: `note:${n.id}`,
              href: `/carrier/notes?note=${n.id}`,
              icon: <StickyNote {...ICON_PROPS} />,
              title: n.title || tNotes("untitled"),
              subtitle: n.snippet,
            })),
          },
        ]
      : [];
    list.push({
      id: "help",
      label: t("help"),
      items: help.map(({ section, item }) => ({
        key: `help:${section.id}:${item.q}`,
        href: `${HELP_PATH}?q=${encodeURIComponent(item.q)}`,
        icon: <CircleHelp {...ICON_PROPS} />,
        title: item.q,
        subtitle: section.title,
      })),
    });
    return list.filter((group) => group.items.length > 0);
    // helpSections comes from the messages; it changes with the locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searching, results, trimmed, locale, t, tHelp, tNotes]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const loading = searching && results?.query !== trimmed && !failed;
  const showList = open && searching;
  const activeIndex = Math.min(active, Math.max(flat.length - 1, 0));

  function go(item: ResultItem) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(item.href);
  }

  function onChange(value: string) {
    setQuery(value);
    setActive(0);
    setFailed(false);
    if (onHelp) {
      // Filter the page, and keep the URL in step so a reload or a shared
      // link shows the same questions.
      const url = value.trim() ? `${window.location.pathname}?q=${encodeURIComponent(value)}` : window.location.pathname;
      window.history.replaceState(window.history.state, "", url);
      setHelpQuery(value);
    } else {
      setOpen(true);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (showList) setOpen(false);
      else if (query) onChange("");
      else inputRef.current?.blur();
      return;
    }
    if (!showList || flat.length === 0) {
      if (event.key === "ArrowDown" && searching) setOpen(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + flat.length) % flat.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(flat[activeIndex]);
    }
  }

  // Keep the highlighted result in view while arrowing through a long list.
  useEffect(() => {
    if (!showList) return;
    document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, showList, listId]);

  let index = -1;
  return (
    <div ref={boxRef} className="relative w-full max-w-[420px]">
      <Search
        size={16}
        strokeWidth={1.9}
        color="#A1A1AA"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={onHelp ? tHelp("searchPlaceholder") : t("placeholder")}
        aria-label={onHelp ? tHelp("searchLabel") : t("label")}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && flat.length > 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off"
        className="h-10 w-full rounded-[9px] border-0 bg-[var(--surface-card-bg)] pl-9 pr-16 text-[14px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] shadow-[var(--shadow-search)] outline-none transition-shadow duration-[.12s] ease-out focus:shadow-[var(--focus-ring)] [&::-webkit-search-cancel-button]:hidden"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label={t("clear")}
          title={t("clear")}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[7px] text-[var(--ink-muted)] transition-colors duration-[.12s] ease-out hover:bg-[var(--menu-item-hover)] hover:text-[var(--ink-secondary)]"
        >
          <X size={15} strokeWidth={2} />
        </button>
      ) : (
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-[6px] bg-white px-[6px] py-[2px] text-[11px] font-medium text-[var(--ink-muted)] shadow-[var(--shadow-pill)]">
          {shortcut}
        </span>
      )}

      {showList ? (
        <div className="absolute left-0 top-full z-[60] mt-2 w-[min(560px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-[var(--border-hairline)] bg-[var(--surface-card-bg)] shadow-[var(--shadow-panel)]">
          <div id={listId} role="listbox" aria-label={t("label")} className="max-h-[min(480px,65vh)] overflow-y-auto py-[6px]">
            {groups.map((group) => (
              <div key={group.id} role="group" aria-label={group.label} className="pb-[4px]">
                <p className="px-4 pb-[4px] pt-[8px] text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-muted)]">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  index += 1;
                  const i = index;
                  const selected = i === activeIndex;
                  return (
                    <div
                      key={item.key}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={selected}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(item)}
                      className={`mx-[6px] flex cursor-pointer items-center gap-3 rounded-[8px] px-[10px] py-[7px] ${
                        selected ? "bg-[var(--select-tint)]" : ""
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ${
                          selected ? "bg-white text-[var(--action-bg)]" : "bg-[var(--bg-subtle)] text-[var(--ink-secondary)]"
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13.5px] font-medium text-[var(--ink-primary)]">{item.title}</span>
                        {item.subtitle ? (
                          <span className="truncate text-[12.5px] text-[var(--ink-secondary)]">{item.subtitle}</span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
            {flat.length === 0 ? (
              <p className="px-4 py-5 text-center text-[13.5px] text-[var(--ink-secondary)]">
                {loading ? t("searching") : failed ? t("failed") : t("noResults", { query: trimmed })}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-4 border-t border-[var(--border-hairline)] px-4 py-[8px] text-[11.5px] text-[var(--ink-muted)]">
            <span>{t("hintMove")}</span>
            <span>{t("hintOpen")}</span>
            <span>{t("hintClose")}</span>
            {loading && flat.length > 0 ? <span className="ml-auto">{t("searching")}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
