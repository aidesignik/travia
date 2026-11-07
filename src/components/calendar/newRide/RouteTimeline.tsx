"use client";

import { useEffect, useRef } from "react";
import type { CityLocation } from "@/lib/location";
import { RingMarker, PinMarker, DotConnector } from "./timelineMarkers";
import { GroupedRouteField, type RouteFieldHandle } from "./GroupedRouteField";

// §5.1 "like Google Maps directions" route list — no field labels, role
// comes from the marker + placeholder + order. Used for Odlazak and,
// identically, for Povratak's "custom" mode. Pure presentation over the
// same stop add/remove/update handlers every ride form already uses.
export function RouteTimeline({
  originCity,
  originLocation,
  onOriginChange,
  destinationCity,
  destinationLocation,
  onDestinationChange,
  stops,
  onAddStop,
  onRemoveStop,
  onUpdateStop,
  originPlaceholder,
  destinationPlaceholder,
  stopPlaceholder,
  addStopLabel,
  removeStopLabel,
  maxStops = 5,
  originError,
  destinationError,
  requiredLabel,
}: {
  originCity: string;
  originLocation: string;
  // City and exact location always change together (one pick in the
  // single route field sets both), so one handler per endpoint.
  onOriginChange: (v: CityLocation) => void;
  destinationCity: string;
  destinationLocation: string;
  onDestinationChange: (v: CityLocation) => void;
  stops: CityLocation[];
  onAddStop: () => void;
  onRemoveStop: (index: number) => void;
  onUpdateStop: (index: number, patch: Partial<CityLocation>) => void;
  originPlaceholder: string;
  destinationPlaceholder: string;
  stopPlaceholder: string;
  addStopLabel: string;
  removeStopLabel: string;
  maxStops?: number;
  // Shown (red border + a "Required" line below) only after a failed
  // submit — see NewRideModal's onSubmit. Stops are never required, so
  // only origin/destination get this.
  originError?: boolean;
  destinationError?: boolean;
  requiredLabel?: string;
}) {
  const stopRefs = useRef<Array<RouteFieldHandle | null>>([]);
  const prevStopCount = useRef(stops.length);

  // "Dodaj stanicu" focuses the new stop's field (§5.1).
  useEffect(() => {
    if (stops.length > prevStopCount.current) {
      stopRefs.current[stops.length - 1]?.focus();
    }
    prevStopCount.current = stops.length;
  }, [stops.length]);

  return (
    <div>
      <div className="flex flex-col gap-[2px]">
        <div className="flex items-center gap-3">
          <div className="flex w-4 shrink-0 items-center justify-center">
            <RingMarker />
          </div>
          <GroupedRouteField
            value={{ city: originCity, location: originLocation }}
            onChange={onOriginChange}
            placeholder={originPlaceholder}
            requireLocation
            error={originError}
          />
        </div>
        {originError ? (
          <p className="field-error pl-[28px] text-[12.5px] text-[var(--ink-destructive)]">{requiredLabel}</p>
        ) : null}

        {stops.map((stop, index) => (
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
                ref={(el) => {
                  stopRefs.current[index] = el;
                }}
                value={stop}
                onChange={(v) => onUpdateStop(index, v)}
                placeholder={stopPlaceholder}
                removable
                onRemove={() => onRemoveStop(index)}
                removeLabel={removeStopLabel}
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
          <div className="flex w-4 shrink-0 items-center justify-center">
            <PinMarker />
          </div>
          <GroupedRouteField
            value={{ city: destinationCity, location: destinationLocation }}
            onChange={onDestinationChange}
            placeholder={destinationPlaceholder}
            requireLocation
            error={destinationError}
          />
        </div>
        {destinationError ? (
          <p className="field-error pl-[28px] text-[12.5px] text-[var(--ink-destructive)]">{requiredLabel}</p>
        ) : null}
      </div>

      {stops.length < maxStops ? (
        <button
          type="button"
          onClick={onAddStop}
          className="ml-[28px] mt-[10px] flex h-7 items-center gap-[6px] rounded-[7px] px-2 text-[13px] font-medium text-[#2563EB] transition-colors duration-[.12s] ease-out hover:bg-[#EFF6FF]"
        >
          + {addStopLabel}
        </button>
      ) : null}
    </div>
  );
}
