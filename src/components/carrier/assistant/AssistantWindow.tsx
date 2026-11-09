"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Bus,
  CalendarPlus,
  GripVertical,
  List,
  Maximize2,
  Minus,
  PanelRight,
  PanelRightClose,
  RotateCcw,
  X,
  type LucideIcon,
} from "lucide-react";
import { toDateOnlyString } from "@/lib/pickerDateFormat";
import type { RideProposal } from "@/lib/assistant/tools";
import { AssistantIcon } from "./AssistantIcon";
import { AssistantProposalCard } from "./AssistantProposalCard";
import {
  ASSISTANT_DOCK_WIDTH,
  setAssistantDocked,
  setAssistantMinimized,
  setAssistantOpen,
  toggleAssistant,
  useAssistantMinimized,
  useAssistantOpen,
} from "./assistantDock";

// Fired when a ride is created from the chat, so whatever's on screen (the
// calendar) can reload.
export const RIDES_CHANGED_EVENT = "travia:rides-changed";

const PREFS_KEY = "travia.assistant";
const FLOAT_WIDTH = 420;
const FLOAT_MAX_HEIGHT = 620;
/** Minimum gap between the floating window and the viewport edges. */
const EDGE = 16;
/** Minimized: just the title bar (56px row + borders), narrower. */
const BAR_HEIGHT = 58;
const BAR_WIDTH = 300;
/** The carrier sidebar's width; a fresh floating window opens just right of it. */
const SIDEBAR_WIDTH = 252;

// The header zone is the only tinted area: select-tint fading to white,
// behind the header row and (when empty) the greeting.
const HEADER_ZONE_BACKGROUND = "linear-gradient(180deg, var(--select-tint) 0%, var(--bg-panel) 100%)";
const HEADER_BUTTON_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-transparent text-[var(--ink-secondary)] transition-colors duration-[.12s] ease-out hover:bg-[rgba(255,255,255,0.7)] hover:text-[var(--ink-primary)]";

interface ChatItem {
  id: number;
  role: "user" | "assistant";
  text: string;
  proposal?: RideProposal;
  created?: boolean;
}

interface Point {
  x: number;
  y: number;
}

// What the server sees of earlier turns: the text, plus a compact note of
// any ride card the assistant prepared (and whether it was created), so a
// follow-up like "make it 10 instead" has the details to work from.
function historyText(item: ChatItem): string {
  if (!item.proposal) return item.text;
  const p = item.proposal;
  const card = {
    client: p.clientCompanyName || p.clientName,
    clientId: p.clientId,
    route: [p.pickupLocation, ...p.stops.map((s) => s.location), p.destinationLocation].join(" → "),
    departureAt: p.departureAt,
    returnAt: p.returnAt,
    passengers: p.passengerCount,
    vehicle: p.vehicle?.label ?? null,
    driver: p.driver?.name ?? null,
    created: Boolean(item.created),
  };
  return `${item.text}\n[Ride card shown: ${JSON.stringify(card)}]`;
}

let enabledPromise: Promise<boolean> | null = null;
function fetchEnabled(): Promise<boolean> {
  enabledPromise ??= fetch("/api/carrier/assistant")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => data?.enabled === true)
    .catch(() => false);
  return enabledPromise;
}

// The page is zoomed (html { zoom: .9 } in the app shell), so pointer and
// window sizes are in screen px while positions here are CSS px: measure the
// ratio from a rendered element instead of assuming it.
function cssScale(el: HTMLElement | null): number {
  if (!el || !el.offsetWidth) return 1;
  return el.getBoundingClientRect().width / el.offsetWidth || 1;
}

function viewportCss(scale: number) {
  return { width: window.innerWidth / scale, height: window.innerHeight / scale };
}

// `pos` is always the full window's top-left. Minimized, the title bar sits
// where the window's bottom edge was (so it collapses downwards and expands
// back upwards), which shifts the allowed range for y.
function clampPos(p: Point, vp: { width: number; height: number }, height: number, minimized: boolean): Point {
  const width = minimized ? BAR_WIDTH : FLOAT_WIDTH;
  const minY = minimized ? EDGE - (height - BAR_HEIGHT) : EDGE;
  const maxY = vp.height - height - EDGE;
  return {
    x: Math.min(Math.max(EDGE, p.x), Math.max(EDGE, vp.width - width - EDGE)),
    y: Math.min(Math.max(minY, p.y), Math.max(minY, maxY)),
  };
}

// The assistant chat window. It's opened from the sidebar's "Assistant" item
// (or ⌘J / Ctrl+J) and floats — draggable by its title bar — or is pinned to
// the right edge, where the calendar narrows to make room and ride details /
// ride forms open in that same column (SidePanel reads the pinned state).
// Window mode and position are remembered per browser; the conversation
// lives here (the shell persists across pages) until "New chat".
export function AssistantWindow() {
  const t = useTranslations("carrier.assistant");
  const router = useRouter();
  const open = useAssistantOpen();
  const minimized = useAssistantMinimized();
  const [enabled, setEnabled] = useState(false);
  const [docked, setDocked] = useState(false);
  const [pos, setPos] = useState<Point | null>(null);
  const [floatHeight, setFloatHeight] = useState(FLOAT_MAX_HEIGHT);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const nextId = useRef(1);
  const windowRef = useRef<HTMLElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ startX: number; startY: number; from: Point; scale: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEnabled().then((value) => {
      if (!cancelled) setEnabled(value);
    });
    // Remembered window mode/position (read after mount so the server render
    // matches the first client render).
    try {
      const saved = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "null");
      if (saved && typeof saved === "object") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDocked(saved.docked === true);
        if (typeof saved.x === "number" && typeof saved.y === "number") setPos({ x: saved.x, y: saved.y });
      }
    } catch {
      // No storage — defaults apply.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // ⌘J / Ctrl+J opens and closes the assistant from anywhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "j") {
        event.preventDefault();
        toggleAssistant();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function savePrefs(next: { docked: boolean; pos: Point | null }) {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ docked: next.docked, ...(next.pos ?? {}) }));
    } catch {
      // Not remembered this time.
    }
  }

  // Pinned + open: the shell reserves the column (calendar narrows) and side
  // panels open in it. Released when the window closes or unpins.
  useEffect(() => {
    setAssistantDocked(open && docked && !minimized);
  }, [open, docked, minimized]);
  useEffect(
    () => () => {
      setAssistantDocked(false);
      setAssistantOpen(false);
    },
    [],
  );

  // Keep the floating window inside the viewport (first open, and resizes).
  useEffect(() => {
    if (!open || docked) return;
    function fit() {
      const scale = cssScale(probeRef.current);
      const vp = viewportCss(scale);
      const height = Math.min(FLOAT_MAX_HEIGHT, vp.height - EDGE * 2);
      setFloatHeight(height);
      setPos((prev) => {
        // First open: bottom left, next to the sidebar — away from the right
        // edge, where ride details and forms slide in.
        const fallback = { x: SIDEBAR_WIDTH + EDGE, y: vp.height - height - EDGE };
        return clampPos(prev ?? fallback, vp, height, minimized);
      });
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open, docked, minimized]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [items, sending]);

  // Focus the composer once the window is actually on screen (a fresh
  // floating window first needs its position measured).
  const showWindow = open && (docked || pos !== null);
  useEffect(() => {
    if (showWindow && !minimized) requestAnimationFrame(() => inputRef.current?.focus());
  }, [showWindow, docked, minimized]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    const userItem: ChatItem = { id: nextId.current++, role: "user", text: message };
    const conversation = [...items, userItem];
    setItems(conversation);
    setDraft("");

    // No API key on the server yet: the window works, but answers with a note
    // instead of calling the model.
    if (!enabled) {
      setItems((prev) => [...prev, { id: nextId.current++, role: "assistant", text: t("notConnected") }]);
      return;
    }

    setSending(true);
    const now = new Date();
    const res = await fetch("/api/carrier/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversation.map((item) => ({ role: item.role, text: historyText(item) })),
        today: toDateOnlyString(now),
        weekday: now.toLocaleDateString("en", { weekday: "long" }),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Belgrade",
      }),
    }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    setSending(false);

    let reply: string;
    if (res?.status === 429) reply = t("tooMany");
    else if (!data) reply = t("error");
    else reply = data.reply || (data.proposal ? t("proposalReady") : t("refusal"));
    setItems((prev) => [
      ...prev,
      { id: nextId.current++, role: "assistant", text: reply, proposal: data?.proposal ?? undefined },
    ]);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function markCreated(id: number) {
    setItems((prev) => [
      ...prev.map((item) => (item.id === id ? { ...item, created: true } : item)),
      { id: nextId.current++, role: "assistant", text: t("createdMessage") },
    ]);
    window.dispatchEvent(new Event(RIDES_CHANGED_EVENT));
    router.refresh();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
  }

  function toggleDocked() {
    const next = !docked;
    setDocked(next);
    savePrefs({ docked: next, pos });
  }

  // Minimizing a pinned chat un-pins it: the title bar floats like the
  // window does (the calendar gets its width back).
  function minimize() {
    if (docked) {
      setDocked(false);
      savePrefs({ docked: false, pos });
    }
    setAssistantMinimized(true);
  }

  // Dragging the floating window by its title bar (not its buttons).
  function onDragStart(event: ReactPointerEvent<HTMLElement>) {
    if (docked || !pos || event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startY: event.clientY, from: pos, scale: cssScale(windowRef.current) };
  }
  function onDragMove(event: ReactPointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d) return;
    const vp = viewportCss(d.scale);
    const next = { x: d.from.x + (event.clientX - d.startX) / d.scale, y: d.from.y + (event.clientY - d.startY) / d.scale };
    setPos(clampPos(next, vp, floatHeight, minimized));
  }
  function onDragEnd() {
    if (!drag.current) return;
    drag.current = null;
    savePrefs({ docked, pos });
  }

  const suggestions: { icon: LucideIcon; label: string; prompt: string }[] = [
    { icon: CalendarPlus, label: t("suggestion1"), prompt: t("example1") },
    { icon: Bus, label: t("suggestion2"), prompt: t("example2") },
    { icon: List, label: t("suggestion3"), prompt: t("example3") },
  ];
  const empty = items.length === 0;
  const windowStyle = docked
    ? { top: 0, bottom: 0, right: 0, width: ASSISTANT_DOCK_WIDTH }
    : minimized
      ? { left: pos?.x ?? 0, top: (pos?.y ?? 0) + floatHeight - BAR_HEIGHT, width: BAR_WIDTH, height: BAR_HEIGHT }
      : { left: pos?.x ?? 0, top: pos?.y ?? 0, width: FLOAT_WIDTH, height: floatHeight };

  return (
    <>
      {/* Measures the page zoom before the window has rendered. */}
      <div ref={probeRef} aria-hidden className="pointer-events-none invisible fixed left-0 top-0 h-0 w-[100px]" />

      {showWindow ? (
        <section
          ref={windowRef}
          role="dialog"
          aria-label={t("title")}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !docked) setAssistantOpen(false);
          }}
          className={`fixed flex flex-col overflow-hidden bg-[var(--bg-panel)] font-medium text-[var(--ink-primary)] ${
            docked
              ? "z-30 border-l border-[var(--border-container)]"
              : "z-[45] rounded-panel border border-[var(--border-container)] shadow-[var(--shadow-panel)]"
          }`}
          style={windowStyle}
        >
          {/* Header zone: the panel's only tint. */}
          <div className="shrink-0" style={{ background: HEADER_ZONE_BACKGROUND }}>
            <header
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onPointerCancel={onDragEnd}
              className={`flex h-14 select-none items-center gap-[10px] pl-3 pr-2 ${docked ? "" : "cursor-grab active:cursor-grabbing"}`}
              title={docked ? undefined : t("dragHint")}
              // Minimized, a double-click on the bar expands it again.
              onDoubleClick={(event) => {
                if (minimized && !(event.target as HTMLElement).closest("button")) setAssistantMinimized(false);
              }}
            >
              {docked ? null : <GripVertical size={14} strokeWidth={2} className="shrink-0 text-[var(--ink-muted)]" aria-hidden />}
              <AssistantIcon size={22} strokeWidth={1.8} />
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink-primary)]">{t("title")}</h2>
              <span className="rounded-pill bg-[var(--action-100)] px-2 py-[2px] text-[11.5px] font-medium text-[var(--action-800)]">
                {t("beta")}
              </span>
              <span className="flex-1" />
              {minimized ? (
                <button
                  type="button"
                  onClick={() => setAssistantMinimized(false)}
                  aria-label={t("expand")}
                  title={t("expand")}
                  className={HEADER_BUTTON_CLASS}
                >
                  <Maximize2 size={17} strokeWidth={1.8} />
                </button>
              ) : null}
              {!empty && !minimized ? (
                <button type="button" onClick={() => setItems([])} aria-label={t("newChat")} title={t("newChat")} className={HEADER_BUTTON_CLASS}>
                  <RotateCcw size={18} strokeWidth={1.8} />
                </button>
              ) : null}
              {minimized ? null : (
                <>
                  <button
                    type="button"
                    onClick={toggleDocked}
                    aria-label={docked ? t("unpin") : t("pin")}
                    title={docked ? t("unpin") : t("pin")}
                    aria-pressed={docked}
                    className={HEADER_BUTTON_CLASS}
                  >
                    {docked ? <PanelRightClose size={18} strokeWidth={1.8} /> : <PanelRight size={18} strokeWidth={1.8} />}
                  </button>
                  <button type="button" onClick={minimize} aria-label={t("minimize")} title={t("minimize")} className={HEADER_BUTTON_CLASS}>
                    <Minus size={18} strokeWidth={1.8} />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setAssistantOpen(false)}
                aria-label={t("close")}
                title={t("close")}
                className={HEADER_BUTTON_CLASS}
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </header>

            {empty && !minimized ? (
              <div className="flex flex-col gap-[6px] px-5 pb-2 pt-4">
                <h2 className="text-[19px] font-semibold leading-[1.3] tracking-[-0.015em] text-[var(--ink-primary)]">
                  {t("emptyTitle")}
                </h2>
                <p className="text-[13.5px] font-medium leading-[1.5] text-[var(--ink-secondary)]">{t("emptyBody")}</p>
              </div>
            ) : null}
          </div>

          {minimized ? null : (
            <>
              <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
                {empty ? (
                  <div className="flex flex-col gap-2 px-5 pt-4">
                    {suggestions.map(({ icon: Icon, label, prompt }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          setDraft(prompt);
                          inputRef.current?.focus();
                        }}
                        className="flex min-h-11 items-center gap-3 rounded-control border border-[var(--border-hairline)] bg-white px-[14px] py-3 text-left text-[13px] font-medium text-[var(--ink-primary)] transition-colors duration-[.12s] ease-out hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
                      >
                        <Icon size={18} strokeWidth={1.9} className="shrink-0 text-[var(--action-bg)]" aria-hidden />
                        <span className="min-w-0 flex-1">{label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 px-5 py-4">
                    {items.map((item) =>
                      item.role === "user" ? (
                        <p
                          key={item.id}
                          className="max-w-[300px] self-end whitespace-pre-wrap rounded-[12px_12px_4px_12px] bg-[var(--select-tint)] px-[14px] py-[10px] text-[14px] font-medium text-[var(--ink-primary)]"
                        >
                          {item.text}
                        </p>
                      ) : (
                        <div key={item.id} className="self-stretch">
                          <p className="whitespace-pre-wrap text-[14px] font-medium leading-[1.5] text-[var(--ink-body)]">{item.text}</p>
                          {item.proposal ? (
                            <AssistantProposalCard
                              proposal={item.proposal}
                              created={Boolean(item.created)}
                              onCreated={() => markCreated(item.id)}
                            />
                          ) : null}
                        </div>
                      ),
                    )}
                    {sending ? (
                      <p className="animate-pulse text-[14px] font-medium text-[var(--ink-secondary)]">{t("thinking")}</p>
                    ) : null}
                  </div>
                )}
              </div>

              <form onSubmit={onSubmit} className="flex shrink-0 flex-col gap-[10px] px-4 pb-4 pt-3">
                <div className="flex items-end gap-2 rounded-[12px] border border-[var(--border-control)] bg-white pb-[10px] pl-[14px] pr-3 pt-3 transition-[border-color,box-shadow] duration-[.12s] ease-out focus-within:border-[var(--action-bg)] focus-within:shadow-[var(--focus-ring)]">
                  <label htmlFor="assistant-message" className="sr-only">
                    {t("inputLabel")}
                  </label>
                  <textarea
                    id="assistant-message"
                    ref={inputRef}
                    rows={2}
                    maxLength={4000}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends; Shift+Enter is a new line.
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(draft);
                      }
                    }}
                    placeholder={t("placeholder")}
                    className="max-h-40 flex-1 resize-none border-0 bg-transparent text-[14px] font-medium text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim() || sending}
                    aria-label={t("send")}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--action-bg)] text-white transition-colors duration-[.12s] ease-out hover:bg-[var(--action-bg-hover)] disabled:bg-[var(--border-soft)] disabled:text-[var(--ink-muted)]"
                  >
                    <ArrowUp size={16} strokeWidth={2.2} />
                  </button>
                </div>
                <p className="truncate text-center text-[12px] font-medium text-[var(--ink-secondary)]">{t("disclaimer")}</p>
              </form>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}
