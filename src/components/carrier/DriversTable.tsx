"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { VehicleAvatar } from "@/components/ui/VehicleAvatar";
import { DocumentChipsRow } from "@/components/carrier/DocumentChipsRow";
import { RowActionsMenu } from "@/components/carrier/RowActionsMenu";
import { ClickableRow } from "@/components/carrier/ClickableRow";
import { StopClickPropagation } from "@/components/carrier/StopClickPropagation";
import { EditDriverPanel } from "@/components/forms/EditDriverPanel";
import { usePathname, useRouter } from "@/i18n/navigation";
import { driverDocumentChips } from "@/lib/documentChips";
import { formatPhone } from "@/lib/phoneDisplay";
import { DRIVERS_GRID_TEMPLATE } from "@/lib/tableLayout";

export interface DriversTableDriver {
  id: string;
  name: string;
  phone: string;
  avatarColor: string | null;
  isAvailable: boolean;
  licenseNumber: string | null;
  idCardExpiry: Date | null;
  licenseExpiry: Date | null;
  cpcExpiry: Date | null;
  medicalCertExpiry: Date | null;
  vehicles: { id: string; type: string; model: string; licensePlate: string | null; photos: string[] }[];
}

const HEADER_CLASS = "text-[12px] font-semibold text-[var(--ink-muted)]";

export function DriversTable({
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
  const [editingDriverId, setEditingDriverId] = useState<string | null>(initialEditingId);

  useEffect(() => {
    // Consume the one-time deep-link signal (e.g. from the sidebar's
    // "Needs attention" list) so the side panel opens instead of a full
    // page, then strip it from the URL.
    // Also when the link changes while this page is already open (e.g. a
    // search result for another one).
    if (!initialEditingId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingDriverId(initialEditingId);
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditingId]);

  function onSaved() {
    setEditingDriverId(null);
    router.refresh();
  }

  return (
    <div role="table" className="flex flex-col overflow-hidden rounded-panel border border-[var(--border-hairline)] bg-white">
      <div
        role="row"
        className="grid items-center gap-3 border-b border-[var(--border-hairline)] px-4 py-[10px]"
        style={{ gridTemplateColumns: DRIVERS_GRID_TEMPLATE }}
      >
        <span role="columnheader" className={HEADER_CLASS}>{t("carrier.driversTable.driver")}</span>
        <span role="columnheader" className={HEADER_CLASS}>{t("carrier.driversTable.licenseNumber")}</span>
        <span role="columnheader" className={HEADER_CLASS}>{t("carrier.driversTable.assignedVehicle")}</span>
        <span role="columnheader" className={HEADER_CLASS}>{t("carrier.table.documents")}</span>
        <span role="columnheader" className="sr-only">{t("common.actions")}</span>
      </div>
      <div role="rowgroup">
        {drivers.map((driver, i) => {
          const chips = driverDocumentChips(driver);
          const firstVehicle = driver.vehicles[0];
          const extraCount = driver.vehicles.length - 1;
          const vehicleTitle = driver.vehicles
            .map((v) => `${t(`vehicleType.${v.type}`)} ${v.model}`)
            .join(", ");
          const isLast = i === drivers.length - 1;
          return (
            <ClickableRow
              key={driver.id}
              onClick={() => setEditingDriverId(driver.id)}
              selected={editingDriverId === driver.id}
              className={`grid items-center gap-3 px-4 py-3 transition-colors duration-[.12s] ease-out hover:bg-[var(--bg-subtle)] ${
                isLast ? "" : "border-b border-[var(--border-soft)]"
              }`}
              style={{ gridTemplateColumns: DRIVERS_GRID_TEMPLATE }}
            >
              <div role="cell" className="flex min-w-0 items-center gap-[10px]">
                <DriverAvatar driver={driver} size={40} decorative />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[var(--ink-primary)]">{driver.name}</p>
                  <p className="truncate text-[12px] text-[var(--ink-secondary)]">
                    {t("carrier.driversTable.phoneLabel")}{" "}
                    <span className="font-mono text-[12px]">{formatPhone(driver.phone)}</span>
                  </p>
                </div>
              </div>
              <div role="cell" className="min-w-0 truncate font-mono text-[13px] text-[var(--ink-body)]">
                {driver.licenseNumber || "—"}
              </div>
              <div role="cell" className="min-w-0" title={vehicleTitle || undefined}>
                {firstVehicle ? (
                  <div className="flex min-w-0 items-center gap-[8px]">
                    <VehicleAvatar
                      type={firstVehicle.type}
                      typeLabel={t(`vehicleType.${firstVehicle.type}`)}
                      photoUrl={firstVehicle.photos[0] ?? null}
                      size="xs"
                    />
                    <span className="truncate text-[13px] text-[var(--ink-strong)]">
                      {t(`vehicleType.${firstVehicle.type}`)} {firstVehicle.model}
                    </span>
                    {extraCount > 0 ? (
                      <span
                        className="shrink-0 rounded-chip px-[6px] py-[2px] font-mono text-[11px] font-medium"
                        style={{ background: "var(--plate-bg)", color: "var(--plate-ink)" }}
                      >
                        +{extraCount}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span className="text-[13px] text-[var(--ink-muted)]">{t("carrier.driversTable.noVehicle")}</span>
                )}
              </div>
              <div role="cell" className="min-w-0">
                <DocumentChipsRow chips={chips} t={t} />
              </div>
              <StopClickPropagation className="flex items-center justify-center">
                <RowActionsMenu
                  onEdit={() => setEditingDriverId(driver.id)}
                  deleteUrl={`/api/carrier/drivers/${driver.id}`}
                />
              </StopClickPropagation>
            </ClickableRow>
          );
        })}
      </div>

      {editingDriverId ? (
        <EditDriverPanel
          driverId={editingDriverId}
          vehicles={vehicles}
          onClose={() => setEditingDriverId(null)}
          onSaved={onSaved}
        />
      ) : null}
    </div>
  );
}
