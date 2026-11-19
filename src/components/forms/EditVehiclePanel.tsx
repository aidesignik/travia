"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SidePanel } from "@/components/ui/SidePanel";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { VehicleForm, FieldExpiryChip } from "@/components/forms/VehicleForm";
import type { DocumentChipData } from "@/lib/documentChips";

interface VehicleRecord {
  id: string;
  type: string;
  model: string;
  licensePlate: string | null;
  year: number | null;
  seats: number;
  amenities: string[];
  otherAmenities: string | null;
  status: string;
  photos: string[];
  lastRegistrationDate: string | null;
  lastInspectionDate: string | null;
  documentUrls: string[];
}

export function EditVehiclePanel({
  vehicleId,
  onClose,
  onSaved,
}: {
  vehicleId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations();
  const tType = useTranslations("vehicleType");
  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [expiryChips, setExpiryChips] = useState<DocumentChipData[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Standard fetch-on-mount/on-id-change — same accepted pattern as
    // RidesCalendar's load() and NewRideModal's availability fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLoadFailed(false);
    fetch(`/api/carrier/vehicles/${vehicleId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setVehicle(data.vehicle);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  async function onDelete() {
    setDeleting(true);
    await fetch(`/api/carrier/vehicles/${vehicleId}`, { method: "DELETE" });
    setDeleting(false);
    onSaved();
  }

  return (
    <>
    <SidePanel onClose={onClose} label={vehicle ? `${tType(vehicle.type)} ${vehicle.model}` : t("common.loading")}>
      <PanelHeader
        title={vehicle ? `${tType(vehicle.type)} ${vehicle.model}` : t("common.loading")}
        chips={
          expiryChips.length > 0
            ? expiryChips.map((chip) => <FieldExpiryChip key={chip.docKind} chip={chip} t={t} />)
            : undefined
        }
        onClose={onClose}
        closeLabel={t("common.close")}
      />
      <div className="flex-1 overflow-y-auto px-5 py-[18px]">
        {loading ? (
          <p className="text-[14px] text-[var(--ink-disabled)]">{t("common.loading")}</p>
        ) : loadFailed || !vehicle ? (
          <p className="text-[14px] text-[var(--ink-destructive)]">{t("common.loadFailed")}</p>
        ) : (
          <VehicleForm
            vehicleId={vehicle.id}
            initial={{
              type: vehicle.type,
              model: vehicle.model,
              licensePlate: vehicle.licensePlate,
              year: vehicle.year,
              seats: vehicle.seats,
              amenities: vehicle.amenities,
              otherAmenities: vehicle.otherAmenities,
              status: vehicle.status,
              photos: vehicle.photos,
              lastRegistrationDate: vehicle.lastRegistrationDate,
              lastInspectionDate: vehicle.lastInspectionDate,
              documentUrls: vehicle.documentUrls,
            }}
            onSaved={onSaved}
            onDelete={() => setConfirmingDelete(true)}
            deleting={deleting}
            onChipsChange={setExpiryChips}
          />
        )}
      </div>
    </SidePanel>
    {confirmingDelete ? (
      <ConfirmDialog
        title={t("carrier.vehicleForm.deleteConfirmTitle")}
        body={t("carrier.vehicleForm.deleteConfirmBody")}
        cancelLabel={t("common.cancel")}
        confirmLabel={t("carrier.vehicleForm.deleteVehicle")}
        confirming={deleting}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={onDelete}
      />
    ) : null}
    </>
  );
}
