"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { CityLocationFields } from "@/components/forms/CityLocationFields";
import { tripStateToQueryString, type TripSearchState } from "@/lib/tripQueryParams";
import type { CityLocation } from "@/lib/location";

function formatDepartureShort(value: string): string {
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return value;
  const [year, month, day] = datePart.split("-");
  return `${day}.${month}.${year}. ${timePart}`;
}

export function PublicSearchForm({ defaults }: { defaults: TripSearchState }) {
  const t = useTranslations("client.requestForm");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [form, setForm] = useState<TripSearchState>(defaults);
  const hasSearched = Boolean(defaults.pickupCity);
  const [expanded, setExpanded] = useState(!hasSearched);

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

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    router.push(`/?${tripStateToQueryString(form)}`);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center justify-between gap-3 rounded-chip border border-[var(--border-control)] px-4 py-3 text-left hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="truncate font-medium text-[var(--ink-primary)]">
            {defaults.pickupCity} → {defaults.destinationCity}
          </span>
          <span className="text-[var(--ink-muted)]">·</span>
          <span className="text-[var(--ink-secondary)]">{formatDepartureShort(defaults.departureAt)}</span>
          <span className="text-[var(--ink-muted)]">·</span>
          <span className="text-[var(--ink-secondary)]">
            {defaults.passengerCount} {t("paxSuffix")}
          </span>
        </div>
        <span className="shrink-0 text-xs font-medium text-[var(--ink-muted)] underline">{t("editSearch")}</span>
      </button>
    );
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

      {form.stops.length < 5 ? (
        <button type="button" onClick={addStop} className="text-sm font-medium text-[var(--ink-body)] underline">
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

      <Field label={t("passengerCount")}>
        <Input
          type="number"
          min={1}
          required
          value={form.passengerCount}
          onChange={(e) => setForm({ ...form, passengerCount: e.target.value })}
        />
      </Field>

      <div className="flex gap-2">
        {hasSearched ? (
          <Button type="button" variant="ghost" onClick={() => setExpanded(false)}>
            {tCommon("cancel")}
          </Button>
        ) : null}
        <Button type="submit" className="w-full">
          {t("search")}
        </Button>
      </div>
    </form>
  );
}
