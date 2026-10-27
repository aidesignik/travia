"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { CityLocationFields } from "@/components/forms/CityLocationFields";
import { localDateTimeToISOString } from "@/lib/pickerDateFormat";
import type { CityLocation } from "@/lib/location";

const DISTANCE_CALC_DEBOUNCE_MS = 900;

export interface RequestFormInitial {
  pickupCity: string;
  pickupLocation: string;
  destinationCity: string;
  destinationLocation: string;
  stops: CityLocation[];
  departureAt: string;
  isRoundTrip: boolean;
  returnAt: string;
  passengerCount: string;
}

export function RequestForm({ initial }: { initial?: RequestFormInitial }) {
  const t = useTranslations("client.requestForm");
  const tRideForm = useTranslations("carrier.rideForm");
  const router = useRouter();
  const [form, setForm] = useState({
    pickupCity: initial?.pickupCity ?? "",
    pickupLocation: initial?.pickupLocation ?? "",
    destinationCity: initial?.destinationCity ?? "",
    destinationLocation: initial?.destinationLocation ?? "",
    stops: initial?.stops ?? ([] as CityLocation[]),
    departureAt: initial?.departureAt ?? "",
    isRoundTrip: initial?.isRoundTrip ?? false,
    returnAt: initial?.returnAt ?? "",
    passengerCount: initial?.passengerCount ?? "40",
    specialRequests: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState(false);

  // Live distance preview — lets the client see roughly how far the trip
  // is before they submit the request, recalculating as pickup/stops/
  // destination (and, for a round trip, the return date) are filled in.
  // Public endpoint: no login needed to see this.
  useEffect(() => {
    const { pickupCity, pickupLocation, destinationCity, destinationLocation, stops, isRoundTrip } = form;
    // Only the city is required to attempt a distance estimate — see the
    // same comment in NewRideModal.
    if (!pickupCity || !destinationCity) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDistanceKm(null);
      return;
    }
    if (stops.some((s) => !s.city)) return;

    // See the same guard (and the reasoning) in NewRideModal — an older,
    // slower-to-resolve request can still land after a newer one and
    // overwrite its correct result with a stale/wrong number.
    let cancelled = false;
    const timer = setTimeout(async () => {
      setCalculatingDistance(true);
      setDistanceError(false);
      const res = await fetch("/api/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupCity,
          pickupLocation,
          destinationCity,
          destinationLocation,
          stops,
          isRoundTrip,
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
      if (typeof body?.distanceKm === "number") setDistanceKm(body.distanceKm);
      else setDistanceError(true);
    }, DISTANCE_CALC_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pickupCity, form.pickupLocation, form.destinationCity, form.destinationLocation, form.stops, form.isRoundTrip]);

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

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        // See localDateTimeToISOString — converts the bare picker string
        // to a real UTC instant using the browser's own time zone, rather
        // than letting the server (a different time zone) reinterpret it.
        departureAt: localDateTimeToISOString(form.departureAt),
        returnAt: form.isRoundTrip ? localDateTimeToISOString(form.returnAt) : undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError("Error");
      return;
    }

    const { request } = await res.json();
    router.push(`/requests/${request.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <CityLocationFields
        cityLabel={t("pickupCity")}
        locationLabel={t("pickupLocation")}
        city={form.pickupCity}
        location={form.pickupLocation}
        onCityChange={(v) => setForm({ ...form, pickupCity: v })}
        onLocationChange={(v) => setForm({ ...form, pickupLocation: v })}
      />

      {form.stops.map((stop, index) => (
        <div key={index} className="space-y-2 rounded-md border border-dashed border-zinc-300 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">
              {t("stop")} {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeStop(index)}
              className="text-xs font-medium text-[var(--ink-destructive)] hover:underline"
            >
              {t("removeStop")}
            </button>
          </div>
          <CityLocationFields
            cityLabel={t("stopCity")}
            locationLabel={t("stopAddress")}
            city={stop.city}
            location={stop.location}
            onCityChange={(v) => updateStop(index, { city: v })}
            onLocationChange={(v) => updateStop(index, { location: v })}
          />
        </div>
      ))}

      {form.stops.length < 5 ? (
        <button type="button" onClick={addStop} className="text-sm font-medium text-zinc-700 underline">
          + {t("addStop")}
        </button>
      ) : null}

      <CityLocationFields
        cityLabel={t("destinationCity")}
        locationLabel={t("destinationLocation")}
        city={form.destinationCity}
        location={form.destinationLocation}
        onCityChange={(v) => setForm({ ...form, destinationCity: v })}
        onLocationChange={(v) => setForm({ ...form, destinationLocation: v })}
      />

      <Field label={t("departureAt")}>
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
        {t("isRoundTrip")}
      </label>

      {form.isRoundTrip ? (
        <Field label={t("returnAt")}>
          <Input
            type="datetime-local"
            required
            min={form.departureAt || undefined}
            value={form.returnAt}
            onChange={(e) => setForm({ ...form, returnAt: e.target.value })}
          />
        </Field>
      ) : null}

      {calculatingDistance ? (
        <p className="text-xs text-zinc-500">{tRideForm("calculatingDistance")}</p>
      ) : distanceKm !== null ? (
        <p className="text-xs text-zinc-500">{tRideForm("estimatedDistance", { km: Math.round(distanceKm) })}</p>
      ) : distanceError ? (
        <p className="text-xs text-[var(--ink-destructive)]">{tRideForm("distanceUnavailableShort")}</p>
      ) : null}

      <Field label={t("passengerCount")}>
        <Input
          type="number"
          min={1}
          required
          value={form.passengerCount}
          onChange={(e) => setForm({ ...form, passengerCount: e.target.value })}
        />
      </Field>

      <Field label={t("specialRequests")}>
        <Input
          value={form.specialRequests}
          onChange={(e) => setForm({ ...form, specialRequests: e.target.value })}
        />
      </Field>

      {error ? <p className="text-sm text-[var(--ink-destructive)]">{error}</p> : null}

      <Button type="submit" disabled={loading}>
        {loading ? "…" : t("submit")}
      </Button>
    </form>
  );
}
