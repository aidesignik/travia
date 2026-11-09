"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bus, User, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
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

// The app's unassigned vehicle/driver tile colours (see RideDetailDrawer).
const UNASSIGNED_TILE_STYLE = { borderColor: "#C9B48A", background: "#FFF8EC", color: "#8A5A12" };

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
  const dateLabel = (local: string) =>
    new Intl.DateTimeFormat(intlLocale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(local));
  const time = (local: string) => local.slice(11, 16);
  const sameDay = proposal.returnAt && proposal.returnAt.slice(0, 10) === proposal.departureAt.slice(0, 10);
  const client = proposal.clientCompanyName || proposal.clientName;
  const route = [proposal.pickupCity || "?", proposal.destinationCity || "?"].join(proposal.isRoundTrip ? " ⇄ " : " → ");
  const fullRoute = [proposal.pickupLocation, ...proposal.stops.map((s) => s.location), proposal.destinationLocation].join(" → ");

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

  const missingValue = <span className="text-[var(--ink-destructive)]">{t("missingValue")}</span>;

  // Date / Departure / Return: label on top, value below (times in mono).
  const cell = (label: string, value: ReactNode, sub?: string | null) => (
    <div className="min-w-0">
      <p className="text-[12.5px] font-medium text-[var(--ink-secondary)]">{label}</p>
      <p className="mt-[2px] truncate text-[14px] font-medium text-[var(--ink-primary)]">{value}</p>
      {sub ? <p className="truncate text-[12px] font-medium text-[var(--ink-secondary)]">{sub}</p> : null}
    </div>
  );
  const mono = (value: string) => <span className="font-mono">{value}</span>;

  const detail = (label: string, value: string | null, missing = false) => (
    <div className="flex gap-3 text-[13px] leading-[18px]">
      <span className="w-[86px] shrink-0 font-medium text-[var(--ink-secondary)]">{label}</span>
      <span className="min-w-0 font-medium text-[var(--ink-primary)]">{missing ? missingValue : value}</span>
    </div>
  );

  // Vehicle / driver: the assigned name, or the app's unassigned tile (the
  // same warm dashed treatment as the ride details drawer).
  const assignment = (Icon: LucideIcon, assigned: string | null, emptyLabel: string, round: boolean) => (
    <div className="flex min-w-0 items-center gap-[10px]">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center border ${round ? "rounded-full" : "rounded-[8px]"} ${
          assigned ? "border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-secondary)]" : "border-dashed"
        }`}
        style={assigned ? undefined : UNASSIGNED_TILE_STYLE}
      >
        <Icon size={16} strokeWidth={1.9} aria-hidden />
      </span>
      <span
        className="min-w-0 truncate text-[13px] font-medium"
        style={assigned ? { color: "var(--ink-primary)" } : { color: UNASSIGNED_TILE_STYLE.color }}
      >
        {assigned ?? emptyLabel}
      </span>
    </div>
  );

  return (
    <div className="mt-3 overflow-hidden rounded-[12px] border border-[var(--border-hairline)] bg-white shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13.5px] font-semibold text-[var(--ink-primary)]">{t("draftTitle")}</p>
          <span
            className={`rounded-pill px-2 py-[2px] text-[12px] font-medium ${
              created
                ? "bg-[var(--status-completed-bg)] text-[var(--status-completed-text)]"
                : "bg-[var(--status-cancelled-bg)] text-[var(--status-cancelled-text)]"
            }`}
          >
            {created ? t("created") : t("notCreated")}
          </span>
        </div>

        <div>
          <p className="text-[15px] font-semibold text-[var(--ink-primary)]">{route}</p>
          <p className="mt-[2px] text-[13px] font-medium text-[var(--ink-secondary)]">{client || missingValue}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {cell(t("date"), proposal.departureAt ? dateLabel(proposal.departureAt) : missingValue)}
          {cell(t("departure"), proposal.departureAt ? mono(time(proposal.departureAt)) : missingValue)}
          {proposal.isRoundTrip
            ? cell(
                t("return"),
                proposal.returnAt ? mono(time(proposal.returnAt)) : missingValue,
                proposal.returnAt && !sameDay ? dateLabel(proposal.returnAt) : null,
              )
            : cell(t("return"), t("oneWay"))}
        </div>

        <div className="flex flex-col gap-[5px]">
          {detail(t("passengers"), proposal.passengerCount ? String(proposal.passengerCount) : null, !proposal.passengerCount)}
          {proposal.stops.length > 0 ? detail(t("route"), fullRoute) : null}
          {proposal.clientEmail || proposal.missing.includes("clientEmail")
            ? detail(t("email"), proposal.clientEmail, proposal.missing.includes("clientEmail"))
            : null}
          {proposal.distanceKm ? detail(t("distance"), `~${proposal.distanceKm} km`) : null}
          {proposal.specialRequests ? detail(t("notes"), proposal.specialRequests) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {assignment(Bus, proposal.vehicle?.label ?? null, t("noVehicle"), false)}
          {assignment(User, proposal.driver?.name ?? null, t("noDriver"), true)}
        </div>

        {!created && !complete ? <p className="text-[12.5px] font-medium text-[var(--ink-secondary)]">{t("missingHint")}</p> : null}
        {!created && error ? <p className="text-[12.5px] font-medium text-[var(--ink-destructive)]">{error}</p> : null}
      </div>

      {created ? null : (
        <div className="flex gap-2 border-t border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-4 py-3">
          <Button compact className="flex-1" onClick={() => void create()} disabled={!complete || saving}>
            {saving ? t("creating") : t("create")}
          </Button>
          <Button compact variant="secondary" onClick={() => setFormOpen(true)}>
            {t("openInForm")}
          </Button>
        </div>
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
