"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { SidePanel } from "@/components/ui/SidePanel";
import { AssignmentSelect } from "./AssignmentSelect";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Stepper } from "@/components/ui/Stepper";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import type { DatePickerHandle } from "@/components/ui/DatePicker";
import { ClientCombobox, type ClientMatch } from "@/components/forms/ClientCombobox";
import { EMPTY_RETURN_TRIP, returnTripPayload, type ReturnTripValues } from "@/components/forms/ReturnTripFields";
import { LegCard, DateTimeRow } from "./newRide/RouteLegCard";
import { RouteTimeline } from "./newRide/RouteTimeline";
import { ReturnLegCard } from "./newRide/ReturnLegCard";
import { DistanceCard } from "./newRide/DistanceCard";
import { SHEET_INPUT_CLASS, SHEET_TEXTAREA_CLASS, SHEET_LABEL_CLASS } from "./newRide/sheetFieldClasses";
import { fetchWithAvailabilityConfirm } from "@/lib/availabilityConfirm";
import { useAvailabilityConfirmDialog } from "@/lib/useAvailabilityConfirmDialog";
import { resolveReturnLeg } from "@/lib/rideReturnLeg";
import { combineDateTimeLocal, splitDateTimeLocal, localDateTimeToISOString } from "@/lib/pickerDateFormat";
import type { CityLocation } from "@/lib/location";
import type { CalendarDriver, CalendarVehicle } from "./types";

const DEPARTURE_JUMP_DEBOUNCE_MS = 400;
const DISTANCE_CALC_DEBOUNCE_MS = 900;

export interface NewRideInitialValues {
  clientCompanyName?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  pickupCity?: string;
  pickupLocation?: string;
  destinationCity?: string;
  destinationLocation?: string;
  stops?: CityLocation[];
  passengerCount?: string;
  specialRequests?: string;
}

// "Edit ride" — unlike duplicating (NewRideInitialValues above, a partial
// starting point the carrier fills in further), this is the ride's actual
// current state, fields the carrier can change and then save back. Built by
// RideDetailDrawer from a CalendarRide.
export interface NewRideEditValues {
  rideId: string;
  clientId: string | null;
  clientCompanyName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  pickupCity: string;
  pickupLocation: string;
  destinationCity: string;
  destinationLocation: string;
  stops: CityLocation[];
  departureAt: string;
  isRoundTrip: boolean;
  returnAt: string;
  returnTrip: ReturnTripValues;
  passengerCount: string;
  specialRequests: string;
  vehicleId: string;
  driverId: string;
  price: string;
  distanceKm: number | null;
}

const DEFAULT_PHONE_CC = "381";

// Country code is just a starting guess, not a lock — a client's number
// might not be Serbian, so it's an ordinary editable field. There's no
// delimiter in a stored "+<cc><number>" string, so splitting one back out
// (e.g. a selected client's existing phone) is a best-effort first-3-
// digits guess, matching how every number here has been built so far;
// wrong for an unusual length, but still freely correctable afterward.
function splitPhone(phone: string): { cc: string; number: string } {
  if (!phone) return { cc: DEFAULT_PHONE_CC, number: "" };
  const match = phone.match(/^\+(\d{1,3})(.*)$/);
  return match ? { cc: match[1], number: match[2] } : { cc: DEFAULT_PHONE_CC, number: phone };
}

function isValidPhoneNumber(number: string): boolean {
  const digits = number.replace(/\s/g, "");
  return digits.length === 0 || /^\d{4,12}$/.test(digits);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const MAX_PASSENGERS = 200;

// The form's own state shape, filled from whichever starting point applies:
// edit (the ride's real current values), duplicate (a partial head start),
// or a blank create.
function initialFormState(editValues?: NewRideEditValues, initialValues?: NewRideInitialValues) {
  if (editValues) {
    const phone = splitPhone(editValues.clientPhone);
    return {
      clientCompanyName: editValues.clientCompanyName,
      clientName: editValues.clientName,
      clientEmail: editValues.clientEmail,
      clientPhoneCc: phone.cc,
      clientPhoneNumber: phone.number,
      pickupCity: editValues.pickupCity,
      pickupLocation: editValues.pickupLocation,
      destinationCity: editValues.destinationCity,
      destinationLocation: editValues.destinationLocation,
      stops: editValues.stops,
      departureAt: editValues.departureAt,
      isRoundTrip: editValues.isRoundTrip,
      returnAt: editValues.returnAt,
      returnTrip: editValues.returnTrip,
      passengerCount: editValues.passengerCount,
      specialRequests: editValues.specialRequests,
      vehicleId: editValues.vehicleId,
      driverId: editValues.driverId,
      price: editValues.price,
    };
  }
  const { clientPhone: initialClientPhone, ...restInitialValues } = initialValues ?? {};
  const initialPhone = splitPhone(initialClientPhone ?? "");
  return {
    clientCompanyName: "",
    clientName: "",
    clientEmail: "",
    clientPhoneCc: initialPhone.cc,
    clientPhoneNumber: initialPhone.number,
    pickupCity: "",
    pickupLocation: "",
    destinationCity: "",
    destinationLocation: "",
    stops: [] as CityLocation[],
    departureAt: "",
    // Povratna (round trip) is the default per the v2 sheet spec — a UI
    // default only, same field/payload as before either way.
    isRoundTrip: true,
    returnAt: "",
    returnTrip: EMPTY_RETURN_TRIP,
    passengerCount: "40",
    specialRequests: "",
    vehicleId: "",
    driverId: "",
    // Manually typed by the carrier, RSD — see priceIncludesVat below for
    // whether this figure already has VAT in it. Takes priority over any
    // future auto-suggestion; see quick/route.ts.
    price: "",
    ...restInitialValues,
  };
}

export function NewRideModal({
  onClose,
  onCreated,
  onDepartureDateChange,
  initialValues,
  editValues,
}: {
  onClose: () => void;
  onCreated: () => void;
  // Lets the calendar underneath jump to the picked date's week as the
  // dispatcher fills in the form, for live context — optional so this
  // component doesn't need a caller that wires it up.
  onDepartureDateChange?: (date: Date) => void;
  // Prefills the trip fields (used by "Duplicate" on an existing ride) —
  // deliberately leaves date/vehicle/driver blank so the dispatcher picks
  // fresh availability rather than silently reusing a stale assignment.
  initialValues?: NewRideInitialValues;
  // Set instead of initialValues for "Edit ride" (RideDetailDrawer) — same
  // form, fully prefilled from the ride's current state, PATCHes it instead
  // of creating a new one, and swaps the submit button/title accordingly.
  editValues?: NewRideEditValues;
}) {
  const t = useTranslations();
  const tn = useTranslations("carrier.newRide");
  const { confirm: confirmAvailability, dialog: availabilityDialog } = useAvailabilityConfirmDialog();
  const uid = useId();
  const tType = useTranslations("vehicleType");
  const [form, setForm] = useState(() => initialFormState(editValues, initialValues));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // Whether form.price (above) already has VAT in it — toggled by the
  // carrier. Defaults to excl. for a new ride (how carriers usually quote);
  // when editing, Ride.price is always stored VAT-inclusive (see finalPrice
  // below), so this starts true to match what's actually on screen.
  const [priceIncludesVat, setPriceIncludesVat] = useState(Boolean(editValues));
  const [phoneTouched, setPhoneTouched] = useState(false);
  // Set when a client was picked from the combobox — lets edits to the
  // autofilled fields (a corrected email, a different phone) save back to
  // that same client record instead of being discarded on submit. Cleared
  // if the carrier changes the company name themselves, since that's the
  // clearest sign they now mean a different client. Seeded from the ride's
  // own client when editing.
  const [selectedClientId, setSelectedClientId] = useState<string | null>(editValues?.clientId ?? null);

  const [availableVehicles, setAvailableVehicles] = useState<CalendarVehicle[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<CalendarDriver[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  // The vehicle/driver id the carrier already clicked "assign anyway" for
  // when picking it (see pickVehicle/pickDriver below) — lets onSubmit skip
  // asking the same question again if that's still the current selection.
  const [confirmedVehicleId, setConfirmedVehicleId] = useState<string | null>(null);
  const [confirmedDriverId, setConfirmedDriverId] = useState<string | null>(null);

  const [distanceKm, setDistanceKm] = useState<number | null>(editValues?.distanceKm ?? null);
  const [outboundKm, setOutboundKm] = useState<number | null>(null);
  const [returnKm, setReturnKm] = useState<number | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState(false);

  const returnDateRef = useRef<DatePickerHandle>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Live distance preview — recalculates as the pickup/destination/stops
  // (and, for a round trip, the return leg) are filled in, same debounced
  // pattern as CarrierRideForm. Stored with the ride on submit so
  // assignment doesn't need to re-estimate it later.
  useEffect(() => {
    const { pickupCity, pickupLocation, destinationCity, destinationLocation, stops, isRoundTrip, returnTrip } = form;
    // Only the city is required to attempt a distance estimate — the exact
    // address refines the geocoded point but isn't needed to get a rough
    // city-to-city figure, and making a carrier type it first just delays
    // the preview for no benefit.
    if (!pickupCity || !destinationCity) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDistanceKm(null);
      setOutboundKm(null);
      setReturnKm(null);
      return;
    }
    if (stops.some((s) => !s.city)) return;
    if (isRoundTrip && returnTrip.returnStops.some((s) => !s.city)) return;

    // Geocoding is rate-limited (~1 req/sec) and sequential per waypoint, so
    // a route's round-trip can easily exceed this debounce — an older
    // request can still be in flight when a newer edit fires another one.
    // Without this guard, whichever response happens to land LAST wins,
    // which isn't necessarily the latest input (e.g. a slower request for
    // an earlier, partially-typed city overwriting a faster one for the
    // final, correct city), showing a stale/wrong number that doesn't match
    // what's currently on screen.
    let cancelled = false;
    const timer = setTimeout(async () => {
      setCalculatingDistance(true);
      setDistanceError(false);
      const res = await fetch("/api/carrier/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupCity,
          pickupLocation,
          destinationCity,
          destinationLocation,
          stops,
          isRoundTrip,
          ...returnTripPayload(isRoundTrip, returnTrip),
        }),
      }).catch(() => null);
      if (cancelled) return;
      setCalculatingDistance(false);
      if (!res?.ok) {
        setDistanceError(true);
        return;
      }
      const body = await res.json().catch(() => null);
      if (cancelled) return;
      if (typeof body?.distanceKm === "number") {
        setDistanceKm(body.distanceKm);
        setOutboundKm(typeof body.outboundKm === "number" ? body.outboundKm : null);
        setReturnKm(typeof body.returnKm === "number" ? body.returnKm : null);
      } else {
        setDistanceError(true);
      }
    }, DISTANCE_CALC_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.pickupCity,
    form.pickupLocation,
    form.destinationCity,
    form.destinationLocation,
    form.stops,
    form.isRoundTrip,
    form.returnTrip,
  ]);

  useEffect(() => {
    // Always fetch — with no date picked yet this just returns the whole
    // fleet/roster unfiltered (see the API route), so the fields are
    // populated and visible as soon as the modal opens, then narrow down
    // to who's actually free once a date (and, for a round trip, a return
    // date) is picked.
    let cancelled = false;
    // No data-fetching library here to restructure this around — same
    // accepted pattern as RidesCalendar's load().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingAvailability(true);
    const params = new URLSearchParams();
    if (form.departureAt) {
      params.set("departureAt", new Date(form.departureAt).toISOString());
      if (form.isRoundTrip && form.returnAt) {
        params.set("returnAt", new Date(form.returnAt).toISOString());
      }
    }
    // Editing: exclude this ride's own current booking from the conflict
    // check, so its already-assigned vehicle/driver don't show up busy
    // against themselves (same param the "Change" picker in
    // RideDetailDrawer uses).
    if (editValues?.rideId) params.set("excludeRideId", editValues.rideId);
    fetch(`/api/carrier/availability/resources?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setAvailableVehicles(data.vehicles);
        setAvailableDrivers(data.drivers);
        // Drop a previously picked resource if it's no longer free for the
        // (now different) date/time.
        setForm((prev) => ({
          ...prev,
          vehicleId: data.vehicles.some((v: CalendarVehicle) => v.id === prev.vehicleId) ? prev.vehicleId : "",
          driverId: data.drivers.some((d: CalendarDriver) => d.id === prev.driverId) ? prev.driverId : "",
        }));
      })
      .finally(() => {
        if (!cancelled) setLoadingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.departureAt, form.isRoundTrip, form.returnAt, editValues?.rideId]);

  useEffect(() => {
    if (!onDepartureDateChange || !form.departureAt) return;
    const timer = setTimeout(() => {
      const date = new Date(form.departureAt);
      if (!Number.isNaN(date.getTime())) onDepartureDateChange(date);
    }, DEPARTURE_JUMP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [form.departureAt, onDepartureDateChange]);

  function addStop() {
    if (form.stops.length >= 5) return;
    setForm({ ...form, stops: [...form.stops, { city: "", location: "" }] });
  }
  function removeStop(index: number) {
    setForm({ ...form, stops: form.stops.filter((_, i) => i !== index) });
  }
  function updateStop(index: number, patch: Partial<CityLocation>) {
    setForm({ ...form, stops: form.stops.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  }

  const { date: departureDate, time: departureTime } = splitDateTimeLocal(form.departureAt);

  function setDepartureDate(date: string) {
    const wasEmpty = !departureDate;
    setForm({ ...form, departureAt: combineDateTimeLocal(date, departureTime) });
    // "When the user sets the Odlazak date, focus moves to the return
    // date" (§5.2) — only the first time it's set, not on every edit.
    if (wasEmpty && form.isRoundTrip) returnDateRef.current?.open();
  }

  const returnAfterOutboundError =
    form.isRoundTrip && form.departureAt && form.returnAt && new Date(form.returnAt) <= new Date(form.departureAt)
      ? tn("returnBeforeDeparture")
      : undefined;

  const outboundResolved = {
    pickupCity: form.pickupCity,
    pickupLocation: form.pickupLocation,
    destinationCity: form.destinationCity,
    destinationLocation: form.destinationLocation,
    stops: form.stops,
  };
  const resolvedReturn = form.isRoundTrip ? resolveReturnLeg(outboundResolved, form.returnTrip) : null;

  const routeCities = [
    form.pickupCity,
    ...form.stops.map((s) => s.city),
    form.destinationCity,
    ...(resolvedReturn ? [...resolvedReturn.stops.map((s) => s.city), resolvedReturn.destinationCity] : []),
  ].filter(Boolean);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitAttempted(true);

    const invalid =
      !form.clientName ||
      !isValidEmail(form.clientEmail) ||
      !isValidPhoneNumber(form.clientPhoneNumber) ||
      !form.pickupCity ||
      !form.pickupLocation ||
      !form.destinationCity ||
      !form.destinationLocation ||
      !form.departureAt ||
      (form.isRoundTrip && (!form.returnAt || Boolean(returnAfterOutboundError))) ||
      !form.passengerCount;
    if (invalid) {
      // Scroll/highlight only takes effect once React has rendered the
      // field-error text this same setSubmitAttempted(true) just turned
      // on — a single rAF lands before paint but not necessarily after
      // React's commit, so two are used to reliably wait for both.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const firstError = bodyRef.current?.querySelector<HTMLElement>(".field-error");
          firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });
      return;
    }

    setLoading(true);
    setError(null);

    const { clientPhoneCc, clientPhoneNumber, ...formRest } = form;
    const basePayload = {
      ...formRest,
      clientId: selectedClientId ?? undefined,
      clientCompanyName: form.clientCompanyName || undefined,
      clientPhone: clientPhoneNumber ? `+${clientPhoneCc}${clientPhoneNumber}` : undefined,
      // Converted to a real UTC instant here (in the browser, where the
      // actual local time zone is known) rather than sent as the bare
      // "YYYY-MM-DDTHH:mm" the date/time pickers produce — see
      // localDateTimeToISOString.
      departureAt: localDateTimeToISOString(form.departureAt),
      returnAt: form.isRoundTrip ? localDateTimeToISOString(form.returnAt) : undefined,
      ...returnTripPayload(form.isRoundTrip, form.returnTrip),
      distanceKm: distanceKm ?? undefined,
    };
    // Editing always resubmits the form's whole current state, so
    // vehicleId/driverId/price are sent as null (not omitted) when cleared —
    // see editRide.schema's comment on why that distinction matters there.
    const payload = editValues
      ? { ...basePayload, vehicleId: form.vehicleId || null, driverId: form.driverId || null, price: finalPrice }
      : {
          ...basePayload,
          vehicleId: form.vehicleId || undefined,
          driverId: form.driverId || undefined,
          price: finalPrice ?? undefined,
        };
    const { response: res, declinedAvailability } = await fetchWithAvailabilityConfirm(
      editValues ? `/api/carrier/rides/${editValues.rideId}` : "/api/carrier/rides/quick",
      editValues ? "PATCH" : "POST",
      payload,
      (start, end) => t("carrier.calendar.availabilityWarning", { start, end }),
      confirmAvailability,
      (form.vehicleId !== "" && form.vehicleId === confirmedVehicleId) ||
        (form.driverId !== "" && form.driverId === confirmedDriverId),
    );

    setLoading(false);

    if (!res.ok) {
      // Declining the warning isn't a real failure — no error, just stay
      // on the form so the dispatcher can adjust and retry.
      if (!declinedAvailability) {
        const body = await res.json().catch(() => null);
        if (body?.error === "EMAIL_BELONGS_TO_OTHER_ROLE") {
          setError(tn("emailBelongsToOtherRole"));
        } else if (body?.error === "CARRIER_NOT_APPROVED") {
          setError(tn("carrierNotApproved"));
        } else {
          setError(t("common.saveFailed"));
        }
      }
      return;
    }

    onCreated();
  }

  // Confirms "already booked" the moment a busy vehicle/driver is picked
  // (not only when the ride is actually created) — only commits the
  // selection if the dispatcher confirms, same ConfirmDialog instance the
  // submit path's fetchWithAvailabilityConfirm uses.
  async function pickVehicle(id: string) {
    const picked = availableVehicles.find((v) => v.id === id);
    if (picked?.busy) {
      const start = picked.busyStart ? new Date(picked.busyStart).toLocaleDateString() : "";
      const end = picked.busyEnd ? new Date(picked.busyEnd).toLocaleDateString() : "";
      const ok = await confirmAvailability(t("carrier.calendar.availabilityWarning", { start, end }));
      if (!ok) return;
      setConfirmedVehicleId(id);
    }
    setForm((prev) => ({ ...prev, vehicleId: id }));
  }

  async function pickDriver(id: string) {
    const picked = availableDrivers.find((d) => d.id === id);
    if (picked?.busy) {
      const start = picked.busyStart ? new Date(picked.busyStart).toLocaleDateString() : "";
      const end = picked.busyEnd ? new Date(picked.busyEnd).toLocaleDateString() : "";
      const ok = await confirmAvailability(t("carrier.calendar.availabilityWarning", { start, end }));
      if (!ok) return;
      setConfirmedDriverId(id);
    }
    setForm((prev) => ({ ...prev, driverId: id }));
  }

  // Ride.price is always stored as the final, VAT-inclusive total (same
  // meaning as elsewhere in the app — see CarrierRideForm's finalPrice) —
  // so a price typed excl. VAT gets the 10% applied before submit, and one
  // typed incl. VAT (the toggle) goes through as-is.
  const priceTyped = Number(form.price);
  const priceEntered = form.price !== "" && priceTyped > 0;
  const finalPrice = priceEntered ? (priceIncludesVat ? priceTyped : Math.round(priceTyped * 1.1 * 100) / 100) : null;

  const busyCount = availableVehicles.filter((v) => v.busy).length + availableDrivers.filter((d) => d.busy).length;
  const distanceVisible = Boolean(form.pickupCity && form.destinationCity);
  const breakdownText =
    form.isRoundTrip && outboundKm !== null && returnKm !== null
      ? tn("distanceBreakdown", { out: Math.round(outboundKm), ret: Math.round(returnKm) })
      : tn("distanceTotal");
  const legKm = (km: number | null) => (calculatingDistance || distanceError || km === null ? "—" : `${Math.round(km)} km`);
  const panelTitle = editValues ? tn("editTitle") : tn("title");

  return (
    <>
    <SidePanel onClose={onClose} label={panelTitle}>
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#F0F0F2] py-0 pl-6 pr-5">
        <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-[#18181B]">{panelTitle}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#71717A] transition-colors duration-[.12s] ease-out hover:bg-[#F4F4F5]"
        >
          <X size={17} strokeWidth={1.9} />
        </button>
      </div>

      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
          <section className="px-6 py-5">
            <h3 className="mb-4 text-[13.5px] font-semibold text-[#18181B]">{tn("klijent")}</h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
              <div>
                <label htmlFor={`${uid}-firma`} className={SHEET_LABEL_CLASS}>{tn("firma")}</label>
                <div className="mt-[6px]">
                  <ClientCombobox
                    id={`${uid}-firma`}
                    variant="sheet"
                    placeholder={tn("firmaPlaceholder")}
                    value={form.clientCompanyName}
                    onChange={(v) => {
                      setForm({ ...form, clientCompanyName: v });
                      setSelectedClientId(null);
                    }}
                    onSelectClient={(client: ClientMatch) => {
                      const phone = client.phone ? splitPhone(client.phone) : null;
                      setForm({
                        ...form,
                        clientCompanyName: client.companyName ?? form.clientCompanyName,
                        clientName: client.name ?? form.clientName,
                        clientEmail: client.email,
                        clientPhoneCc: phone?.cc ?? form.clientPhoneCc,
                        clientPhoneNumber: phone?.number ?? form.clientPhoneNumber,
                      });
                      setSelectedClientId(client.id);
                    }}
                  />
                </div>
              </div>
              <div>
                <label htmlFor={`${uid}-kontakt`} className={SHEET_LABEL_CLASS}>{tn("kontaktOsoba")}</label>
                <input
                  id={`${uid}-kontakt`}
                  className={`mt-[6px] ${SHEET_INPUT_CLASS}`}
                  placeholder={tn("kontaktOsobaPlaceholder")}
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                />
                {submitAttempted && !form.clientName ? (
                  <p className="field-error mt-[4px] text-[12.5px] text-[var(--ink-destructive)]">{tn("required")}</p>
                ) : null}
              </div>
              <div>
                <label htmlFor={`${uid}-telefon`} className={SHEET_LABEL_CLASS}>{tn("telefon")}</label>
                <div className="mt-[6px] flex h-10 items-stretch rounded-[8px] border border-[var(--border-control)] focus-within:border-[var(--action-bg)] focus-within:shadow-[0_0_0_3px_var(--action-100)]">
                  <div className="flex shrink-0 items-center gap-[2px] rounded-l-[7px] bg-[var(--bg-subtle)] pl-3 pr-2">
                    <span className="text-[14px] text-[var(--ink-secondary)]">+</span>
                    <input
                      aria-label={tn("phoneCountryCode")}
                      className="w-[30px] bg-transparent text-[14px] text-[var(--ink-secondary)] focus:outline-none"
                      value={form.clientPhoneCc}
                      onChange={(e) => setForm({ ...form, clientPhoneCc: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                    />
                  </div>
                  {/* A divider inset from the top/bottom edges, rather than
                      a full-height border on the segment above — a border
                      spanning the whole 40px height touches the outer
                      focus ring's own border/shadow right at the corners,
                      visibly notching it. */}
                  <span className="my-2 w-px shrink-0 bg-[var(--border-soft)]" />
                  <input
                    id={`${uid}-telefon`}
                    className="min-w-0 flex-1 px-3 text-[14px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
                    value={form.clientPhoneNumber}
                    onChange={(e) => setForm({ ...form, clientPhoneNumber: e.target.value.replace(/[^\d\s]/g, "") })}
                    onBlur={() => setPhoneTouched(true)}
                  />
                </div>
                {(phoneTouched || submitAttempted) && form.clientPhoneNumber && !isValidPhoneNumber(form.clientPhoneNumber) ? (
                  <p className="field-error mt-[4px] text-[12.5px] text-[var(--ink-destructive)]">{tn("invalidPhone")}</p>
                ) : null}
              </div>
              <div>
                <label htmlFor={`${uid}-email`} className={SHEET_LABEL_CLASS}>{t("common.email")}</label>
                <input
                  id={`${uid}-email`}
                  type="email"
                  className={`mt-[6px] truncate ${SHEET_INPUT_CLASS}`}
                  value={form.clientEmail}
                  onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                />
                {submitAttempted && !form.clientEmail ? (
                  <p className="field-error mt-[4px] text-[12.5px] text-[var(--ink-destructive)]">{tn("required")}</p>
                ) : submitAttempted && !isValidEmail(form.clientEmail) ? (
                  <p className="field-error mt-[4px] text-[12.5px] text-[var(--ink-destructive)]">{t("auth.invalidEmail")}</p>
                ) : null}
              </div>
            </div>
          </section>

          <div className="mx-6 h-px bg-[#F0F0F2]" />

          <section className="px-6 py-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-[13.5px] font-semibold text-[#18181B]">{tn("ruta")}</h3>
              <SegmentedControl
                options={[
                  { value: "round" as const, label: tn("povratna") },
                  { value: "oneway" as const, label: tn("jednosmerna") },
                ]}
                value={form.isRoundTrip ? "round" : "oneway"}
                onChange={(v) => setForm({ ...form, isRoundTrip: v === "round" })}
              />
            </div>

            <div className="flex flex-col gap-4">
              <LegCard direction="outbound" title={tn("odlazak")} km={legKm(outboundKm ?? distanceKm)}>
                <RouteTimeline
                  originCity={form.pickupCity}
                  originLocation={form.pickupLocation}
                  onOriginCityChange={(v) => setForm({ ...form, pickupCity: v })}
                  onOriginLocationChange={(v) => setForm({ ...form, pickupLocation: v })}
                  destinationCity={form.destinationCity}
                  destinationLocation={form.destinationLocation}
                  onDestinationCityChange={(v) => setForm({ ...form, destinationCity: v })}
                  onDestinationLocationChange={(v) => setForm({ ...form, destinationLocation: v })}
                  stops={form.stops}
                  onAddStop={addStop}
                  onRemoveStop={removeStop}
                  onUpdateStop={updateStop}
                  originPlaceholder={tn("odaklePolazi")}
                  destinationPlaceholder={tn("kudaIde")}
                  stopPlaceholder={tn("stanica")}
                  locationPlaceholder={tn("locationPlaceholder")}
                  addStopLabel={tn("addStop")}
                  removeStopLabel={tn("removeStop")}
                  originError={submitAttempted && (!form.pickupCity || !form.pickupLocation)}
                  destinationError={submitAttempted && (!form.destinationCity || !form.destinationLocation)}
                  requiredLabel={tn("required")}
                />
                <DateTimeRow
                  dateValue={departureDate}
                  onDateChange={setDepartureDate}
                  timeValue={departureTime}
                  onTimeChange={(time) => setForm({ ...form, departureAt: combineDateTimeLocal(departureDate, time) })}
                  datePlaceholder={tn("datumPolaska")}
                  timePlaceholder={tn("vreme")}
                  dateError={submitAttempted && !form.departureAt}
                />
                {submitAttempted && !form.departureAt ? (
                  <p className="field-error pl-[28px] text-[12.5px] text-[var(--ink-destructive)]">{tn("required")}</p>
                ) : null}
              </LegCard>

              {form.isRoundTrip ? (
                <ReturnLegCard
                  value={form.returnTrip}
                  onChange={(returnTrip) => setForm({ ...form, returnTrip })}
                  outboundPickupCity={form.pickupCity}
                  outboundPickupLocation={form.pickupLocation}
                  outboundDestinationCity={form.destinationCity}
                  outboundDestinationLocation={form.destinationLocation}
                  outboundStops={form.stops}
                  departureAt={form.departureAt}
                  returnAt={form.returnAt}
                  onReturnAtChange={(v) => setForm({ ...form, returnAt: v })}
                  dateRef={returnDateRef}
                  kmText={legKm(returnKm)}
                  originPlaceholder={tn("odaklePolazi")}
                  destinationPlaceholder={tn("kudaIde")}
                  stopPlaceholder={tn("stanica")}
                  locationPlaceholder={tn("locationPlaceholder")}
                  datePlaceholder={tn("datumPovratka")}
                  timePlaceholder={tn("vreme")}
                  returnDateError={
                    returnAfterOutboundError ?? (submitAttempted && !form.returnAt ? tn("required") : undefined)
                  }
                />
              ) : null}

              <DistanceCard
                visible={distanceVisible}
                calculating={calculatingDistance}
                failed={distanceError}
                totalKm={distanceKm}
                breakdownText={breakdownText}
                estimateLabel={tn("estimateLabel")}
                failedLabel={tn("distanceUnavailable")}
                calculatingLabel={tn("calculating")}
              />

              {distanceVisible ? (
                <Card className="!p-4">
                  <label htmlFor={`${uid}-cena`} className="mb-[10px] block text-[13.5px] font-semibold text-[#18181B]">
                    {tn("cena")}
                  </label>
                  <div className="relative">
                    <input
                      id={`${uid}-cena`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      className="h-12 w-full rounded-[8px] px-3 text-[20px] font-semibold text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] shadow-[inset_0_0_0_1px_var(--border-control)] transition-shadow duration-[.12s] ease-out focus:outline-none focus:shadow-[inset_0_0_0_1px_var(--action-bg),0_0_0_3px_var(--action-100)]"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-muted)]">
                      RSD
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-4">
                    <p
                      className={`text-[14px] font-medium ${
                        priceIncludesVat ? "text-[var(--ink-primary)]" : "text-[var(--ink-muted)]"
                      }`}
                    >
                      {tn("cenaUkljucujePdv")}
                    </p>
                    <Switch
                      checked={priceIncludesVat}
                      onChange={setPriceIncludesVat}
                      aria-label={tn("cenaUkljucujePdv")}
                    />
                  </div>
                </Card>
              ) : null}
            </div>
          </section>

          <div className="mx-6 h-px bg-[#F0F0F2]" />

          <section className="px-6 py-5">
            <h3 className="mb-4 text-[13.5px] font-semibold text-[#18181B]">{tn("detalji")}</h3>
            <div className="flex flex-col gap-4">
              <div>
                <span className={SHEET_LABEL_CLASS}>{tn("brojPutnika")}</span>
                <div className="mt-[6px]">
                  <Stepper
                    value={Number(form.passengerCount) || 1}
                    onChange={(n) => setForm({ ...form, passengerCount: String(n) })}
                    min={1}
                    max={MAX_PASSENGERS}
                    aria-label={tn("brojPutnika")}
                  />
                </div>
              </div>
              <div>
                <div className="mb-[6px] flex items-baseline gap-2">
                  <label htmlFor={`${uid}-zahtevi`} className={SHEET_LABEL_CLASS}>{tn("posebniZahtevi")}</label>
                  <span className="text-[12.5px] text-[var(--ink-muted)]">{tn("opciono")}</span>
                </div>
                <textarea
                  id={`${uid}-zahtevi`}
                  className={SHEET_TEXTAREA_CLASS}
                  placeholder={tn("posebniZahteviPlaceholder")}
                  value={form.specialRequests}
                  onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
                />
              </div>
            </div>
          </section>

          <div className="mx-6 h-px bg-[#F0F0F2]" />

          <section className="px-6 py-5">
            <div className="mb-4 flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h3 className="text-[13.5px] font-semibold text-[#18181B]">{tn("dodela")}</h3>
                <span className="text-[12.5px] text-[#A1A1AA]">{tn("opciono")}</span>
              </div>
              <span
                className={`shrink-0 text-right text-[12.5px] ${
                  form.departureAt && (!form.isRoundTrip || form.returnAt)
                    ? busyCount > 0
                      ? "text-[#9A5B0F]"
                      : "text-[#16A34A]"
                    : "text-[#A1A1AA]"
                }`}
              >
                {form.departureAt && (!form.isRoundTrip || form.returnAt)
                  ? busyCount > 0
                    ? tn("busyCount", { count: busyCount })
                    : tn("allFreeAtThatTime")
                  : tn("pickDatesForFreeCount")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <AssignmentSelect
                variant="sheet"
                value={form.vehicleId}
                onChange={pickVehicle}
                disabled={loadingAvailability}
                placeholder={tn("assignLater")}
                busyLabel={t("carrier.calendar.alreadyBooked")}
                options={availableVehicles.map((v) => ({
                  id: v.id,
                  label: `${tType(v.type)} ${v.model} · ${v.seats} ${tn("mesta")}`,
                  busy: v.busy,
                  warn: v.seats < (Number(form.passengerCount) || 0),
                }))}
              />
              <AssignmentSelect
                variant="sheet"
                value={form.driverId}
                onChange={pickDriver}
                disabled={loadingAvailability}
                placeholder={tn("assignLater")}
                busyLabel={t("carrier.calendar.alreadyBooked")}
                options={availableDrivers.map((d) => ({ id: d.id, label: d.name, busy: d.busy }))}
              />
            </div>
          </section>

          {error ? <p className="px-6 pb-4 text-[13.5px] text-[var(--ink-destructive)]">{error}</p> : null}
        </div>

        <div className="flex h-[72px] shrink-0 items-center gap-3 bg-white py-0 pl-6 pr-5 shadow-[0_-1px_0_#F0F0F2,0_-8px_16px_-8px_rgba(24,24,27,.06)]">
          <div className="min-w-0 flex-1">
            {routeCities.length > 0 ? (
              <>
                <p className="text-[14px] font-semibold tabular-nums text-[#18181B]">
                  {distanceKm !== null ? `${Math.round(distanceKm)} km` : "—"}
                </p>
                <p className="truncate text-[12.5px] text-[#71717A]">
                  {routeCities.length > 1 ? routeCities.join(" → ") : "—"}
                </p>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 shrink-0 items-center whitespace-nowrap rounded-[9px] px-3 text-[13.5px] font-medium text-[#18181B] shadow-[inset_0_0_0_1px_#E4E4E7,0_1px_2px_rgba(24,24,27,.04)] transition-colors duration-[.12s] ease-out hover:bg-[#FAFAFA]"
          >
            {tn("otkazi")}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex h-9 shrink-0 items-center whitespace-nowrap rounded-[9px] bg-[#2563EB] px-4 text-[13.5px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_1px_2px_rgba(37,99,235,.3)] transition-colors duration-[.12s] ease-out hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {loading ? t("common.loading") : editValues ? tn("saveChanges") : tn("kreirajVoznju")}
          </button>
        </div>
      </form>
    </SidePanel>
    {availabilityDialog}
    </>
  );
}
