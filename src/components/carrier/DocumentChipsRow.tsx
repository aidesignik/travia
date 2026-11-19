import { Check } from "lucide-react";
import { worstDocumentChip, type DocumentChipData } from "@/lib/documentChips";
import { expiredDocMessageKey } from "@/lib/expiryStatus";

type Translate = (key: string, values?: Record<string, string | number>) => string;

const CHIP_CLASS = "inline-flex items-center whitespace-nowrap rounded-full px-[10px] py-[4px] text-[12px] font-semibold";

// The design system caps a row at one status chip: the single worst
// document problem, a "Nema dokumenata" chip when nothing's on file, or a
// plain grey check + "Važe" when everything's valid — never one chip per
// document type, and never a filled chip for a non-problem state (color is
// reserved for things that need action).
export function DocumentChipsRow({ chips, t }: { chips: DocumentChipData[]; t: Translate }) {
  if (chips.length === 0) {
    return (
      <span className={CHIP_CLASS} style={{ background: "var(--warning-bg)", color: "var(--warning-text)" }}>
        {t("carrier.table.noDocuments")}
      </span>
    );
  }

  const worst = worstDocumentChip(chips);
  if (!worst) {
    return (
      <span className="inline-flex items-center gap-[6px] text-[13px] text-[var(--ink-secondary)]">
        <Check size={14} strokeWidth={2.6} color="var(--accent-completed)" />
        {t("carrier.docChip.allValid")}
      </span>
    );
  }

  const label = t(`carrier.docChip.${worst.docKind}`);
  if (worst.status === "expiringSoon") {
    return (
      <span className={CHIP_CLASS} style={{ background: "var(--warning-bg)", color: "var(--warning-text)" }}>
        {t("carrier.docChip.expiringSoonFull", { label, days: worst.daysLeft })}
      </span>
    );
  }

  return (
    <span className={CHIP_CLASS} style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}>
      {t(expiredDocMessageKey(worst.docKind), { label })} · {t("carrier.docChip.daysAgo", { days: worst.daysAgo })}
    </span>
  );
}
