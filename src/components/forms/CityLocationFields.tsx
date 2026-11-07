"use client";

import { useId } from "react";
import { CityCombobox } from "@/components/forms/CityCombobox";
import { PlaceLocationInput } from "@/components/forms/PlaceLocationInput";

const LABEL_CLASS = "text-[13px] font-semibold text-[var(--ink-2)]";

// On narrow viewports the pair stacks as city-label/city-input then
// location-label/location-input (natural DOM order). At sm: and up, both
// labels move to their own row above both inputs — via responsive `order`,
// not by pairing label+input per column — so a long "Exact pickup location
// (hotel, stop, address)" label wrapping to two lines doesn't push its
// input lower than the "Pickup city" input next to it.
export function CityLocationFields({
  cityLabel,
  locationLabel,
  city,
  location,
  onCityChange,
  onLocationChange,
}: {
  cityLabel: string;
  locationLabel: string;
  city: string;
  location: string;
  onCityChange: (value: string) => void;
  onLocationChange: (value: string) => void;
}) {
  const uid = useId();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-[5px]">
      <label htmlFor={`${uid}-city`} className={`order-1 ${LABEL_CLASS}`}>
        {cityLabel}
      </label>
      <CityCombobox id={`${uid}-city`} className="order-2 sm:order-3" required value={city} onChange={onCityChange} />
      <label htmlFor={`${uid}-location`} className={`order-3 sm:order-2 ${LABEL_CLASS}`}>
        {locationLabel}
      </label>
      <PlaceLocationInput
        id={`${uid}-location`}
        className="order-4"
        required
        value={location}
        onChange={onLocationChange}
        city={city}
      />
    </div>
  );
}
