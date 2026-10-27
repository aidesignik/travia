"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { useTranslations } from "next-intl";
import { Plus, Pencil, RotateCcw } from "lucide-react";
import type { CityComboboxHandle } from "@/components/forms/CityCombobox";
import type { DatePickerHandle } from "@/components/ui/DatePicker";
import type { ReturnTripValues } from "@/components/forms/ReturnTripFields";
import { resolveReturnLeg } from "@/lib/rideReturnLeg";
import type { CityLocation } from "@/lib/location";
import { LegCard, DateTimeRow } from "./RouteLegCard";
import { RouteTimeline } from "./RouteTimeline";
import { GroupedRouteField } from "./GroupedRouteField";
import { RingMarker, PinMarker, DotConnector } from "./timelineMarkers";
import { SHEET_TEXT_BUTTON_CLASS } from "./sheetFieldClasses";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type ReturnMode = "mirror" | "stops" | "custom";

function deriveMode(value: ReturnTripValues): ReturnMode {
  if (value.differentReturnRoute) return "custom";
  if (value.returnStops.length > 0) return "stops";
  return "mirror";
}

export function ReturnLegCard({
  value,
  onChange,
  outboundPickupCity,
  outboundPickupLocation,
  outboundDestinationCity,
  outboundDestinationLocation,
  outboundStops,
  departureAt,
  returnAt,
  onReturnAtChange,
  dateRef,
  kmText,
  stopPlaceholder,
  locationPlaceholder,
  originPlaceholder,
  destinationPlaceholder,
  datePlaceholder,
  timePlaceholder,
  returnDateError,
}: {
  value: ReturnTripValues;
  onChange: (value: ReturnTripValues) => void;
  outboundPickupCity: string;
  outboundPickupLocation: string;
  outboundDestinationCity: string;
  outboundDestinationLocation: string;
  outboundStops: CityLocation[];
  departureAt: string;
  returnAt: string;
  onReturnAtChange: (value: string) => void;
  dateRef?: Ref<DatePickerHandle>;
  kmText: string;
  stopPlaceholder: string;
  locationPlaceholder: string;
  originPlaceholder: string;
  destinationPlaceholder: string;
  datePlaceholder: string;
  timePlaceholder: string;
  returnDateError?: string;
}) {
  const t = useTranslations("carrier.newRide");
  const tc = useTranslations("common");
  const [mode, setMode] = useState<ReturnMode>(() => deriveMode(value));
  const [confirmingBackToMirror, setConfirmingBackToMirror] = useState(false);
  const stopRefs = useRef<Array<CityComboboxHandle | null>>([]);
  const prevStopCount = useRef(value.returnStops.length);

  useEffect(() => {
    if (mode === "stops" && value.returnStops.length > prevStopCount.current) {
      stopRefs.current[value.returnStops.length - 1]?.focus();
    }
    prevStopCount.current = value.returnStops.length;
  }, [mode, value.returnStops.length]);

  const outbound = {
    pickupCity: outboundPickupCity,
    pickupLocation: outboundPickupLocation,
    destinationCity: outboundDestinationCity,
    destinationLocation: outboundDestinationLocation,
    stops: outboundStops,
  };
  const defaultSwap = resolveReturnLeg(outbound, {});

  function seedEndpoints(current: ReturnTripValues): ReturnTripValues {
    if (current.returnPickupCity || current.returnDestinationCity) return current;
    return {
      ...current,
      returnPickupCity: defaultSwap.pickupCity,
      returnPickupLocation: defaultSwap.pickupLocation,
      returnDestinationCity: defaultSwap.destinationCity,
      returnDestinationLocation: defaultSwap.destinationLocation,
    };
  }

  function goToStopsMode() {
    setMode("stops");
    onChange({ ...value, returnStops: [...value.returnStops, { city: "", location: "" }] });
  }

  function goToCustomMode() {
    setMode("custom");
    onChange(seedEndpoints({ ...value, differentReturnRoute: true }));
  }

  function isUnchangedFromSeed(current: ReturnTripValues): boolean {
    return (
      current.returnStops.length === 0 &&
      (current.returnPickupCity === defaultSwap.pickupCity || !current.returnPickupCity) &&
      (current.returnPickupLocation === defaultSwap.pickupLocation || !current.returnPickupLocation) &&
      (current.returnDestinationCity === defaultSwap.destinationCity || !current.returnDestinationCity) &&
      (current.returnDestinationLocation === defaultSwap.destinationLocation || !current.returnDestinationLocation)
    );
  }

  function applyBackToMirror() {
    setConfirmingBackToMirror(false);
    setMode("mirror");
    onChange({
      differentReturnRoute: false,
      returnPickupCity: "",
      returnPickupLocation: "",
      returnStops: [],
      returnDestinationCity: "",
      returnDestinationLocation: "",
    });
  }

  function backToMirror() {
    if (!isUnchangedFromSeed(value)) {
      setConfirmingBackToMirror(true);
      return;
    }
    applyBackToMirror();
  }

  function addCustomStop() {
    if (value.returnStops.length >= 5) return;
    onChange({ ...value, returnStops: [...value.returnStops, { city: "", location: "" }] });
  }
  function removeStop(index: number) {
    const nextStops = value.returnStops.filter((_, i) => i !== index);
    onChange({ ...value, returnStops: nextStops });
    if (nextStops.length === 0 && mode === "stops") setMode("mirror");
  }
  function updateStop(index: number, patch: Partial<CityLocation>) {
    onChange({ ...value, returnStops: value.returnStops.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  }

  const departureDateOnly = departureAt ? departureAt.split("T")[0] : undefined;

  return (
    <>
    <LegCard direction="return" title={t("povratak")} km={kmText}>
      {mode === "mirror" ? (
        outboundPickupCity || outboundDestinationCity ? (
          <div className="truncate rounded-[8px] bg-[#FAFAFA] px-3 py-[10px] text-[14px]">
            <span className="font-medium text-[#18181B]">{outboundDestinationCity || "—"}</span>
            <span className="mx-[6px] text-[#A1A1AA]">→</span>
            <span className="font-medium text-[#18181B]">{outboundPickupCity || "—"}</span>
            <span className="text-[#A1A1AA]"> · {t("mirrorSuffix")}</span>
          </div>
        ) : null
      ) : mode === "stops" ? (
        <div className="flex flex-col gap-[2px]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-4 shrink-0 items-center justify-center">
              <RingMarker />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[#18181B]">{outboundDestinationCity || "—"}</p>
              <p className="truncate text-[13px] text-[#A1A1AA]">
                {outboundDestinationLocation ? `${outboundDestinationLocation} · ` : ""}
                {t("fromOutbound")}
              </p>
            </div>
          </div>

          {value.returnStops.map((stop, index) => (
            <div key={index} className="contents">
              <div className="flex items-center gap-3">
                <div className="flex w-4 shrink-0 items-center justify-center">
                  <DotConnector />
                </div>
                <div />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex w-4 shrink-0 items-center justify-center">
                  <RingMarker />
                </div>
                <GroupedRouteField
                  cityRef={(el) => {
                    stopRefs.current[index] = el;
                  }}
                  cityValue={stop.city}
                  onCityChange={(v) => updateStop(index, { city: v })}
                  cityPlaceholder={stopPlaceholder}
                  locationValue={stop.location}
                  onLocationChange={(v) => updateStop(index, { location: v })}
                  locationPlaceholder={locationPlaceholder}
                  removable
                  onRemove={() => removeStop(index)}
                  removeLabel={t("removeStop")}
                />
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <div className="flex w-4 shrink-0 items-center justify-center">
              <DotConnector />
            </div>
            <div />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-4 shrink-0 items-center justify-center">
              <PinMarker />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-[#18181B]">{outboundPickupCity || "—"}</p>
              <p className="truncate text-[13px] text-[#A1A1AA]">
                {outboundPickupLocation ? `${outboundPickupLocation} · ` : ""}
                {t("fromOutbound")}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <RouteTimeline
          originCity={value.returnPickupCity}
          originLocation={value.returnPickupLocation}
          onOriginCityChange={(v) => onChange({ ...value, returnPickupCity: v })}
          onOriginLocationChange={(v) => onChange({ ...value, returnPickupLocation: v })}
          destinationCity={value.returnDestinationCity}
          destinationLocation={value.returnDestinationLocation}
          onDestinationCityChange={(v) => onChange({ ...value, returnDestinationCity: v })}
          onDestinationLocationChange={(v) => onChange({ ...value, returnDestinationLocation: v })}
          stops={value.returnStops}
          onAddStop={addCustomStop}
          onRemoveStop={(i) => onChange({ ...value, returnStops: value.returnStops.filter((_, idx) => idx !== i) })}
          onUpdateStop={(i, patch) =>
            onChange({ ...value, returnStops: value.returnStops.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) })
          }
          originPlaceholder={originPlaceholder}
          destinationPlaceholder={destinationPlaceholder}
          stopPlaceholder={stopPlaceholder}
          locationPlaceholder={locationPlaceholder}
          addStopLabel={t("addStop")}
          removeStopLabel={t("removeStop")}
        />
      )}

      <DateTimeRow
        dateValue={returnAt ? returnAt.split("T")[0] : ""}
        onDateChange={(d) => onReturnAtChange(`${d}T${returnAt.split("T")[1] || "00:00"}`)}
        timeValue={returnAt.split("T")[1] || ""}
        onTimeChange={(time) => onReturnAtChange(`${returnAt.split("T")[0] || departureDateOnly || ""}T${time}`)}
        minDate={departureDateOnly}
        dateRef={dateRef}
        datePlaceholder={datePlaceholder}
        timePlaceholder={timePlaceholder}
        dateError={Boolean(returnDateError)}
      />
      {returnDateError ? (
        <p className="field-error pl-[28px] text-[12.5px] text-[var(--ink-destructive)]">{returnDateError}</p>
      ) : null}

      <div className="flex items-center gap-1">
        <button type="button" onClick={mode === "mirror" ? goToStopsMode : addCustomStop} className={SHEET_TEXT_BUTTON_CLASS}>
          <Plus size={14} strokeWidth={2} />
          {t("addStop")}
        </button>
        {mode !== "custom" ? (
          <button type="button" onClick={goToCustomMode} className={SHEET_TEXT_BUTTON_CLASS}>
            <Pencil size={14} strokeWidth={2} />
            {t("differentRoute")}
          </button>
        ) : (
          <button
            type="button"
            onClick={backToMirror}
            className="-ml-2 flex h-7 items-center gap-[6px] rounded-[7px] px-2 text-[13px] font-medium text-[#71717A] transition-colors duration-[.12s] ease-out hover:bg-[#F4F4F5]"
          >
            <RotateCcw size={14} strokeWidth={2} />
            {t("backToSameRoute")}
          </button>
        )}
      </div>
    </LegCard>
    {confirmingBackToMirror ? (
      <ConfirmDialog
        title={t("backToSameRoute")}
        body={t("confirmBackToSameRoute")}
        cancelLabel={tc("cancel")}
        confirmLabel={tc("continue")}
        onCancel={() => setConfirmingBackToMirror(false)}
        onConfirm={applyBackToMirror}
      />
    ) : null}
    </>
  );
}
