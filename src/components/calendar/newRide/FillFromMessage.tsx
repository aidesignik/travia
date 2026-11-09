"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, X } from "lucide-react";
import { SHEET_TEXTAREA_CLASS } from "./sheetFieldClasses";
import { toDateOnlyString } from "@/lib/pickerDateFormat";

// The ride details read from a pasted message (see lib/rideFromMessage.ts
// and api/carrier/rides/from-message). Every field may be null.
export interface MessageRideDraft {
  clientCompanyName: string | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  pickupCity: string | null;
  pickupLocation: string | null;
  destinationCity: string | null;
  destinationLocation: string | null;
  stops: { city: string; location: string | null }[];
  departureDate: string | null;
  departureTime: string | null;
  isRoundTrip: boolean | null;
  returnDate: string | null;
  returnTime: string | null;
  passengerCount: number | null;
  specialRequests: string | null;
}

// The carrier's existing client the message was matched to, if any.
export interface MessageRideClient {
  id: string;
  companyName: string | null;
  name: string | null;
  email: string;
  phone: string | null;
}

// Whether the server has the AI key — asked once per page load.
let enabledPromise: Promise<boolean> | null = null;
function fetchEnabled(): Promise<boolean> {
  enabledPromise ??= fetch("/api/carrier/rides/from-message")
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => data?.enabled === true)
    .catch(() => false);
  return enabledPromise;
}

// "Fill from a client's message" at the top of the new-ride form: paste a
// booking request (email, Viber, SMS) and the form fields are filled in
// from it, for the carrier to check before saving. Hidden when the AI key
// isn't configured on the server.
export function FillFromMessage({
  onFilled,
}: {
  onFilled: (draft: MessageRideDraft, client: MessageRideClient | null) => void;
}) {
  const t = useTranslations("carrier.newRide.fromMessage");
  const locale = useLocale();
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

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
    if (open) textareaRef.current?.focus();
  }, [open]);

  if (!enabled) return null;

  async function submit() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    const now = new Date();
    const res = await fetch("/api/carrier/rides/from-message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        today: toDateOnlyString(now),
        weekday: now.toLocaleDateString("en", { weekday: "long" }),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Belgrade",
      }),
    }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    setLoading(false);

    if (!data?.draft) {
      setError(res?.status === 429 ? t("tooMany") : t("notRead"));
      return;
    }
    onFilled(data.draft, data.client ?? null);
    setOpen(false);
    setText("");
    setFilled(true);
  }

  if (!open) {
    return (
      <div className="px-6 pt-5">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setFilled(false);
          }}
          className="flex h-10 w-full items-center justify-center gap-[7px] rounded-[10px] bg-[var(--action-100)]/60 text-[13.5px] font-semibold text-[var(--action-bg)] transition-colors duration-[.12s] ease-out hover:bg-[var(--action-100)]"
        >
          <Sparkles size={15} strokeWidth={2} aria-hidden />
          {t("trigger")}
        </button>
        {filled ? (
          <p role="status" className="mt-2 flex items-start gap-[6px] text-[12.5px] text-[var(--ink-secondary)]">
            <span aria-hidden className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full bg-[#16A34A]" />
            {t("filled")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="px-6 pt-5">
      <div className="rounded-[12px] p-3 shadow-[inset_0_0_0_1px_var(--border-control)]">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor={textareaId} className="flex items-center gap-[6px] text-[13.5px] font-semibold text-[var(--ink-primary)]">
            <Sparkles size={14} strokeWidth={2} className="text-[var(--action-bg)]" aria-hidden />
            {t("title")}
          </label>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            aria-label={t("cancel")}
            className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[var(--ink-muted)] hover:bg-[var(--border-soft)]"
          >
            <X size={15} strokeWidth={1.9} />
          </button>
        </div>
        <textarea
          ref={textareaRef}
          id={textareaId}
          rows={5}
          lang={locale}
          maxLength={6000}
          className={SHEET_TEXTAREA_CLASS}
          placeholder={t("placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // ⌘/Ctrl+Enter fills straight away.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        {error ? <p className="mt-2 text-[12.5px] text-[var(--ink-destructive)]">{error}</p> : null}
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[12px] text-[var(--ink-muted)]">{t("hint")}</p>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!text.trim() || loading}
            className="flex h-9 shrink-0 items-center gap-[6px] rounded-[9px] bg-[var(--action-bg)] px-[14px] text-[13.5px] font-semibold text-white transition-opacity duration-[.12s] disabled:opacity-50"
          >
            {loading ? t("reading") : t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
