"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FleetTable, type FleetTableVehicle } from "@/components/carrier/FleetTable";
import { FilterDropdown } from "@/components/carrier/FilterDropdown";
import { MultiSelectFilter, type MultiSelectOption } from "@/components/carrier/MultiSelectFilter";
import { usePathname, useRouter } from "@/i18n/navigation";
import { vehicleDocumentChips, documentFilterStatus, type DocumentFilterStatus } from "@/lib/documentChips";
import { parseStatusParam, serializeStatusParam } from "@/lib/statusFilterParam";

const STATUSES = ["ACTIVE", "INACTIVE"];
// No shared color map for vehicle status (unlike ride status) — these
// match the "boolean-ish" green/gray pairing used for Vozači's
// availability filter below, kept local to each since neither is a ride
// status.
const STATUS_DOT: Record<string, string> = { ACTIVE: "var(--status-completed-dot)", INACTIVE: "var(--status-cancelled-dot)" };

export function FleetListSection({
  vehicles,
  initialEditingId = null,
}: {
  vehicles: FleetTableVehicle[];
  initialEditingId?: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string[]>(() =>
    parseStatusParam(searchParams.get("status"), STATUSES),
  );
  const [docFilter, setDocFilter] = useState<DocumentFilterStatus | null>(null);

  const preStatusFiltered = useMemo(
    () => vehicles.filter((v) => !docFilter || documentFilterStatus(vehicleDocumentChips(v)) === docFilter),
    [vehicles, docFilter],
  );

  const statusOptions: MultiSelectOption[] = useMemo(() => {
    const counts: Record<string, number> = { ACTIVE: 0, INACTIVE: 0 };
    for (const v of preStatusFiltered) counts[v.status] = (counts[v.status] ?? 0) + 1;
    return STATUSES.map((status) => ({
      value: status,
      label: t(`vehicleStatus.${status}`),
      count: counts[status] ?? 0,
      dotColor: STATUS_DOT[status],
    }));
  }, [preStatusFiltered, t]);
  const docOptions = [
    { value: "valid", label: t("carrier.table.docFilterValid") },
    { value: "expiringSoon", label: t("carrier.table.docFilterExpiringSoon") },
    { value: "expired", label: t("carrier.table.docFilterExpired") },
    { value: "none", label: t("carrier.table.noDocuments") },
  ];

  const filtered = useMemo(
    () => preStatusFiltered.filter((v) => statusFilter.length === 0 || statusFilter.includes(v.status)),
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
          label={t("carrier.table.documents")}
          options={docOptions}
          value={docFilter}
          onChange={(v) => setDocFilter(v as DocumentFilterStatus | null)}
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-[14px] text-[var(--ink-secondary)]">{t("carrier.table.noFilterResults")}</p>
      ) : (
        <FleetTable vehicles={filtered} initialEditingId={initialEditingId} />
      )}
    </>
  );
}
