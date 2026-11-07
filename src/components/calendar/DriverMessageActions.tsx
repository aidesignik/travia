"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, MessageSquareText } from "lucide-react";
import { messagingLinks, toInternationalDigits } from "@/lib/driverMessage";

const PILL_CLASS =
  "inline-flex h-8 items-center gap-[6px] rounded-full border border-[var(--border-control)] bg-white px-3 text-[13px] font-medium text-[var(--ink-primary)] transition-colors duration-[.12s] ease-out hover:bg-[var(--bg-subtle)]";

// "Send to driver" row under the assigned driver: opens WhatsApp, Viber or
// the SMS app with the driver's number and the ride details pre-filled
// (built by the drawer via buildDriverMessage), plus a copy button for any
// other channel. The dispatcher still presses send in their own app.
export function DriverMessageActions({ phone, message }: { phone: string; message: string }) {
  const t = useTranslations("carrier.calendar.detail.driverMessage");
  const [copied, setCopied] = useState(false);
  const digits = toInternationalDigits(phone);
  if (!digits) return null;
  const links = messagingLinks(digits, message);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context, permissions) — the
      // three app buttons still work.
    }
  }

  return (
    <div className="pl-12">
      <p className="m-0 mb-[6px] flex items-center gap-[6px] text-[12.5px] text-[var(--ink-muted)]">
        <MessageSquareText size={14} strokeWidth={1.9} aria-hidden="true" />
        {t("sendLabel")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={PILL_CLASS}>
          <span className="h-2 w-2 rounded-full bg-[#25D366]" aria-hidden="true" />
          WhatsApp
        </a>
        <a href={links.viber} className={PILL_CLASS}>
          <span className="h-2 w-2 rounded-full bg-[#7360F2]" aria-hidden="true" />
          Viber
        </a>
        <a href={links.sms} className={PILL_CLASS}>
          <span className="h-2 w-2 rounded-full bg-[#2563EB]" aria-hidden="true" />
          SMS
        </a>
        <button
          type="button"
          onClick={copy}
          title={copied ? t("copied") : t("copy")}
          aria-label={copied ? t("copied") : t("copy")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-control)] bg-white text-[var(--ink-secondary)] transition-colors duration-[.12s] ease-out hover:bg-[var(--bg-subtle)]"
        >
          {copied ? (
            <Check size={14} strokeWidth={2} className="text-[#16a34a]" aria-hidden="true" />
          ) : (
            <Copy size={14} strokeWidth={1.9} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
