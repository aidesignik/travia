"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { CityLocationFields } from "@/components/forms/CityLocationFields";
import { EMPTY_RETURN_TRIP, returnTripPayload, ReturnTripFields } from "@/components/forms/ReturnTripFields";
import { fetchWithAvailabilityConfirm } from "@/lib/availabilityConfirm";
import { useAvailabilityConfirmDialog } from "@/lib/useAvailabilityConfirmDialog";
import { suggestPrice } from "@/lib/pricing";
import { localDateTimeToISOString } from "@/lib/pickerDateFormat";
import type { CityLocation } from "@/lib/location";

const DISTANCE_CALC_DEBOUNCE_MS = 900;

type Vehicle = { id: string; type: string; model: string; seats: number };
type Driver = { id: string; name: string };

export function CarrierRideForm({
  vehicles,
  drivers,
  carrierRates,
}: {
  vehicles: Vehicle[];
  drivers: Driver[];
  carrierRates: { ratePerKm: number | null; fixedFee: number | null };
}) {
  const t = useTranslations();
  const router = useRouter();
  const { confirm: confirmAvailability, dialog: availabilityDialog } = useAvailabilityConfirmDialog();
  const [form, setForm] = useState({
    clientCompanyName: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    pickupCity: "",
    pickupLocation: "",
    destinationCity: "",
    destinationLocation: "",
    stops: [] as CityLocation[],
    departureAt: "",
    isRoundTrip: false,
    returnAt: "",
    returnTrip: EMPTY_RETURN_TRIP,
    passengerCount: "40",
    specialRequests: "",
    vehicleId: vehicles[0]?.id ?? "",
    driverId: drivers[0]?.id ?? "",
    distanceKm: "",
    ratePerKm: carrierRates.ratePerKm ? String(carrierRates.ratePerKm) : "",
    fixedFee: carrierRates.fixedFee ? String(carrierRates.fixedFee) : "",
    finalPrice: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [distanceTouched, setDistanceTouched] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const distanceRequestId = useRef(0);

  const suggested = useMemo(() => {
    const km = Number(form.distanceKm);
    if (!km || km <= 0) return null;
    return suggestPrice(km, {
      ratePerKm: form.ratePerKm ? Number(form.ratePerKm) : carrierRates.ratePerKm,
      fixedFee: form.fixedFee ? Number(form.fixedFee) : carrierRates.fixedFee,
    });
  }, [form.distanceKm, form.ratePerKm, form.fixedFee, carrierRates]);

  // Auto-calculate distance from the addresses as the carrier types, the
  // same way the client-facing request flow does — debounced so we're not
  // geocoding on every keystroke, and skipped once the carrier has typed
  // their own value into the distance field directly.
  useEffect(() => {
    if (distanceTouched) return;
    const { pickupCity, pickupLocation, destinationCity, destinationLocation, stops } = form;
    // Only the city is required to attempt a distance estimate — see the
    // same comment in NewRideModal.
    if (!pickupCity || !destinationCity) return;
    if (stops.some((s) => !s.city)) return;

    const requestId = ++distanceRequestId.current;
    const timer = setTimeout(async () => {
      setCalculatingDistance(true);
      const res = await fetch("/api/carrier/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupCity, pickupLocation, destinationCity, destinationLocation, stops }),
      }).catch(() => null);

      if (requestId !== distanceRequestId.current) return; // a newer edit superseded this request
      setCalculatingDistance(false);
      if (!res?.ok) return; // soft-fail — the field just stays blank/editable

      const body = await res.json().catch(() => null);
      if (typeof body?.distanceKm === "number" && requestId === distanceRequestId.current) {
        setForm((prev) => ({ ...prev, distanceKm: String(body.distanceKm) }));
      }
    }, DISTANCE_CALC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.pickupCity,
    form.pickupLocation,
    form.destinationCity,
    form.destinationLocation,
    form.stops,
    distanceTouched,
  ]);

  function addStop() {
    if (form.stops.length >= 5) return;
    setForm({ ...form, stops: [...form.stops, { city: "", location: "" }] });
  }

  function removeStop(index: number) {
    setForm({ ...form, stops: form.stops.filter((_, i) => i !== index) });
  }

  function updateStop(index: number, patch: Partial<CityLocation>) {
    setForm({
      ...form,
      stops: form.stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)),
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { response: res, declinedAvailability } = await fetchWithAvailabilityConfirm(
      "/api/carrier/rides",
      "POST",
      {
        ...form,
        clientCompanyName: form.clientCompanyName || undefined,
        clientPhone: form.clientPhone || undefined,
        // See localDateTimeToISOString — converts the bare picker string
        // to a real UTC instant using the browser's own time zone, rather
        // than letting the server (a different time zone) reinterpret it.
        departureAt: localDateTimeToISOString(form.departureAt),
        returnAt: form.isRoundTrip ? localDateTimeToISOString(form.returnAt) : undefined,
        ...returnTripPayload(form.isRoundTrip, form.returnTrip),
        distanceKm: form.distanceKm ? Number(form.distanceKm) : undefined,
        finalPrice: Number(form.finalPrice || suggested || 0),
      },
      (start, end) => t("carrier.calendar.availabilityWarning", { start, end }),
      confirmAvailability,
    );

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (declinedAvailability) {
        // Not a real failure — no error, just stay on the form.
      } else if (body?.error === "DISTANCE_UNAVAILABLE") {
        setError(t("carrier.rideForm.distanceUnavailable"));
      } else {
        setError(t("common.saveFailed"));
      }
      return;
    }

    const { booking } = await res.json();
    router.push(`/carrier/bookings/${booking.id}`);
    router.refresh();
  }

  if (vehicles.length === 0 || drivers.length === 0) {
    return (
      <p className="text-sm text-zinc-600">
        {t("carrier.noVehicles")} / {t("carrier.noDrivers")}
      </p>
    );
  }

  return (
    <>
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">{t("carrier.rideForm.clientSection")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t("carrier.rideForm.client")}>
            <Input
              placeholder={t("carrier.rideForm.clientPlaceholder")}
              value={form.clientCompanyName}
              onChange={(e) => setForm({ ...form, clientCompanyName: e.target.value })}
            />
          </Field>
          <Field label={t("carrier.rideForm.contactPerson")}>
            <Input
              required
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
            />
          </Field>
          <Field label={t("common.email")}>
            <Input
              type="email"
              required
              value={form.clientEmail}
              onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
            />
          </Field>
          <Field label={t("common.phone")}>
            <Input
              value={form.clientPhone}
              onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">{t("carrier.rideForm.tripSection")}</h2>

        <CityLocationFields
          cityLabel={t("client.requestForm.pickupCity")}
          locationLabel={t("client.requestForm.pickupLocation")}
          city={form.pickupCity}
          location={form.pickupLocation}
          onCityChange={(v) => setForm({ ...form, pickupCity: v })}
          onLocationChange={(v) => setForm({ ...form, pickupLocation: v })}
        />

        {form.stops.map((stop, index) => (
          <div key={index} className="space-y-2 rounded-md border border-dashed border-zinc-300 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                {t("client.requestForm.stop")} {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeStop(index)}
                className="text-xs font-medium text-[var(--ink-destructive)] hover:underline"
              >
                {t("client.requestForm.removeStop")}
              </button>
            </div>
            <CityLocationFields
              cityLabel={t("client.requestForm.stopCity")}
              locationLabel={t("client.requestForm.stopAddress")}
              city={stop.city}
              location={stop.location}
              onCityChange={(v) => updateStop(index, { city: v })}
              onLocationChange={(v) => updateStop(index, { location: v })}
            />
          </div>
        ))}

        {form.stops.length < 5 ? (
          <button type="button" onClick={addStop} className="text-sm font-medium text-zinc-700 underline">
            + {t("client.requestForm.addStop")}
          </button>
        ) : null}

        <CityLocationFields
          cityLabel={t("client.requestForm.destinationCity")}
          locationLabel={t("client.requestForm.destinationLocation")}
          city={form.destinationCity}
          location={form.destinationLocation}
          onCityChange={(v) => setForm({ ...form, destinationCity: v })}
          onLocationChange={(v) => setForm({ ...form, destinationLocation: v })}
        />

        <Field label={t("client.requestForm.departureAt")}>
          <Input
            type="datetime-local"
            required
            value={form.departureAt}
            onChange={(e) => setForm({ ...form, departureAt: e.target.value })}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isRoundTrip}
            onChange={(e) => setForm({ ...form, isRoundTrip: e.target.checked })}
          />
          {t("client.requestForm.isRoundTrip")}
        </label>

        {form.isRoundTrip ? (
          <>
            <Field label={t("client.requestForm.returnAt")}>
              <Input
                type="datetime-local"
                required
                min={form.departureAt || undefined}
                value={form.returnAt}
                onChange={(e) => setForm({ ...form, returnAt: e.target.value })}
              />
            </Field>
            <ReturnTripFields
              value={form.returnTrip}
              onChange={(returnTrip) => setForm({ ...form, returnTrip })}
              outboundPickupCity={form.pickupCity}
              outboundPickupLocation={form.pickupLocation}
              outboundDestinationCity={form.destinationCity}
              outboundDestinationLocation={form.destinationLocation}
              outboundStops={form.stops}
            />
          </>
        ) : null}

        <Field label={t("client.requestForm.passengerCount")}>
          <Input
            type="number"
            min={1}
            required
            value={form.passengerCount}
            onChange={(e) => setForm({ ...form, passengerCount: e.target.value })}
          />
        </Field>

        <Field label={t("client.requestForm.specialRequests")}>
          <Input
            value={form.specialRequests}
            onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
          />
        </Field>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">{t("carrier.rideForm.assignmentSection")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("carrier.offerForm.vehicle")}>
            <select
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {t(`vehicleType.${v.type}`)} {v.model} ({v.seats} seats)
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("carrier.offerForm.driver")}>
            <select
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("carrier.ratePerKm")}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.ratePerKm}
              onChange={(e) => setForm({ ...form, ratePerKm: e.target.value })}
            />
          </Field>
          <Field label={t("carrier.fixedFee")}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.fixedFee}
              onChange={(e) => setForm({ ...form, fixedFee: e.target.value })}
            />
          </Field>
        </div>

        <Field label={t("carrier.offerForm.distanceKm")}>
          <Input
            type="number"
            min={1}
            step="0.1"
            placeholder={
              calculatingDistance
                ? t("carrier.rideForm.calculatingDistance")
                : t("carrier.rideForm.distanceKmPlaceholder")
            }
            value={form.distanceKm}
            onChange={(e) => {
              const value = e.target.value;
              setDistanceTouched(value !== "");
              setForm({ ...form, distanceKm: value });
            }}
          />
        </Field>
        {calculatingDistance ? (
          <p className="text-xs text-zinc-500">{t("carrier.rideForm.calculatingDistance")}</p>
        ) : null}

        {suggested !== null ? (
          <p className="text-sm text-zinc-600">
            {t("carrier.offerForm.suggestedPrice")}: <span className="font-medium text-zinc-900">{suggested} RSD</span>
          </p>
        ) : null}

        <Field label={t("carrier.offerForm.finalPrice")}>
          <Input
            type="number"
            min={1}
            step="0.01"
            required
            placeholder={suggested ? String(suggested) : undefined}
            value={form.finalPrice}
            onChange={(e) => setForm({ ...form, finalPrice: e.target.value })}
          />
        </Field>
      </div>

      {error ? <p className="text-sm text-[var(--ink-destructive)]">{error}</p> : null}

      <Button type="submit" disabled={loading}>
        {loading ? t("common.loading") : t("carrier.rideForm.submit")}
      </Button>
    </form>
    {availabilityDialog}
    </>
  );
}
