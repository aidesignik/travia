"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import type { DocumentType } from "@prisma/client";
import { Popover } from "@/components/ui/Popover";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const TYPES: DocumentType[] = ["CONFIRMATION", "CONTRACT", "INVOICE"];

export function EmailDocumentsPopover({
  rideId,
  readyTypes,
  preselectTypes,
  defaultEmail,
  onClose,
  onSent,
}: {
  rideId: string;
  // Only generated documents can be attached — a type missing from this
  // list doesn't appear as a checkbox at all rather than showing disabled.
  readyTypes: DocumentType[];
  // Which checkboxes start checked — e.g. just one when opened from a
  // single row's own email icon, or all of readyTypes from the section's
  // "Email to client" header action. Still freely editable either way.
  preselectTypes?: DocumentType[];
  defaultEmail: string;
  onClose: () => void;
  onSent?: (sentTypes: DocumentType[], to: string) => void;
}) {
  const t = useTranslations();
  const [email, setEmail] = useState(defaultEmail);
  const [selected, setSelected] = useState<Set<DocumentType>>(new Set(preselectTypes ?? readyTypes));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function toggle(type: DocumentType) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  async function onSubmit() {
    if (selected.size === 0) {
      setError(t("carrier.emailDocuments.errorNoneSelected"));
      return;
    }
    setSending(true);
    setError(null);
    const res = await fetch(`/api/bookings/${rideId}/documents/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: email, types: Array.from(selected) }),
    });
    setSending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(
        body?.error === "EMAIL_NOT_CONFIGURED"
          ? t("carrier.emailDocuments.errorNotConfigured")
          : body?.error === "INVALID_EMAIL"
            ? t("carrier.emailDocuments.errorInvalidEmail")
            : t("carrier.emailDocuments.errorGeneric"),
      );
      return;
    }

    const { sentTypes } = await res.json();
    setSent(true);
    onSent?.(sentTypes, email);
  }

  return (
    <Popover onClose={onClose}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-4 py-3">
        <h3 className="text-[14px] font-semibold text-[var(--ink-primary)]">{t("carrier.emailDocuments.title")}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-[var(--ink-secondary)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-soft)]"
        >
          <X size={15} strokeWidth={1.9} />
        </button>
      </div>

      <div className="px-4 py-4">
        {sent ? (
          <div className="space-y-4">
            <p className="text-[14px] text-[var(--ink-body)]">{t("carrier.emailDocuments.success", { email })}</p>
            <Button type="button" variant="secondary" onClick={onClose} className="w-full">
              {t("common.close")}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label={t("carrier.emailDocuments.emailLabel")}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                autoFocus
              />
            </Field>

            <div className="space-y-[7px]">
              <span className="block text-[13px] font-semibold text-[var(--ink-2)]">
                {t("carrier.emailDocuments.documentsLabel")}
              </span>
              {TYPES.filter((type) => readyTypes.includes(type)).map((type) => (
                <label key={type} className="flex items-center gap-2 text-[14px] text-[var(--ink-2)]">
                  <input type="checkbox" checked={selected.has(type)} onChange={() => toggle(type)} />
                  {t(`documents.${type}`)}
                </label>
              ))}
            </div>

            {error ? <p className="text-[13px] text-[var(--ink-destructive)]">{error}</p> : null}

            <Button type="button" onClick={onSubmit} disabled={sending} className="w-full">
              {sending ? t("carrier.emailDocuments.sending") : t("carrier.emailDocuments.send")}
            </Button>
          </div>
        )}
      </div>
    </Popover>
  );
}
