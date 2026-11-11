"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { VehicleAvatar } from "@/components/ui/VehicleAvatar";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { DocumentChipsRow } from "@/components/carrier/DocumentChipsRow";
import { RowActionsMenu } from "@/components/carrier/RowActionsMenu";
import { ClickableRow } from "@/components/carrier/ClickableRow";
import { StopClickPropagation } from "@/components/carrier/StopClickPropagation";
import { EditVehiclePanel } from "@/components/forms/EditVehiclePanel";
import { usePathname, useRouter } from "@/i18n/navigation";
import { vehicleDocumentChips } from "@/lib/documentChips";
import { PlateChip } from "@/components/ui/PlateChip";
import { FLEET_GRID_TEMPLATE } from "@/lib/tableLayout";

export interface FleetTableVehicle {
  id: string;
  type: string;
  model: string;
  licensePlate: string | null;
  year: number | null;
  seats: number;
  status: string;
  photos: string[];
  lastRegistrationDate: Date | null;
  lastInspectionDate: Date | null;
  drivers: { id: string; name: string; avatarColor: string | null }[];
}

const HEADER_CLASS = "text-[12px] font-semibold text-[#8E8E93]";

export function FleetTable({
  vehicles,
  initialEditingId = null,
}: {
  vehicles: FleetTableVehicle[];
  initialEditingId?: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(initialEditingId);

  useEffect(() => {
    // Consume the one-time deep-link signal (e.g. from the sidebar's
    // "Needs attention" list) so the side panel opens instead of a full
    // page, then strip it from the URL.
    // Also when the link changes while this page is already open (e.g. a
    // search result for another one).
    if (!initialEditingId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditingVehicleId(initialEditingId);
    router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditingId]);

  function onSaved() {
    setEditingVehicleId(null);
    router.refresh();
  }

  return (
    <div role="table" className="flex flex-col overflow-hidden rounded-[12px] border border-[#EDEDED] bg-white">
      <div
        role="row"
        className="grid items-center gap-3 border-b border-[#EDEDED] px-4 py-[10px]"
        style={{ gridTemplateColumns: FLEET_GRID_TEMPLATE }}
      >
        <span role="columnheader" className={HEADER_CLASS}>{t("carrier.fleetTable.vehicle")}</span>
        <span role="columnheader" className={HEADER_CLASS}>{t("carrier.fleetTable.details")}</span>
        <span role="columnheader" className={HEADER_CLASS}>{t("carrier.table.documents")}</span>
        <span role="columnheader" className={HEADER_CLASS}>{t("carrier.fleetTable.assignedDriver")}</span>
        <span role="columnheader" className="sr-only">{t("common.actions")}</span>
      </div>
      <div role="rowgroup">
        {vehicles.map((vehicle, i) => {
          const chips = vehicleDocumentChips(vehicle);
          const typeLabel = t(`vehicleType.${vehicle.type}`);
          const driver = vehicle.drivers[0];
          const isLast = i === vehicles.length - 1;
          return (
            <ClickableRow
              key={vehicle.id}
              onClick={() => setEditingVehicleId(vehicle.id)}
              selected={editingVehicleId === vehicle.id}
              className={`grid items-center gap-3 px-4 py-3 transition-colors duration-[.12s] ease-out hover:bg-[#FAFAFA] ${
                isLast ? "" : "border-b border-[#F3F3F3]"
              }`}
              style={{ gridTemplateColumns: FLEET_GRID_TEMPLATE }}
            >
              <div role="cell" className="flex min-w-0 items-center gap-[10px]">
                <VehicleAvatar type={vehicle.type} typeLabel={typeLabel} photoUrl={vehicle.photos[0] ?? null} />
                <div className="min-w-0">
                  <p className="flex items-center gap-[6px] truncate text-[14px] font-semibold text-[var(--ink-primary)]">
                    <span className="truncate">
                      {typeLabel} {vehicle.model}
                    </span>
                    {vehicle.status !== "ACTIVE" ? (
                      <span
                        className="shrink-0 rounded-full px-[8px] py-[2px] text-[11.5px] font-semibold"
                        style={{ background: "#F3F3F3", color: "#55555C" }}
                      >
                        {t(`vehicleStatus.${vehicle.status}`)}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate">
                    {vehicle.licensePlate ? (
                      <PlateChip plate={vehicle.licensePlate} />
                    ) : (
                      <span className="text-[11.5px] text-[#6B6B72]">—</span>
                    )}
                  </p>
                </div>
              </div>
              <div role="cell" className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-[#55555C]">
                {vehicle.year ? `${vehicle.year} · ` : ""}
                {vehicle.seats} {t("carrier.fleetTable.seatsShort")}
              </div>
              <div role="cell" className="min-w-0">
                <DocumentChipsRow chips={chips} t={t} />
              </div>
              <StopClickPropagation className="flex min-w-0 items-center gap-[8px]">
                {driver ? (
                  <>
                    <DriverAvatar driver={driver} size={20} decorative />
                    <span className="truncate text-[13px] text-[#27272B]">{driver.name}</span>
                  </>
                ) : (
                  <>
                    <DriverAvatar driver={null} size={20} />
                    <span className="truncate text-[13px] text-[#8E8E93]">{t("carrier.fleetTable.noDriver")}</span>
                  </>
                )}
              </StopClickPropagation>
              <StopClickPropagation className="flex items-center justify-center">
                <RowActionsMenu
                  onEdit={() => setEditingVehicleId(vehicle.id)}
                  deleteUrl={`/api/carrier/vehicles/${vehicle.id}`}
                />
              </StopClickPropagation>
            </ClickableRow>
          );
        })}
      </div>

      {editingVehicleId ? (
        <EditVehiclePanel
          vehicleId={editingVehicleId}
          onClose={() => setEditingVehicleId(null)}
          onSaved={onSaved}
        />
      ) : null}
    </div>
  );
}
