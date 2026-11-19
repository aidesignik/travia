"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmailDocumentsPopover } from "@/components/forms/EmailDocumentsPopover";
import type { Document, DocumentType } from "@prisma/client";

const TYPES: DocumentType[] = ["CONFIRMATION", "CONTRACT", "INVOICE"];

export function DocumentDownloads({
  bookingId,
  initialDocuments,
  // Only the carrier side passes this — a client viewing their own
  // booking already has these documents, so "email to client" (meaning
  // them) has no reason to appear on that page.
  clientEmail,
}: {
  bookingId: string;
  initialDocuments: Document[];
  clientEmail?: string;
}) {
  const t = useTranslations();
  const [documents, setDocuments] = useState(initialDocuments);
  const [loadingType, setLoadingType] = useState<DocumentType | null>(null);
  const [emailOpenType, setEmailOpenType] = useState<DocumentType | null>(null);

  async function generate(type: DocumentType) {
    setLoadingType(type);
    const res = await fetch(`/api/bookings/${bookingId}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    if (res.ok) {
      const { document } = await res.json();
      setDocuments((prev) => [...prev.filter((d) => d.type !== type), document]);
    }
    setLoadingType(null);
  }

  const readyTypes = documents.filter((d) => d.status === "GENERATED").map((d) => d.type);

  return (
    <div className="space-y-2">
      {TYPES.map((type) => {
        const doc = documents.find((d) => d.type === type);
        const isGenerated = doc?.status === "GENERATED";
        return (
          <div key={type} className="flex items-center justify-between rounded-chip border border-[var(--border-hairline)] px-3 py-2">
            <span className="text-sm font-medium text-[var(--ink-primary)]">{t(`documents.${type}`)}</span>
            {isGenerated ? (
              <div className="flex items-center gap-3">
                {clientEmail ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setEmailOpenType((prev) => (prev === type ? null : type))}
                      className="flex items-center gap-1 text-sm font-medium text-[var(--ink-primary)] underline"
                    >
                      <Mail size={14} strokeWidth={1.9} />
                      {t("carrier.emailDocuments.trigger")}
                    </button>
                    {emailOpenType === type ? (
                      <EmailDocumentsPopover
                        rideId={bookingId}
                        readyTypes={readyTypes}
                        preselectTypes={readyTypes}
                        defaultEmail={clientEmail}
                        onClose={() => setEmailOpenType(null)}
                        onSent={() => setEmailOpenType(null)}
                      />
                    ) : null}
                  </div>
                ) : null}
                <a href={`/api/documents/${doc.id}/download`} className="text-sm font-medium text-[var(--ink-primary)] underline">
                  {t("common.download")}
                </a>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={loadingType === type}
                onClick={() => generate(type)}
              >
                {loadingType === type ? t("common.loading") : t("common.generate")}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
