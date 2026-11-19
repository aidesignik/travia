"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DriversTable, type DriversTableDriver } from "@/components/carrier/DriversTable";
import { FilterDropdown } from "@/components/carrier/FilterDropdown";
import { MultiSelectFilter, type MultiSelectOption } from "@/components/carrier/MultiSelectFilter";
import { usePathname, useRouter } from "@/i18n/navigation";
import { driverDocumentChips, documentFilterStatus, type DocumentFilterStatus } from "@/lib/documentChips";
import { parseStatusParam, serializeStatusParam } from "@/lib/statusFilterParam";

const UNASSIGNED = "__unassigned__";

// Driver has no explicit "status" field like a ride or a vehicle does —
// isAvailable is the closest equivalent, so Status here filters on that.
const STATUSES = ["AVAILABLE", "UNAVAILABLE"];
const STATUS_DOT: Record<string, string> = { AVAILABLE: "var(--status-completed-dot)", UNAVAILABLE: "var(--status-cancelled-dot)" };

function driverStatus(driver: DriversTableDriver): string {
  return driver.isAvailable ? "AVAILABLE" : "UNAVAILABLE";
}

export function DriversListSection({
  drivers,
  vehicles,
  initialEditingId = null,
}: {
  drivers: DriversTableDriver[];
  vehicles: { id: string; type: string; model: string }[];
  initialEditingId?: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string[]>(() =>
    parseStatusParam(searchParams.get("status"), STATUSES),
  );
  const [vehicleFilter, setVehicleFilter] = useState<string | null>(null);
  const [docFilter, setDocFilter] = useState<DocumentFilterStatus | null>(null);

  const preStatusFiltered = useMemo(
    () =>
      drivers.filter((driver) => {
        if (vehicleFilter === UNASSIGNED && driver.vehicles.length > 0) return false;
        if (vehicleFilter && vehicleFilter !== UNASSIGNED && !driver.vehicles.some((v) => v.id === vehicleFilter))
          return false;
        if (docFilter && documentFilterStatus(driverDocumentChips(driver)) !== docFilter) return false;
        return true;
      }),
    [drivers, vehicleFilter, docFilter],
  );

  const statusOptions: MultiSelectOption[] = useMemo(() => {
    const counts: Record<string, number> = { AVAILABLE: 0, UNAVAILABLE: 0 };
    for (const driver of preStatusFiltered) {
      const status = driverStatus(driver);
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return STATUSES.map((status) => ({
      value: status,
      label: t(`carrier.driverAvailability.${status}`),
      count: counts[status] ?? 0,
      dotColor: STATUS_DOT[status],
    }));
  }, [preStatusFiltered, t]);
  const vehicleOptions = [
    { value: UNASSIGNED, label: t("carrier.driversTable.noVehicle") },
    ...vehicles.map((v) => ({ value: v.id, label: `${t(`vehicleType.${v.type}`)} ${v.model}` })),
  ];
  const docOptions = [
    { value: "valid", label: t("carrier.table.docFilterValid") },
    { value: "expiringSoon", label: t("carrier.table.docFilterExpiringSoon") },
    { value: "expired", label: t("carrier.table.docFilterExpired") },
    { value: "none", label: t("carrier.table.noDocuments") },
  ];

  const filtered = useMemo(
    () => preStatusFiltered.filter((driver) => statusFilter.length === 0 || statusFilter.includes(driverStatus(driver))),
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
          label={t("carrier.driversTable.assignedVehicle")}
          options={vehicleOptions}
          value={vehicleFilter}
          onChange={setVehicleFilter}
        />
        <FilterDropdown
          size="lg"
          label={t("carrier.table.documents")}
          options={docOptions}
          value={docFilter}
          onChange={(v) => setDocFilter(v as DocumentFilterStatus | null)}
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-[14px] text-[var(--ink-secondary)]">{t("carrier.table.noFilterResults")}</p>
      ) : (
        <DriversTable drivers={filtered} vehicles={vehicles} initialEditingId={initialEditingId} />
      )}
    </>
  );
}
