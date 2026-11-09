"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowUp, GripVertical, PanelRightClose, PanelRightOpen, RotateCcw, UserRound, X } from "lucide-react";
import { toDateOnlyString } from "@/lib/pickerDateFormat";
import type { RideProposal } from "@/lib/assistant/tools";
import { AssistantProposalCard } from "./AssistantProposalCard";
import { AssistantMark } from "./AssistantMark";
import {
  ASSISTANT_DOCK_GAP,
  ASSISTANT_DOCK_WIDTH,
  setAssistantDocked,
  setAssistantOpen,
  toggleAssistant,
  useAssistantOpen,
} from "./assistantDock";

// Fired when a ride is created from the chat, so whatever's on screen (the
// calendar) can reload.
export const RIDES_CHANGED_EVENT = "travia:rides-changed";

const PREFS_KEY = "travia.assistant";
const FLOAT_WIDTH = 400;
const FLOAT_MAX_HEIGHT = 620;
const EDGE = 16;
/** The carrier sidebar's width; a fresh floating window opens just right of it. */
const SIDEBAR_WIDTH = 252;

// Soft blue/violet wash behind the whole window, with white cards on top.
const WINDOW_BACKGROUND = [
  "radial-gradient(120% 45% at 100% 0%, rgba(139,92,246,0.10) 0%, rgba(139,92,246,0) 70%)",
  "radial-gradient(110% 45% at 0% 100%, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0) 70%)",
  "linear-gradient(180deg, #FCFCFF 0%, #F4F6FE 100%)",
].join(", ");
const CARD_CLASS =
  "rounded-[14px] bg-white shadow-[0_0_0_1px_rgba(24,24,27,0.04),0_1px_2px_rgba(16,24,40,0.04),0_6px_18px_rgba(76,86,160,0.07)]";
const ICON_BUTTON_CLASS =
  "flex h-8 w-8 items-center justify-center rounded-[8px] text-[#71717A] transition-colors duration-[.12s] hover:bg-white/80 hover:text-[var(--ink-primary)]";

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
    setAssistantDocked(open && docked);
  }, [open, docked]);
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
        const p = prev ?? fallback;
        return {
          x: Math.min(Math.max(EDGE, p.x), Math.max(EDGE, vp.width - FLOAT_WIDTH - EDGE)),
          y: Math.min(Math.max(EDGE, p.y), Math.max(EDGE, vp.height - height - EDGE)),
        };
      });
    }
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open, docked]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [items, sending]);

  // Focus the composer once the window is actually on screen (a fresh
  // floating window first needs its position measured).
  const showWindow = open && (docked || pos !== null);
  useEffect(() => {
    if (showWindow) requestAnimationFrame(() => inputRef.current?.focus());
  }, [showWindow, docked]);

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
    setPos({
      x: Math.min(Math.max(EDGE, d.from.x + (event.clientX - d.startX) / d.scale), Math.max(EDGE, vp.width - FLOAT_WIDTH - EDGE)),
      y: Math.min(Math.max(EDGE, d.from.y + (event.clientY - d.startY) / d.scale), Math.max(EDGE, vp.height - floatHeight - EDGE)),
    });
  }
  function onDragEnd() {
    if (!drag.current) return;
    drag.current = null;
    savePrefs({ docked, pos });
  }

  const examples = [t("example1"), t("example2"), t("example3")];
  const windowStyle = docked
    ? { top: ASSISTANT_DOCK_GAP, bottom: ASSISTANT_DOCK_GAP, right: ASSISTANT_DOCK_GAP, width: ASSISTANT_DOCK_WIDTH }
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
          className={`fixed flex flex-col overflow-hidden border border-white ${
            docked
              ? "z-30 rounded-panel shadow-[0_0_0_1px_rgba(24,24,27,0.06),var(--shadow-surface-card)]"
              : "z-[45] rounded-[18px] shadow-[0_0_0_1px_rgba(24,24,27,0.06),0_24px_60px_rgba(40,48,110,0.18),0_4px_12px_rgba(40,48,110,0.08)]"
          }`}
          style={{ ...windowStyle, background: WINDOW_BACKGROUND }}
        >
          <header
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className={`flex h-[54px] shrink-0 select-none items-center gap-1 border-b border-[rgba(24,24,27,0.06)] pl-3 pr-2 ${
              docked ? "" : "cursor-grab active:cursor-grabbing"
            }`}
            title={docked ? undefined : t("dragHint")}
          >
            {docked ? null : <GripVertical size={15} strokeWidth={1.9} className="shrink-0 text-[#A1A1AA]" aria-hidden />}
            <AssistantMark size={18} className="ml-1" />
            <h2 className="ml-[6px] text-[15px] font-semibold tracking-[-0.01em] text-[var(--ink-primary)]">{t("title")}</h2>
            <span className="ml-[6px] rounded-[5px] border border-[#D9DCF2] px-[5px] py-px text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5B5FA8]">
              {t("beta")}
            </span>
            <span className="flex-1" />
            {items.length > 0 ? (
              <button type="button" onClick={() => setItems([])} aria-label={t("newChat")} title={t("newChat")} className={ICON_BUTTON_CLASS}>
                <RotateCcw size={15} strokeWidth={1.9} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleDocked}
              aria-label={docked ? t("unpin") : t("pin")}
              title={docked ? t("unpin") : t("pin")}
              aria-pressed={docked}
              className={ICON_BUTTON_CLASS}
            >
              {docked ? <PanelRightClose size={16} strokeWidth={1.9} /> : <PanelRightOpen size={16} strokeWidth={1.9} />}
            </button>
            <button
              type="button"
              onClick={() => setAssistantOpen(false)}
              aria-label={t("close")}
              title={t("close")}
              className={ICON_BUTTON_CLASS}
            >
              <X size={17} strokeWidth={1.9} />
            </button>
          </header>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            {items.length === 0 ? (
              <div className={`${CARD_CLASS} p-4`}>
                <p className="text-[15px] font-semibold text-[var(--ink-primary)]">{t("emptyTitle")}</p>
                <p className="mt-1 text-[13.5px] leading-[1.45] text-[var(--ink-secondary)]">{t("emptyBody")}</p>
                <div className="mt-4 flex flex-col gap-2">
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setDraft(example);
                        inputRef.current?.focus();
                      }}
                      className="rounded-[10px] border border-[#E6E8F2] bg-white px-3 py-[10px] text-left text-[13px] leading-[1.4] text-[#52525B] transition-colors duration-[.12s] hover:border-[#C9D3F5] hover:bg-[#F7F9FF] hover:text-[var(--ink-primary)]"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <div key={item.id} className={`${CARD_CLASS} px-4 py-3`}>
                    <p className="mb-[6px] flex items-center gap-[6px] text-[11.5px] font-medium text-[#8B8B93]">
                      {item.role === "user" ? (
                        <>
                          <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#EEF1F8] text-[#7A7F96]">
                            <UserRound size={11} strokeWidth={2.2} aria-hidden />
                          </span>
                          {t("you")}
                        </>
                      ) : (
                        <>
                          <AssistantMark size={14} />
                          {t("title")}
                        </>
                      )}
                    </p>
                    <p className="whitespace-pre-wrap text-[14px] leading-[1.45] text-[var(--ink-primary)]">{item.text}</p>
                    {item.proposal ? (
                      <AssistantProposalCard
                        proposal={item.proposal}
                        created={Boolean(item.created)}
                        onCreated={() => markCreated(item.id)}
                      />
                    ) : null}
                  </div>
                ))}
                {sending ? (
                  <div className={`${CARD_CLASS} px-4 py-3`}>
                    <p className="flex items-center gap-[6px] text-[13px] text-[var(--ink-secondary)]">
                      <AssistantMark size={14} className="animate-pulse" />
                      {t("thinking")}
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="shrink-0 px-4 pb-3 pt-1">
            <div className="flex items-end gap-2 rounded-[16px] border border-[#E4E6F0] bg-white py-2 pl-4 pr-2 shadow-[0_2px_8px_rgba(76,86,160,0.06)] transition-shadow duration-[.12s] focus-within:border-[#BFCDF6] focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]">
              <textarea
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
                aria-label={t("placeholder")}
                className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-[2px] text-[14px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label={t("send")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--action-bg)] text-white transition-[opacity,background-color] hover:bg-[var(--action-bg-hover)] disabled:bg-[#D4D8E8] disabled:opacity-100"
              >
                <ArrowUp size={16} strokeWidth={2.2} />
              </button>
            </div>
            <p className="mt-2 px-1 text-center text-[11px] text-[#9A9AA3]">{t("disclaimer")}</p>
          </form>
        </section>
      ) : null}
    </>
  );
}
