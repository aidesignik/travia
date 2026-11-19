"use client";

import { useTranslations } from "next-intl";
import { CityLocationFields } from "@/components/forms/CityLocationFields";
import { resolveReturnLeg } from "@/lib/rideReturnLeg";
import type { CityLocation } from "@/lib/location";

export interface ReturnTripValues {
  differentReturnRoute: boolean;
  returnPickupCity: string;
  returnPickupLocation: string;
  returnStops: CityLocation[];
  returnDestinationCity: string;
  returnDestinationLocation: string;
}

export const EMPTY_RETURN_TRIP: ReturnTripValues = {
  differentReturnRoute: false,
  returnPickupCity: "",
  returnPickupLocation: "",
  returnStops: [],
  returnDestinationCity: "",
  returnDestinationLocation: "",
};

// Shared shape for the return-leg fields in a ride submit payload.
// returnStops travels independently of differentReturnRoute — stops on the
// way back can be added whether or not the endpoints themselves differ.
// The endpoint overrides only go through when differentReturnRoute is set;
// otherwise the server defaults them to the outbound leg's endpoints
// swapped (see resolveReturnLeg()).
export function returnTripPayload(isRoundTrip: boolean, returnTrip: ReturnTripValues) {
  if (!isRoundTrip) {
    return {
      returnPickupCity: undefined,
      returnPickupLocation: undefined,
      returnStops: [] as CityLocation[],
      returnDestinationCity: undefined,
      returnDestinationLocation: undefined,
    };
  }
  return {
    returnPickupCity: returnTrip.differentReturnRoute ? returnTrip.returnPickupCity : undefined,
    returnPickupLocation: returnTrip.differentReturnRoute ? returnTrip.returnPickupLocation : undefined,
    returnStops: returnTrip.returnStops,
    returnDestinationCity: returnTrip.differentReturnRoute ? returnTrip.returnDestinationCity : undefined,
    returnDestinationLocation: returnTrip.differentReturnRoute ? returnTrip.returnDestinationLocation : undefined,
  };
}

// Shown under the round-trip checkbox in every ride form (client request,
// carrier quick-create, carrier full booking, ride edit). By default the
// return leg starts from the outbound destination and ends back at the
// outbound pickup (the endpoints swapped) with no stops assumed — stops on
// the way back can be added independently of anything else. Checking
// "Different route for the way back" additionally reveals editable
// pickup/destination fields (seeded from that swap) for when even the
// endpoints differ on the way back.
export function ReturnTripFields({
  value,
  onChange,
  outboundPickupCity,
  outboundPickupLocation,
  outboundDestinationCity,
  outboundDestinationLocation,
  outboundStops,
}: {
  value: ReturnTripValues;
  onChange: (value: ReturnTripValues) => void;
  outboundPickupCity: string;
  outboundPickupLocation: string;
  outboundDestinationCity: string;
  outboundDestinationLocation: string;
  outboundStops: CityLocation[];
}) {
  const t = useTranslations("client.requestForm");

  function toggleDifferentRoute(checked: boolean) {
    if (checked && !value.returnPickupCity && !value.returnDestinationCity) {
      // Seed just the endpoints with the outbound leg's swapped — stops are
      // independent of this toggle, so whatever the carrier already added
      // to the way back is left untouched.
      const seeded = resolveReturnLeg(
        {
          pickupCity: outboundPickupCity,
          pickupLocation: outboundPickupLocation,
          destinationCity: outboundDestinationCity,
          destinationLocation: outboundDestinationLocation,
          stops: outboundStops,
        },
        {},
      );
      onChange({
        ...value,
        differentReturnRoute: true,
        returnPickupCity: seeded.pickupCity,
        returnPickupLocation: seeded.pickupLocation,
        returnDestinationCity: seeded.destinationCity,
        returnDestinationLocation: seeded.destinationLocation,
      });
      return;
    }
    onChange({ ...value, differentReturnRoute: checked });
  }

  function addStop() {
    if (value.returnStops.length >= 5) return;
    onChange({ ...value, returnStops: [...value.returnStops, { city: "", location: "" }] });
  }
  function removeStop(index: number) {
    onChange({ ...value, returnStops: value.returnStops.filter((_, i) => i !== index) });
  }
  function updateStop(index: number, patch: Partial<CityLocation>) {
    onChange({
      ...value,
      returnStops: value.returnStops.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--ink-muted)]">{t("differentReturnRouteHint")}</p>

      <div className="space-y-2">
        <span className="text-xs font-medium text-[var(--ink-muted)]">{t("returnStopsTitle")}</span>
        {value.returnStops.map((stop, index) => (
          <div key={index} className="space-y-2 rounded-chip border border-dashed border-[var(--border-strong)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--ink-muted)]">
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
        {value.returnStops.length < 5 ? (
          <button type="button" onClick={addStop} className="text-sm font-medium text-[var(--ink-body)] underline">
            + {t("addStop")}
          </button>
        ) : null}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.differentReturnRoute}
          onChange={(e) => toggleDifferentRoute(e.target.checked)}
        />
        {t("differentReturnRoute")}
      </label>

      {value.differentReturnRoute ? (
        <div className="space-y-3 rounded-chip border border-[var(--border-control)] p-3">
          <CityLocationFields
            cityLabel={t("returnPickupCity")}
            locationLabel={t("returnPickupLocation")}
            city={value.returnPickupCity}
            location={value.returnPickupLocation}
            onCityChange={(v) => onChange({ ...value, returnPickupCity: v })}
            onLocationChange={(v) => onChange({ ...value, returnPickupLocation: v })}
          />

          <CityLocationFields
            cityLabel={t("returnDestinationCity")}
            locationLabel={t("returnDestinationLocation")}
            city={value.returnDestinationCity}
            location={value.returnDestinationLocation}
            onCityChange={(v) => onChange({ ...value, returnDestinationCity: v })}
            onLocationChange={(v) => onChange({ ...value, returnDestinationLocation: v })}
          />
        </div>
      ) : null}
    </div>
  );
}
