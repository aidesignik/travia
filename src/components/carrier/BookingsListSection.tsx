"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookingsTable } from "@/components/carrier/BookingsTable";
import { FilterDropdown } from "@/components/carrier/FilterDropdown";
import { MultiSelectFilter, type MultiSelectOption } from "@/components/carrier/MultiSelectFilter";
import { RIDE_STATUS_DOT } from "@/components/calendar/statusStyles";
import { usePathname, useRouter } from "@/i18n/navigation";
import { displayRideStatus } from "@/lib/rideStatus";
import { parseStatusParam, serializeStatusParam } from "@/lib/statusFilterParam";
import type { CalendarDriver, CalendarRide, CalendarVehicle, RideStatus } from "@/components/calendar/types";

const STATUSES: RideStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];

export function BookingsListSection({
  bookings,
  vehicles,
  drivers,
  initialSelectedId = null,
}: {
  bookings: CalendarRide[];
  vehicles: CalendarVehicle[];
  drivers: CalendarDriver[];
  initialSelectedId?: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string[]>(() =>
    parseStatusParam(searchParams.get("status"), STATUSES),
  );
  const [vehicleFilter, setVehicleFilter] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState<string | null>(null);

  const preStatusFiltered = useMemo(
    () =>
      bookings.filter((booking) => {
        if (vehicleFilter && booking.vehicleId !== vehicleFilter) return false;
        if (driverFilter && booking.driverId !== driverFilter) return false;
        return true;
      }),
    [bookings, vehicleFilter, driverFilter],
  );

  const statusOptions: MultiSelectOption[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const status of STATUSES) counts[status] = 0;
    for (const booking of preStatusFiltered) {
      const status = displayRideStatus(booking);
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return STATUSES.map((status) => ({
      value: status,
      label: t(`carrier.calendar.legend.${status}`),
      count: counts[status] ?? 0,
      dotColor: RIDE_STATUS_DOT[status],
    }));
  }, [preStatusFiltered, t]);
  const vehicleOptions = vehicles.map((v) => ({ value: v.id, label: `${t(`vehicleType.${v.type}`)} ${v.model}` }));
  const driverOptions = drivers.map((d) => ({ value: d.id, label: d.name }));

  const filtered = useMemo(
    () => preStatusFiltered.filter((booking) => statusFilter.length === 0 || statusFilter.includes(displayRideStatus(booking))),
    [preStatusFiltered, statusFilter],
  );

  function updateStatusFilter(values: string[]) {
    setStatusFilter(values);
    const params = new URLSearchParams(searchParams);
    if (values.length > 0) params.set("status", serializeStatusParam(values));
    else params.delete("status");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-2">
        <MultiSelectFilter
          label={t("common.status")}
          clearLabel={t("common.clearStatusFilter")}
          options={statusOptions}
          selected={statusFilter}
          onChange={updateStatusFilter}
        />
        <FilterDropdown
          size="lg"
          label={t("carrier.bookingsTable.vehicle")}
          options={vehicleOptions}
          value={vehicleFilter}
          onChange={setVehicleFilter}
        />
        <FilterDropdown
          size="lg"
          label={t("carrier.bookingsTable.driver")}
          options={driverOptions}
          value={driverFilter}
          onChange={setDriverFilter}
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-[14px] text-[var(--ink-secondary)]">{t("carrier.table.noFilterResults")}</p>
      ) : (
        <BookingsTable bookings={filtered} vehicles={vehicles} drivers={drivers} initialSelectedId={initialSelectedId} />
      )}
    </>
  );
}
