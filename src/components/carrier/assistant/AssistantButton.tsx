"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowUp, RotateCcw, Sparkles, X } from "lucide-react";
import { SidePanel } from "@/components/ui/SidePanel";
import { toDateOnlyString } from "@/lib/pickerDateFormat";
import type { RideProposal } from "@/lib/assistant/tools";
import { AssistantProposalCard } from "./AssistantProposalCard";

// Fired when a ride is created from the chat, so whatever's on screen (the
// calendar) can reload.
export const RIDES_CHANGED_EVENT = "travia:rides-changed";

interface ChatItem {
  id: number;
  role: "user" | "assistant";
  text: string;
  proposal?: RideProposal;
  created?: boolean;
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

// The assistant's entry point in the top bar, and the chat panel it opens.
// The conversation lives here (the top bar persists across pages), so it
// survives closing the panel and moving between pages until "New chat".
export function AssistantButton() {
  const t = useTranslations("carrier.assistant");
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEnabled().then((value) => {
      if (!cancelled) setEnabled(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [items, sending]);

  if (!enabled) return null;

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    const userItem: ChatItem = { id: nextId.current++, role: "user", text: message };
    const conversation = [...items, userItem];
    setItems(conversation);
    setDraft("");
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

  const examples = [t("example1"), t("example2"), t("example3")];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-[7px] rounded-[10px] bg-white px-3 text-[13.5px] font-semibold text-[var(--action-bg)] transition-colors duration-[.12s] ease-out hover:bg-[var(--action-100)]/60"
      >
        <Sparkles size={16} strokeWidth={2} aria-hidden />
        {t("button")}
      </button>

      {open ? (
        <SidePanel onClose={() => setOpen(false)} label={t("title")}>
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#F0F0F2] pl-6 pr-4">
            <h2 className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.015em] text-[#18181B]">
              <Sparkles size={17} strokeWidth={2} className="text-[var(--action-bg)]" aria-hidden />
              {t("title")}
            </h2>
            <div className="flex items-center gap-1">
              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="flex h-8 items-center gap-[5px] rounded-[8px] px-2 text-[13px] font-medium text-[#71717A] hover:bg-[#F4F4F5]"
                >
                  <RotateCcw size={14} strokeWidth={1.9} aria-hidden />
                  {t("newChat")}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#71717A] hover:bg-[#F4F4F5]"
              >
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
            {items.length === 0 ? (
              <div className="pt-6">
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
                    <div key={item.id} className="max-w-[92%] self-start">
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
        </SidePanel>
      ) : null}
    </>
  );
}
