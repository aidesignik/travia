"use client";

import { Fragment, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, X, CircleAlert, Bus, ArrowRight, ArrowLeft, Copy, Ban, Trash2, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip } from "@/components/ui/Tooltip";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { formatPlate } from "@/lib/plateDisplay";
import { EMPTY_RETURN_TRIP } from "@/components/forms/ReturnTripFields";
import { RideDocumentsSection } from "./RideDocumentsSection";
import { NewRideModal, type NewRideInitialValues, type NewRideEditValues } from "./NewRideModal";
import { RIDE_STATUS_ACCENT } from "./statusStyles";
import { RingMarker, PinMarker, DotConnector } from "./newRide/timelineMarkers";
import { fetchWithAvailabilityConfirm } from "@/lib/availabilityConfirm";
import { useAvailabilityConfirmDialog } from "@/lib/useAvailabilityConfirmDialog";
import { AssignmentSelect } from "./AssignmentSelect";
import { clientDisplayName } from "@/lib/clientDisplay";
import { formatPhone } from "@/lib/phoneDisplay";
import { displayRideStatus } from "@/lib/rideStatus";
import { formatTime24 } from "@/lib/rideDateFormat";
import { formatPickerDate } from "@/lib/pickerDateFormat";
import { resolveReturnLeg } from "@/lib/rideReturnLeg";
import type { CityLocation } from "@/lib/location";
import type { CalendarDriver, CalendarRide, CalendarVehicle } from "./types";

const AVERAGE_TRIP_DURATION_MS = 4 * 60 * 60 * 1000;

// Assignment section's "Change" button — 32px tall, white fill, 1px
// border, --ink-secondary text (not --ink-primary, unlike the rest of
// this file's buttons — matches the Assignment section's own text-color
// spec, which deliberately sits a step quieter than form buttons).
const SECONDARY_BTN_CLASS =
  "flex h-8 shrink-0 items-center whitespace-nowrap rounded-[8px] border border-[var(--border-control)] bg-white px-3 text-[13px] font-medium text-[var(--ink-secondary)] transition-colors duration-[.12s] ease-out hover:bg-[var(--bg-subtle)]";
// Assignment section's "Assign" button (unassigned state only) — same
// 32px/13px sizing as Change, filled with the app's primary action color.
const PRIMARY_SM_BTN_CLASS =
  "flex h-8 shrink-0 items-center whitespace-nowrap rounded-[8px] bg-[var(--action-bg)] px-3 text-[13px] font-medium text-white transition-colors duration-[.12s] ease-out hover:bg-[var(--action-bg-hover)]";
// Footer actions (§3): icon-only ghost buttons for Duplicate/Cancel/Remove
// from calendar — no border/background at rest, 36×36 so their hit target
// matches a normal button despite having no visible label (a Tooltip +
// aria-label carry that instead).
const FOOTER_ICON_GHOST_BTN_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[var(--ink-muted)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-soft)] focus-visible:bg-[var(--border-soft)] focus-visible:outline-none";
// Cancel ride and Remove from calendar's icons only turn danger-red on
// hover/focus, not at rest — muted ghost buttons like Duplicate until
// actively engaged.
const FOOTER_ICON_GHOST_DANGER_BTN_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[var(--ink-muted)] transition-colors duration-[.12s] ease-out hover:bg-[#FEF2F2] hover:text-[var(--ink-destructive)] focus-visible:bg-[#FEF2F2] focus-visible:text-[var(--ink-destructive)] focus-visible:outline-none";
const FOOTER_EDIT_BTN_CLASS =
  "flex h-9 shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[8px] border border-[var(--border-control)] px-[14px] text-[14px] font-medium text-[var(--ink-primary)] transition-colors duration-[.12s] ease-out hover:bg-[#FAFAFA]";
// Assignment section's unassigned-vehicle/driver placeholder — warm amber
// "needs attention" treatment, distinct from the app's red destructive
// color since nothing has gone wrong yet, it's just an open task.
const UNASSIGNED_TILE_CLASS = "flex h-9 w-9 shrink-0 items-center justify-center border-[1.5px] border-dashed";
const UNASSIGNED_TILE_STYLE = { borderColor: "#C9B48A", background: "#FFF8EC" };
const UNASSIGNED_ICON_COLOR = "#8A5A12";
const UNASSIGNED_TITLE_STYLE = { color: "#9A5B0F" };
// The Trip section's own row title/subtitle classes (stop name / stop
// address) — reused as-is for the Assignment section's vehicle/driver
// name and meta lines so the two sections share one typographic scale
// instead of drifting apart. Single source of truth: change the Trip
// section's look here and Assignment follows.
const ROW_TITLE_CLASS = "truncate text-[14px] font-medium leading-5 text-[#18181B]";
const ROW_SUBTITLE_CLASS = "truncate text-[13px] text-[#71717A]";

function toDateTimeInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "Edit ride" opens the exact same form as "+ New Ride" (NewRideModal),
// prefilled with the ride's current state — this builds that prefill from
// a CalendarRide.
function buildEditValues(ride: CalendarRide): NewRideEditValues {
  const hasReturnOverride = Boolean(ride.returnPickupCity || ride.returnDestinationCity);
  return {
    rideId: ride.id,
    clientId: ride.clientId,
    clientCompanyName: ride.client.companyName ?? "",
    clientName: ride.client.name ?? "",
    clientEmail: ride.client.email,
    clientPhone: ride.client.phone ?? "",
    pickupCity: ride.pickupCity,
    pickupLocation: ride.pickupLocation,
    destinationCity: ride.destinationCity,
    destinationLocation: ride.destinationLocation,
    stops: ride.stops,
    departureAt: toDateTimeInputValue(ride.departureAt),
    isRoundTrip: ride.isRoundTrip,
    returnAt: ride.returnAt ? toDateTimeInputValue(ride.returnAt) : "",
    returnTrip: hasReturnOverride
      ? {
          differentReturnRoute: true,
          returnPickupCity: ride.returnPickupCity ?? "",
          returnPickupLocation: ride.returnPickupLocation ?? "",
          returnStops: ride.returnStops,
          returnDestinationCity: ride.returnDestinationCity ?? "",
          returnDestinationLocation: ride.returnDestinationLocation ?? "",
        }
      : EMPTY_RETURN_TRIP,
    passengerCount: String(ride.passengerCount),
    specialRequests: ride.specialRequests ?? "",
    vehicleId: ride.vehicleId ?? "",
    driverId: ride.driverId ?? "",
    price: ride.price ?? "",
    distanceKm: ride.estimatedDistanceKm,
  };
}

// A single stop row within a leg block (§2) — city/location only, no role
// word. `time` is set only on the first row (scheduled departure) and the
// last row (estimated arrival, muted); intermediate stops carry no time.
interface RouteLegRow {
  city: string;
  location: string;
  time: string | null;
  muted?: boolean;
}

interface RouteLeg {
  key: "outbound" | "return";
  label: string;
  date: Date;
  rows: RouteLegRow[];
  // True only when the return leg's stops are exactly the outbound leg's
  // stops in reverse order (same city + location at each matching
  // position) — shown as a note instead of repeating an identical stop
  // list. A return with fewer/different/no stops describes a genuinely
  // different route, even with no custom pickup/destination override, so
  // it isn't flagged here — the stop rows below already say what it is.
  sameRouteReversed?: boolean;
}

function stopsAreReverseOf(outboundStops: CityLocation[], returnStops: CityLocation[]): boolean {
  if (outboundStops.length !== returnStops.length) return false;
  return outboundStops.every((stop, i) => {
    const mirrored = returnStops[returnStops.length - 1 - i];
    return mirrored.city === stop.city && mirrored.location === stop.location;
  });
}

export function RideDetailDrawer({
  ride,
  vehicles,
  drivers,
  onClose,
  onChanged,
  // Set by a row's action menu (e.g. BookingsTable) to skip straight past
  // the detail view into editing or the cancel confirmation, instead of
  // opening the drawer and making the carrier click again.
  initialAction,
}: {
  ride: CalendarRide;
  vehicles: CalendarVehicle[];
  drivers: CalendarDriver[];
  onClose: () => void;
  onChanged: () => void;
  initialAction?: "edit" | "cancel";
}) {
  const t = useTranslations();
  const tType = useTranslations("vehicleType");
  const tDetail = useTranslations("carrier.calendar.detail");
  const locale = useLocale();

  const { confirm: confirmAvailability, dialog: availabilityDialog } = useAvailabilityConfirmDialog();

  const [changingField, setChangingField] = useState<"vehicle" | "driver" | null>(null);
  const [pendingValue, setPendingValue] = useState("");
  // Which vehicles/drivers already have an overlapping ride or block for
  // this ride's own departure/return window, and that conflict's window —
  // fetched when the "Change" picker opens so it can flag them (not hide
  // them; a carrier may still deliberately double-book) and confirm the
  // moment a busy one is picked, same as the New Ride form.
  const [vehicleConflicts, setVehicleConflicts] = useState<Map<string, { start: string; end: string }>>(new Map());
  const [driverConflicts, setDriverConflicts] = useState<Map<string, { start: string; end: string }>>(new Map());
  // The vehicle/driver id the carrier already clicked "assign anyway" for
  // when picking it — lets saveAssignment skip asking the same question
  // again if that's still the pending selection.
  const [confirmedPendingValue, setConfirmedPendingValue] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // "Edit ride" opens the full NewRideModal (same form as "+ New Ride"),
  // prefilled via buildEditValues — see there for the trip-detail/client/
  // price/assignment editing this used to do inline.
  const [editingRide, setEditingRide] = useState(initialAction === "edit");

  const [duplicating, setDuplicating] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(initialAction === "cancel");
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Quick standalone override for the Trip section's computed total — lets
  // a carrier who disagrees with the maps estimate correct it on its own,
  // without opening the full "Edit ride" form.
  const [editingDistanceOnly, setEditingDistanceOnly] = useState(false);
  const [distanceOverrideInput, setDistanceOverrideInput] = useState("");
  const [savingDistanceOverride, setSavingDistanceOverride] = useState(false);

  // Trip details freeze, and Cancel disappears, once a ride is cancelled
  // or has effectively completed (past its date) — including the
  // date-based inference, not just an explicit "Mark completed". A ride
  // that already happened isn't something to cancel.
  const status = displayRideStatus(ride);
  const editable = status !== "CANCELLED" && status !== "COMPLETED";
  const cancellable = editable;

  const vehicle = vehicles.find((v) => v.id === ride.vehicleId);
  const driver = drivers.find((d) => d.id === ride.driverId);

  const now = new Date();
  const departure = new Date(ride.departureAt);
  const returnAt = ride.returnAt ? new Date(ride.returnAt) : null;

  const blocking = ride.status === "PENDING" && (!ride.vehicleId || !ride.driverId);
  const blockingText = !ride.vehicleId ? tDetail("vehicleMissing") : t("carrier.assignment.noDriverAssigned");

  // A confirmed ride whose trip window has already passed but was never
  // explicitly closed out — rather than force a "mark completed" step, the
  // carrier can just remove it, since at this point it either happened (and
  // needs no further action) or never did (and shouldn't linger).
  const canRemoveFromCalendar = ride.status === "CONFIRMED" && now >= departure;
  const overCapacity = Boolean(vehicle) && ride.passengerCount > vehicle!.seats;

  const resolvedReturn = ride.isRoundTrip
    ? resolveReturnLeg(
        {
          pickupCity: ride.pickupCity,
          pickupLocation: ride.pickupLocation,
          destinationCity: ride.destinationCity,
          destinationLocation: ride.destinationLocation,
          stops: ride.stops,
        },
        {
          returnPickupCity: ride.returnPickupCity ?? undefined,
          returnPickupLocation: ride.returnPickupLocation ?? undefined,
          returnDestinationCity: ride.returnDestinationCity ?? undefined,
          returnDestinationLocation: ride.returnDestinationLocation ?? undefined,
          returnStops: ride.returnStops,
        },
      )
    : null;

  const routeTitle = `${ride.pickupCity} → ${ride.destinationCity}${
    resolvedReturn ? ` → ${resolvedReturn.destinationCity}` : ""
  }`;

  // Per-leg route blocks for the view-mode Ruta section (§1-§2): each leg
  // is its own date-separator-chip header + stop list, departure time on
  // the first row and estimated arrival (reusing the same
  // AVERAGE_TRIP_DURATION_MS convention as the outbound leg) on the last.
  const estimatedArrival = new Date(departure.getTime() + AVERAGE_TRIP_DURATION_MS);
  const outboundLeg: RouteLeg = {
    key: "outbound",
    label: tDetail("outboundLabel"),
    date: departure,
    rows: [
      { city: ride.pickupCity, location: ride.pickupLocation, time: formatTime24(departure) },
      ...ride.stops.map((s) => ({ city: s.city, location: s.location, time: null })),
      {
        city: ride.destinationCity,
        location: ride.destinationLocation,
        time: `~${formatTime24(estimatedArrival)}`,
        muted: true,
      },
    ],
  };

  const legs: RouteLeg[] = [outboundLeg];
  if (resolvedReturn) {
    const returnEstimatedArrival = returnAt ? new Date(returnAt.getTime() + AVERAGE_TRIP_DURATION_MS) : null;
    const sameRouteReversed =
      !ride.returnPickupCity && !ride.returnDestinationCity && stopsAreReverseOf(ride.stops, resolvedReturn.stops);
    legs.push({
      key: "return",
      label: tDetail("returnLabel"),
      date: returnAt ?? departure,
      sameRouteReversed,
      rows: [
        {
          city: resolvedReturn.pickupCity,
          location: resolvedReturn.pickupLocation,
          time: returnAt ? formatTime24(returnAt) : null,
        },
        ...resolvedReturn.stops.map((s) => ({ city: s.city, location: s.location, time: null })),
        {
          city: resolvedReturn.destinationCity,
          location: resolvedReturn.destinationLocation,
          time: returnEstimatedArrival ? `~${formatTime24(returnEstimatedArrival)}` : null,
          muted: true,
        },
      ],
    });
  }

  const totalKm = ride.estimatedDistanceKm ?? null;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayCount = returnAt ? Math.round((startOfDay(returnAt).getTime() - startOfDay(departure).getTime()) / DAY_MS) + 1 : null;
  const multiDay = dayCount !== null && dayCount > 1;

  function startChanging(field: "vehicle" | "driver") {
    setChangingField(field);
    setPendingValue(field === "vehicle" ? ride.vehicleId ?? "" : ride.driverId ?? "");
    setConfirmedPendingValue(null);
    setError(null);

    const params = new URLSearchParams({ departureAt: ride.departureAt, excludeRideId: ride.id });
    if (ride.returnAt) params.set("returnAt", ride.returnAt);
    fetch(`/api/carrier/availability/resources?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setVehicleConflicts(
          new Map(
            data.vehicles.filter((v: CalendarVehicle) => v.busy).map((v: CalendarVehicle) => [v.id, { start: v.busyStart, end: v.busyEnd }]),
          ),
        );
        setDriverConflicts(
          new Map(
            data.drivers.filter((d: CalendarDriver) => d.busy).map((d: CalendarDriver) => [d.id, { start: d.busyStart, end: d.busyEnd }]),
          ),
        );
      })
      .catch(() => {});
  }

  // Confirms "already booked" the moment a busy vehicle/driver is picked in
  // the "Change" dropdown (not only when Save is clicked) — only commits
  // the pending selection if the dispatcher confirms.
  async function pickPendingValue(id: string) {
    const conflicts = changingField === "vehicle" ? vehicleConflicts : driverConflicts;
    const conflict = conflicts.get(id);
    if (conflict) {
      const start = conflict.start ? new Date(conflict.start).toLocaleDateString() : "";
      const end = conflict.end ? new Date(conflict.end).toLocaleDateString() : "";
      const ok = await confirmAvailability(t("carrier.calendar.availabilityWarning", { start, end }));
      if (!ok) return;
      setConfirmedPendingValue(id);
    }
    setPendingValue(id);
  }

  async function saveAssignment() {
    if (!changingField) return;
    setBusy(changingField);
    setError(null);
    const body = changingField === "vehicle" ? { vehicleId: pendingValue } : { driverId: pendingValue };
    const { response: res, declinedAvailability } = await fetchWithAvailabilityConfirm(
      `/api/carrier/rides/${ride.id}/assign`,
      "POST",
      body,
      (start, end) => t("carrier.calendar.availabilityWarning", { start, end }),
      confirmAvailability,
      pendingValue !== "" && pendingValue === confirmedPendingValue,
    );
    setBusy(null);
    if (!res.ok) {
      if (!declinedAvailability) setError(t("common.saveFailed"));
      return;
    }
    setChangingField(null);
    onChanged();
  }

  async function saveDistanceOverride() {
    const km = Number(distanceOverrideInput);
    if (!km || km <= 0) return;
    setSavingDistanceOverride(true);
    setError(null);
    const res = await fetch(`/api/carrier/rides/${ride.id}/distance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distanceKm: km }),
    });
    setSavingDistanceOverride(false);
    if (!res.ok) {
      setError(t("common.saveFailed"));
      return;
    }
    setEditingDistanceOnly(false);
    onChanged();
  }

  async function cancelRide() {
    setConfirmingCancel(false);
    setBusy("cancel");
    setError(null);
    const res = await fetch(`/api/carrier/rides/${ride.id}/cancel`, { method: "POST" });
    setBusy(null);
    if (!res.ok) {
      setError(t("common.saveFailed"));
      return;
    }
    onChanged();
  }

  async function removeFromCalendar() {
    setConfirmingRemove(false);
    setBusy("remove");
    setError(null);
    const res = await fetch(`/api/carrier/rides/${ride.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      setError(t("common.saveFailed"));
      return;
    }
    onChanged();
    onClose();
  }

  const duplicateInitialValues: NewRideInitialValues = {
    clientCompanyName: ride.client.companyName ?? "",
    clientName: ride.client.name ?? "",
    clientPhone: ride.client.phone ?? "",
    pickupCity: ride.pickupCity,
    pickupLocation: ride.pickupLocation,
    destinationCity: ride.destinationCity,
    destinationLocation: ride.destinationLocation,
    stops: ride.stops,
    passengerCount: String(ride.passengerCount),
    specialRequests: ride.specialRequests ?? "",
  };

  return (
    <>
      <SidePanel onClose={onClose} label={routeTitle}>
        <div className="shrink-0 border-b border-[var(--border-hairline)] px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 truncate text-[19px] font-semibold tracking-[-0.015em] text-[var(--ink-primary)]">
              {routeTitle}
            </h2>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onClose}
                aria-label={t("common.close")}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--ink-secondary)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-soft)]"
              >
                <X size={17} strokeWidth={1.9} />
              </button>
            </div>
          </div>

          <p className="mt-[3px] truncate text-[13px] text-[var(--ink-secondary)]">
            {clientDisplayName(ride.client)} · #{ride.id.slice(-6).toUpperCase()}
          </p>

          <div className="mt-2 flex items-center gap-[6px] text-[13.5px]">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: RIDE_STATUS_ACCENT[status] }} />
            <span className="text-[#27272B]">{t(`rideStatus.${status}`)}</span>
            {blocking ? (
              <>
                <span className="text-[#D4D4D8]">·</span>
                <span className="flex items-center gap-[4px] text-[var(--ink-destructive)]">
                  <CircleAlert size={14} strokeWidth={1.9} />
                  {blockingText}
                </span>
              </>
            ) : null}
            {totalKm !== null ? (
              <span className="inline-flex items-center rounded-full bg-[#F4F4F5] px-2 py-[3px] text-[12px] font-medium tabular-nums text-[#3F3F46]">
                {Math.round(totalKm)} km
              </span>
            ) : null}
            {multiDay ? (
              <span className="inline-flex items-center rounded-full bg-[#F4F4F5] px-2 py-[3px] text-[12px] font-medium tabular-nums text-[#3F3F46]">
                {tDetail("daysChip", { days: dayCount })}
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="border-b border-[var(--border-hairline)] px-6 py-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="text-[13.5px] font-semibold text-[var(--ink-primary)]">{tDetail("trip")}</h3>
              {!editable ? null : !editingDistanceOnly ? (
                <button
                  type="button"
                  onClick={() => {
                    setDistanceOverrideInput(ride.estimatedDistanceKm ? String(Math.round(ride.estimatedDistanceKm)) : "");
                    setEditingDistanceOnly(true);
                  }}
                  className="text-[12.5px] text-[#71717A] underline-offset-2 hover:text-[var(--ink-secondary)] hover:underline"
                >
                  {totalKm !== null ? tDetail("editDistance") : tDetail("addDistance")}
                </button>
              ) : (
                <div className="flex items-center gap-[6px]">
                  <input
                    type="number"
                    min={1}
                    step="0.1"
                    autoFocus
                    value={distanceOverrideInput}
                    onChange={(e) => setDistanceOverrideInput(e.target.value)}
                    className="h-7 w-20 rounded-[6px] border border-[var(--border-control)] px-2 text-[13px] text-[var(--ink-primary)] focus:outline-none focus:border-[#2563EB]"
                  />
                  <span className="text-[13px] text-[var(--ink-muted)]">km</span>
                  <button
                    type="button"
                    onClick={saveDistanceOverride}
                    disabled={savingDistanceOverride}
                    className="text-[13px] font-medium text-[var(--action-bg)] hover:underline disabled:opacity-50"
                  >
                    {savingDistanceOverride ? t("common.loading") : t("common.save")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingDistanceOnly(false)}
                    className="text-[13px] text-[var(--ink-muted)] hover:underline"
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-5">
                {legs.map((leg) => (
                  <div key={leg.key}>
                    <div className="flex items-center gap-[10px]">
                      <span
                        className="inline-flex h-[26px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-full bg-[#F4F4F5] text-[12.5px] font-medium tabular-nums text-[#27272B]"
                        style={{ padding: "0 10px 0 8px" }}
                      >
                        {leg.key === "outbound" ? (
                          <ArrowRight size={14} strokeWidth={2} color="#3F3F46" />
                        ) : (
                          <ArrowLeft size={14} strokeWidth={2} color="#3F3F46" />
                        )}
                        {leg.label} · {formatPickerDate(leg.date, locale)}
                      </span>
                      <span className="h-px flex-1 bg-[#F0F0F2]" />
                    </div>
                    {leg.sameRouteReversed ? (
                      <p className="mt-[6px] text-[12.5px] text-[#A1A1AA]">{tDetail("sameRouteReversed")}</p>
                    ) : null}
                    <div className="mt-[12px] flex flex-col gap-[2px]">
                      {leg.rows.map((row, i) => (
                        <Fragment key={i}>
                          <div className="flex items-center gap-3">
                            <div className="flex h-5 w-4 shrink-0 items-center justify-center">
                              {i === leg.rows.length - 1 ? <PinMarker /> : <RingMarker />}
                            </div>
                            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className={ROW_TITLE_CLASS}>{row.city}</p>
                                {row.location ? <p className={ROW_SUBTITLE_CLASS}>{row.location}</p> : null}
                              </div>
                              {row.time ? (
                                <span
                                  className={`shrink-0 pt-[1px] text-[13px] tabular-nums ${
                                    row.muted ? "text-[#A1A1AA]" : "text-[#3F3F46]"
                                  }`}
                                >
                                  {row.time}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {i < leg.rows.length - 1 ? (
                            <div className="flex items-center gap-3">
                              <div className="flex w-4 shrink-0 items-center justify-center">
                                <DotConnector />
                              </div>
                              <div />
                            </div>
                          ) : null}
                        </Fragment>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="border-b border-[var(--border-hairline)] px-6 py-5">
            <h3 className="mb-3 text-[14px] font-semibold text-[var(--ink-primary)]">{tDetail("assignmentSection")}</h3>
            <div className="flex flex-col gap-4">
              <div className="flex min-h-9 items-center gap-3">
                {vehicle ? (
                  <>
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: "#EEF0F2" }}
                    >
                      <Bus size={18} strokeWidth={1.9} color="#3C4A5C" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={ROW_TITLE_CLASS}>
                        {tType(vehicle.type)} {vehicle.model}
                      </p>
                      <p className={ROW_SUBTITLE_CLASS}>
                        {vehicle.licensePlate ? (
                          <span className="font-mono text-[12px] text-[var(--ink-secondary)]">
                            {formatPlate(vehicle.licensePlate)}
                          </span>
                        ) : (
                          "—"
                        )}
                        {` · ${vehicle.seats} ${t("carrier.fleetTable.seats")}`}
                      </p>
                    </div>
                    <button type="button" onClick={() => startChanging("vehicle")} className={SECONDARY_BTN_CLASS}>
                      {tDetail("change")}
                    </button>
                  </>
                ) : (
                  <>
                    <div className={`${UNASSIGNED_TILE_CLASS} rounded-[10px]`} style={UNASSIGNED_TILE_STYLE}>
                      <Bus size={18} strokeWidth={1.9} color={UNASSIGNED_ICON_COLOR} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium" style={UNASSIGNED_TITLE_STYLE}>
                        {tDetail("vehicleMissing")}
                      </p>
                      <p className="mt-[2px] truncate text-[13px] text-[var(--ink-muted)]">{tDetail("assignPrompt")}</p>
                    </div>
                    <button type="button" onClick={() => startChanging("vehicle")} className={PRIMARY_SM_BTN_CLASS}>
                      {tDetail("assignVehicle")}
                    </button>
                  </>
                )}
              </div>

              {changingField === "vehicle" ? (
                <div className="flex items-center gap-2 pl-12">
                  <div className="flex-1">
                    <AssignmentSelect
                      value={pendingValue}
                      onChange={pickPendingValue}
                      placeholder="—"
                      busyLabel={t("carrier.calendar.alreadyBooked")}
                      options={vehicles.map((v) => ({
                        id: v.id,
                        label: `${tType(v.type)} ${v.model}`,
                        busy: vehicleConflicts.has(v.id),
                      }))}
                    />
                  </div>
                  <Button type="button" compact disabled={busy === "vehicle"} onClick={saveAssignment}>
                    {busy === "vehicle" ? t("common.loading") : t("common.save")}
                  </Button>
                  <Button type="button" variant="ghost" compact onClick={() => setChangingField(null)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : null}

              <div className="flex min-h-9 items-center gap-3">
                {driver ? (
                  <>
                    <DriverAvatar driver={driver} size={36} decorative />
                    <div className="min-w-0 flex-1">
                      <p className={ROW_TITLE_CLASS}>{driver.name}</p>
                      {driver.phone ? (
                        <a
                          href={`tel:${driver.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className={`${ROW_SUBTITLE_CLASS} flex items-center gap-[4px] hover:underline`}
                        >
                          <Phone size={12} strokeWidth={1.9} className="shrink-0" />
                          {formatPhone(driver.phone)}
                        </a>
                      ) : (
                        <p className={ROW_SUBTITLE_CLASS}>—</p>
                      )}
                    </div>
                    <button type="button" onClick={() => startChanging("driver")} className={SECONDARY_BTN_CLASS}>
                      {tDetail("change")}
                    </button>
                  </>
                ) : (
                  <>
                    <div className={`${UNASSIGNED_TILE_CLASS} rounded-full`} style={UNASSIGNED_TILE_STYLE}>
                      <User size={18} strokeWidth={1.9} color={UNASSIGNED_ICON_COLOR} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium" style={UNASSIGNED_TITLE_STYLE}>
                        {tDetail("driverMissing")}
                      </p>
                      <p className="mt-[2px] truncate text-[13px] text-[var(--ink-muted)]">{tDetail("assignPrompt")}</p>
                    </div>
                    <button type="button" onClick={() => startChanging("driver")} className={PRIMARY_SM_BTN_CLASS}>
                      {tDetail("assignDriver")}
                    </button>
                  </>
                )}
              </div>

              {changingField === "driver" ? (
                <div className="flex items-center gap-2 pl-12">
                  <div className="flex-1">
                    <AssignmentSelect
                      value={pendingValue}
                      onChange={pickPendingValue}
                      placeholder="—"
                      busyLabel={t("carrier.calendar.alreadyBooked")}
                      options={drivers.map((d) => ({ id: d.id, label: d.name, busy: driverConflicts.has(d.id) }))}
                    />
                  </div>
                  <Button type="button" compact disabled={busy === "driver"} onClick={saveAssignment}>
                    {busy === "driver" ? t("common.loading") : t("common.save")}
                  </Button>
                  <Button type="button" variant="ghost" compact onClick={() => setChangingField(null)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-b border-[var(--border-hairline)] px-6 py-5">
            <h3 className="mb-3 text-[14px] font-semibold text-[var(--ink-primary)]">{tDetail("detailsSection")}</h3>
            <div className="grid gap-y-[10px] text-[14px]" style={{ gridTemplateColumns: "120px 1fr" }}>
              <span className="text-[var(--ink-secondary)]">{tDetail("passengers")}</span>
              <span className={`font-medium ${overCapacity ? "text-[var(--ink-destructive)]" : "text-[var(--ink-primary)]"}`}>
                {ride.passengerCount}
                {vehicle ? <span className="text-[var(--ink-muted)]">/{vehicle.seats}</span> : null}
              </span>

              <span className="text-[var(--ink-secondary)]">{t("common.phone")}</span>
              <span className="font-medium text-[var(--ink-primary)]">
                {ride.client.phone ? formatPhone(ride.client.phone) : "—"}
              </span>

              <span className="text-[var(--ink-secondary)]">{tDetail("distanceLabel")}</span>
              <span className="font-medium tabular-nums text-[var(--ink-primary)]">
                {totalKm !== null ? `${Math.round(totalKm)} km` : "—"}
              </span>

              <span className="text-[var(--ink-secondary)]">{tDetail("price")}</span>
              <span className="font-semibold tabular-nums text-[var(--ink-primary)]">
                {ride.price !== null ? `${Number(ride.price).toLocaleString()} ${ride.currency}` : "—"}
              </span>
            </div>
          </div>

          {vehicle && driver && ride.price !== null ? (
            <RideDocumentsSection rideId={ride.id} clientEmail={ride.client.email} />
          ) : null}

          {error ? <p className="border-b border-[var(--border-hairline)] px-6 py-3 text-[13.5px] text-[var(--ink-destructive)]">{error}</p> : null}
        </div>

        <div
          className="mt-auto flex shrink-0 items-center justify-between border-t border-[var(--border-hairline)]"
          style={{ padding: "16px 24px" }}
        >
          <div className="flex items-center gap-1">
            <Tooltip label={tDetail("duplicateRide")}>
              <button
                type="button"
                onClick={() => setDuplicating(true)}
                aria-label={tDetail("duplicateRide")}
                className={FOOTER_ICON_GHOST_BTN_CLASS}
              >
                <Copy size={18} strokeWidth={1.9} />
              </button>
            </Tooltip>
            {cancellable ? (
              <Tooltip label={t("carrier.calendar.cancelRide")}>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  aria-label={t("carrier.calendar.cancelRide")}
                  className={FOOTER_ICON_GHOST_DANGER_BTN_CLASS}
                >
                  <Ban size={18} strokeWidth={1.9} />
                </button>
              </Tooltip>
            ) : null}
            {canRemoveFromCalendar ? (
              <Tooltip label={tDetail("removeFromCalendar")}>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  aria-label={tDetail("removeFromCalendar")}
                  className={FOOTER_ICON_GHOST_DANGER_BTN_CLASS}
                >
                  <Trash2 size={18} strokeWidth={1.9} />
                </button>
              </Tooltip>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {editable ? (
              <button type="button" onClick={() => setEditingRide(true)} className={FOOTER_EDIT_BTN_CLASS}>
                <Pencil size={16} strokeWidth={1.9} />
                {tDetail("editRide")}
              </button>
            ) : null}
          </div>
        </div>
      </SidePanel>

      {confirmingCancel ? (
        <ConfirmDialog
          title={t("carrier.calendar.cancelConfirmTitle")}
          body={t("carrier.calendar.cancelConfirmBody")}
          cancelLabel={t("common.back")}
          confirmLabel={t("carrier.calendar.cancelRide")}
          confirming={busy === "cancel"}
          onCancel={() => setConfirmingCancel(false)}
          onConfirm={cancelRide}
        />
      ) : null}

      {confirmingRemove ? (
        <ConfirmDialog
          title={t("carrier.calendar.removeConfirmTitle")}
          body={t("carrier.calendar.removeConfirmBody")}
          cancelLabel={t("common.back")}
          confirmLabel={tDetail("removeFromCalendar")}
          confirming={busy === "remove"}
          onCancel={() => setConfirmingRemove(false)}
          onConfirm={removeFromCalendar}
        />
      ) : null}

      {duplicating ? (
        <NewRideModal
          initialValues={duplicateInitialValues}
          onClose={() => setDuplicating(false)}
          onCreated={() => {
            setDuplicating(false);
            onChanged();
          }}
        />
      ) : null}

      {editingRide ? (
        <NewRideModal
          editValues={buildEditValues(ride)}
          onClose={() => setEditingRide(false)}
          onCreated={() => {
            setEditingRide(false);
            onChanged();
          }}
        />
      ) : null}

      {availabilityDialog}
    </>
  );
}
