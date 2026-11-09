"use client";

import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowUp, ChevronDown, GripVertical, PanelRightClose, PanelRightOpen, RotateCcw, Sparkles, X } from "lucide-react";
import { toDateOnlyString } from "@/lib/pickerDateFormat";
import type { RideProposal } from "@/lib/assistant/tools";
import { AssistantProposalCard } from "./AssistantProposalCard";
import { ASSISTANT_DOCK_GAP, ASSISTANT_DOCK_WIDTH, setAssistantDocked } from "./assistantDock";

// Fired when a ride is created from the chat, so whatever's on screen (the
// calendar) can reload.
export const RIDES_CHANGED_EVENT = "travia:rides-changed";

const PREFS_KEY = "travia.assistant";
const FLOAT_WIDTH = 400;
const FLOAT_MAX_HEIGHT = 600;
const EDGE = 16;
const LAUNCHER_SIZE = 56;
const LAUNCHER_OFFSET = 24;

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

// The assistant: a floating button (bottom right, on every carrier page) that
// opens a chat window. The window floats and can be dragged anywhere by its
// title bar, or pinned to the right edge — then the calendar narrows to make
// room, and ride details / ride forms open in that same column (SidePanel
// reads the pinned state). Window mode and position are remembered per
// browser; the conversation lives here (the shell persists across pages)
// until "New chat".
export function AssistantButton() {
  const t = useTranslations("carrier.assistant");
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [docked, setDocked] = useState(false);
  const [pos, setPos] = useState<Point | null>(null);
  const [floatHeight, setFloatHeight] = useState(FLOAT_MAX_HEIGHT);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const nextId = useRef(1);
  const windowRef = useRef<HTMLElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
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
  useEffect(() => () => setAssistantDocked(false), []);

  // Keep the floating window inside the viewport (first open, and resizes).
  useEffect(() => {
    if (!open || docked) return;
    function fit() {
      const scale = cssScale(launcherRef.current ?? windowRef.current);
      const vp = viewportCss(scale);
      const height = Math.min(FLOAT_MAX_HEIGHT, vp.height - EDGE * 2);
      setFloatHeight(height);
      setPos((prev) => {
        const fallback = {
          x: vp.width - FLOAT_WIDTH - LAUNCHER_OFFSET,
          y: vp.height - height - LAUNCHER_OFFSET - LAUNCHER_SIZE - 12,
        };
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

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, docked]);

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
  const showWindow = open && (docked || pos !== null);
  const windowStyle = docked
    ? { top: ASSISTANT_DOCK_GAP, bottom: ASSISTANT_DOCK_GAP, right: ASSISTANT_DOCK_GAP, width: ASSISTANT_DOCK_WIDTH }
    : { left: pos?.x ?? 0, top: pos?.y ?? 0, width: FLOAT_WIDTH, height: floatHeight };

  return (
    <>
      {/* The launcher; hidden while the chat is pinned (the column is the chat). */}
      {open && docked ? null : (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? t("launcherClose") : t("launcherOpen")}
          aria-expanded={open}
          className="fixed z-[45] flex items-center justify-center rounded-full bg-[var(--action-bg)] text-white shadow-[0_2px_4px_rgba(29,38,74,0.1),0_10px_24px_rgba(37,99,235,0.35)] transition-[background-color,scale] duration-[.12s] ease-out hover:bg-[var(--action-bg-hover)] active:scale-95"
          style={{ right: LAUNCHER_OFFSET, bottom: LAUNCHER_OFFSET, width: LAUNCHER_SIZE, height: LAUNCHER_SIZE }}
        >
          {open ? <ChevronDown size={24} strokeWidth={2.2} aria-hidden /> : <Sparkles size={22} strokeWidth={2} aria-hidden />}
        </button>
      )}

      {showWindow ? (
        <section
          ref={windowRef}
          role="dialog"
          aria-label={t("title")}
          className={`fixed flex flex-col overflow-hidden border border-[var(--border-container)] bg-[var(--bg-panel)] ${
            docked
              ? "z-30 rounded-panel shadow-[var(--shadow-surface-card)]"
              : "z-[45] rounded-[16px] shadow-[var(--shadow-panel)]"
          }`}
          style={windowStyle}
        >
          <header
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className={`flex h-[52px] shrink-0 select-none items-center gap-1 border-b border-[#F0F0F2] pl-3 pr-2 ${
              docked ? "" : "cursor-grab active:cursor-grabbing"
            }`}
            title={docked ? undefined : t("dragHint")}
          >
            {docked ? null : <GripVertical size={16} strokeWidth={1.9} className="shrink-0 text-[var(--ink-muted)]" aria-hidden />}
            <Sparkles size={16} strokeWidth={2} className="ml-1 shrink-0 text-[var(--action-bg)]" aria-hidden />
            <h2 className="ml-1 flex-1 text-[15px] font-semibold text-[var(--ink-primary)]">{t("title")}</h2>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={() => setItems([])}
                aria-label={t("newChat")}
                title={t("newChat")}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#71717A] hover:bg-[#F4F4F5]"
              >
                <RotateCcw size={15} strokeWidth={1.9} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleDocked}
              aria-label={docked ? t("unpin") : t("pin")}
              title={docked ? t("unpin") : t("pin")}
              aria-pressed={docked}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#71717A] hover:bg-[#F4F4F5]"
            >
              {docked ? <PanelRightClose size={16} strokeWidth={1.9} /> : <PanelRightOpen size={16} strokeWidth={1.9} />}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("close")}
              title={t("close")}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#71717A] hover:bg-[#F4F4F5]"
            >
              <X size={17} strokeWidth={1.9} />
            </button>
          </header>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
            {items.length === 0 ? (
              <div className="pt-2">
                <p className="text-[15px] font-semibold text-[var(--ink-primary)]">{t("emptyTitle")}</p>
                <p className="mt-1 text-[13.5px] text-[var(--ink-secondary)]">{t("emptyBody")}</p>
                <div className="mt-4 flex flex-col gap-2">
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setDraft(example);
                        inputRef.current?.focus();
                      }}
                      className="rounded-[10px] px-3 py-[9px] text-left text-[13.5px] text-[var(--ink-primary)] shadow-[inset_0_0_0_1px_var(--border-control)] hover:bg-[var(--border-soft)]"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item) =>
                  item.role === "user" ? (
                    <div
                      key={item.id}
                      className="max-w-[85%] self-end whitespace-pre-wrap rounded-[14px] rounded-br-[4px] bg-[var(--action-bg)] px-3 py-2 text-[14px] text-white"
                    >
                      {item.text}
                    </div>
                  ) : (
                    <div key={item.id} className="max-w-[94%] self-start">
                      <div className="whitespace-pre-wrap rounded-[14px] rounded-bl-[4px] bg-[var(--border-soft)] px-3 py-2 text-[14px] text-[var(--ink-primary)]">
                        {item.text}
                      </div>
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
                  <div className="self-start rounded-[14px] rounded-bl-[4px] bg-[var(--border-soft)] px-3 py-2 text-[14px] text-[var(--ink-secondary)]">
                    {t("thinking")}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <form onSubmit={onSubmit} className="shrink-0 border-t border-[#F0F0F2] p-3">
            <div className="flex items-end gap-2 rounded-[12px] px-3 py-2 shadow-[inset_0_0_0_1px_var(--border-control)] focus-within:shadow-[inset_0_0_0_1px_var(--action-bg),0_0_0_3px_var(--action-100)]">
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
                className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent text-[14px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label={t("send")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--action-bg)] text-white transition-opacity disabled:opacity-40"
              >
                <ArrowUp size={16} strokeWidth={2.2} />
              </button>
            </div>
            <p className="mt-2 px-1 text-[11.5px] text-[var(--ink-muted)]">{t("disclaimer")}</p>
          </form>
        </section>
      ) : null}
    </>
  );
}
