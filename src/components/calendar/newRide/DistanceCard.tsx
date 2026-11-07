"use client";

import { AlertTriangle, Route } from "lucide-react";

// §6 — purely presentational over the distance state NewRideModal already
// computes (same debounced /api/carrier/distance call as before); doesn't
// calculate anything itself.
export function DistanceCard({
  visible,
  calculating,
  failed,
  totalKm,
  breakdownText,
  estimateLabel,
  failedLabel,
  calculatingLabel,
  warning = null,
}: {
  visible: boolean;
  calculating: boolean;
  failed: boolean;
  totalKm: number | null;
  breakdownText: string;
  estimateLabel: string;
  failedLabel: string;
  calculatingLabel: string;
  /** Shown under the figure when it's only a rough estimate (see RouteEstimate.approximate). */
  warning?: string | null;
}) {
  if (!visible) return null;
  const showWarning = Boolean(warning) && !calculating && !failed && totalKm !== null;

  return (
    <div className="rounded-[12px] bg-[#F8FAFF] px-4 py-[14px] shadow-[inset_0_0_0_1px_#DBEAFE]">
      <div className="flex items-center gap-[14px]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-white shadow-[inset_0_0_0_1px_#DBEAFE]">
          <Route size={17} strokeWidth={1.9} className="text-[#2563EB]" />
        </div>
        <div className="min-w-0 flex-1">
          {calculating ? (
            <>
              <div className="h-5 w-16 animate-pulse rounded-[4px] bg-[#E4E4E7]" />
              <p className="mt-1 text-[13px] text-[#71717A]">{calculatingLabel}</p>
            </>
          ) : failed || totalKm === null ? (
            <p className="text-[13px] text-[#71717A]">{failedLabel}</p>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-[6px]">
              <span className="text-[20px] font-semibold tracking-[-0.02em] text-[#18181B]">
                {Math.round(totalKm)} km
              </span>
              <span className="text-[13px] text-[#71717A]">{breakdownText}</span>
            </div>
          )}
        </div>
        <span className="shrink-0 self-start text-[12px] text-[#A1A1AA]">{estimateLabel}</span>
      </div>
      {showWarning ? (
        <p className="m-0 mt-3 flex items-start gap-2 rounded-[9px] bg-[#FEF7E6] px-3 py-2 text-[12.5px] leading-[1.4] text-[#8A5512]">
          <AlertTriangle size={14} strokeWidth={2} className="mt-[1px] shrink-0" aria-hidden="true" />
          {warning}
        </p>
      ) : null}
    </div>
  );
}
