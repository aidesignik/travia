"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeftRight, ArrowRight, Check } from "lucide-react";
import { NewRideModal, type NewRideInitialValues } from "@/components/calendar/NewRideModal";
import { fetchWithAvailabilityConfirm } from "@/lib/availabilityConfirm";
import { useAvailabilityConfirmDialog } from "@/lib/useAvailabilityConfirmDialog";
import { localDateTimeToISOString } from "@/lib/pickerDateFormat";
import type { RideProposal } from "@/lib/assistant/tools";

// A local number as typed in chat ("064 123 4567") → "+381641234567", the
// same shape the new-ride form sends; numbers already in +/00 form are kept.
function normalizePhone(raw: string): string | undefined {
  const compact = raw.replace(/[^\d+]/g, "");
  if (!compact) return undefined;
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (compact.startsWith("0")) return `+381${compact.slice(1)}`;
  return `+${compact}`;
}

function toInitialValues(p: RideProposal): NewRideInitialValues {
  return {
    clientId: p.clientId ?? undefined,
    clientCompanyName: p.clientCompanyName || undefined,
    clientName: p.clientName || undefined,
    clientEmail: p.clientEmail || undefined,
    clientPhone: normalizePhone(p.clientPhone),
    pickupCity: p.pickupCity,
    pickupLocation: p.pickupLocation,
    destinationCity: p.destinationCity,
    destinationLocation: p.destinationLocation,
    stops: p.stops,
    passengerCount: p.passengerCount ? String(p.passengerCount) : undefined,
    specialRequests: p.specialRequests || undefined,
    departureAt: p.departureAt || undefined,
    isRoundTrip: p.isRoundTrip,
    returnAt: p.returnAt ?? undefined,
    vehicleId: p.vehicle?.id,
    driverId: p.driver?.id,
  };
}

// The ride the assistant prepared, as a card in the chat. Nothing exists
// until the carrier clicks "Create ride" (the normal quick-create route,
// with the usual "already booked" confirmation) or opens it in the full
// form to adjust and save it there.
export function AssistantProposalCard({
  proposal,
  created,
  onCreated,
}: {
  proposal: RideProposal;
  created: boolean;
  onCreated: () => void;
}) {
  const t = useTranslations("carrier.assistant.card");
  const tCal = useTranslations("carrier.calendar");
  const locale = useLocale();
  const intlLocale = locale === "sr" ? "sr-Latn" : "en";
  const { confirm, dialog } = useAvailabilityConfirmDialog();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const complete = proposal.missing.length === 0;
  const fmt = (local: string) =>
    new Intl.DateTimeFormat(intlLocale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(
      new Date(local),
    );
  const sameDay = proposal.returnAt && proposal.returnAt.slice(0, 10) === proposal.departureAt.slice(0, 10);
  const returnLabel = proposal.returnAt
    ? sameDay
      ? proposal.returnAt.slice(11)
      : fmt(proposal.returnAt)
    : null;
  const client = proposal.clientCompanyName || proposal.clientName;
  const Arrow = proposal.isRoundTrip ? ArrowLeftRight : ArrowRight;

  async function create() {
    setSaving(true);
    setError(null);
    const p = proposal;
    const body = {
      clientId: p.clientId ?? undefined,
      clientCompanyName: p.clientCompanyName || undefined,
      clientName: p.clientName,
      clientEmail: p.clientEmail,
      clientPhone: normalizePhone(p.clientPhone),
      pickupCity: p.pickupCity,
      pickupLocation: p.pickupLocation,
      destinationCity: p.destinationCity,
      destinationLocation: p.destinationLocation,
      stops: p.stops,
      departureAt: localDateTimeToISOString(p.departureAt),
      isRoundTrip: p.isRoundTrip,
      returnAt: p.isRoundTrip && p.returnAt ? localDateTimeToISOString(p.returnAt) : undefined,
      returnStops: [],
      passengerCount: p.passengerCount,
      specialRequests: p.specialRequests || undefined,
      distanceKm: p.distanceKm ?? undefined,
      vehicleId: p.vehicle?.id,
      driverId: p.driver?.id,
    };
    const { response, declinedAvailability } = await fetchWithAvailabilityConfirm(
      "/api/carrier/rides/quick",
      "POST",
      body,
      (start, end) => tCal("availabilityWarning", { start, end }),
      confirm,
    );
    setSaving(false);
    if (response.ok) onCreated();
    else if (!declinedAvailability) setError(t("createFailed"));
  }

  const row = (label: string, value: string | null, missing = false) => (
    <div className="flex gap-3 text-[13px] leading-[18px]">
      <span className="w-[86px] shrink-0 text-[var(--ink-muted)]">{label}</span>
      <span className={missing ? "font-medium text-[var(--ink-destructive)]" : "min-w-0 text-[var(--ink-primary)]"}>
        {missing ? t("missingValue") : value}
      </span>
    </div>
  );

  return (
    <div className="mt-2 rounded-[12px] bg-white p-3 shadow-[inset_0_0_0_1px_var(--border-control)]">
      <p className="flex min-w-0 items-center gap-[6px] text-[14px] font-semibold text-[var(--ink-primary)]">
        <span className="truncate">{proposal.pickupCity || "?"}</span>
        <Arrow size={13} strokeWidth={2} className="shrink-0 text-[var(--ink-secondary)]" aria-hidden />
        <span className="truncate">{proposal.destinationCity || "?"}</span>
      </p>
      <div className="mt-2 flex flex-col gap-[5px]">
        {row(t("client"), client || null, !client)}
        {proposal.clientEmail || proposal.missing.includes("clientEmail")
          ? row(t("email"), proposal.clientEmail, proposal.missing.includes("clientEmail"))
          : null}
        {row(
          t("route"),
          [proposal.pickupLocation, ...proposal.stops.map((s) => s.location), proposal.destinationLocation].join(" → "),
        )}
        {row(t("departure"), proposal.departureAt ? fmt(proposal.departureAt) : null, !proposal.departureAt)}
        {proposal.isRoundTrip ? row(t("return"), returnLabel, !proposal.returnAt) : row(t("return"), t("oneWay"))}
        {row(
          t("passengers"),
          proposal.passengerCount ? String(proposal.passengerCount) : null,
          !proposal.passengerCount,
        )}
        {proposal.vehicle ? row(t("vehicle"), proposal.vehicle.label) : null}
        {proposal.driver ? row(t("driver"), proposal.driver.name) : null}
        {proposal.distanceKm ? row(t("distance"), `~${proposal.distanceKm} km`) : null}
        {proposal.specialRequests ? row(t("notes"), proposal.specialRequests) : null}
      </div>

      {created ? (
        <p className="mt-3 flex items-center gap-[6px] text-[13px] font-semibold text-[#15803D]">
          <Check size={15} strokeWidth={2.4} aria-hidden />
          {t("created")}
        </p>
      ) : (
        <>
          {!complete ? <p className="mt-3 text-[12.5px] text-[var(--ink-secondary)]">{t("missingHint")}</p> : null}
          {error ? <p className="mt-2 text-[12.5px] text-[var(--ink-destructive)]">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void create()}
              disabled={!complete || saving}
              className="h-9 flex-1 rounded-[9px] bg-[var(--action-bg)] text-[13.5px] font-semibold text-white transition-opacity disabled:opacity-45"
            >
              {saving ? t("creating") : t("create")}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="h-9 rounded-[9px] px-3 text-[13.5px] font-semibold text-[var(--ink-primary)] shadow-[inset_0_0_0_1px_var(--border-control)] hover:bg-[var(--border-soft)]"
            >
              {t("openInForm")}
            </button>
          </div>
        </>
      )}

      {formOpen ? (
        <NewRideModal
          initialValues={toInitialValues(proposal)}
          onClose={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false);
            onCreated();
          }}
        />
      ) : null}
      {dialog}
    </div>
  );
}
