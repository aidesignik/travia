"use client";

import { ChangeEvent, FormEvent, useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { vehicleAmenities, vehicleStatuses, vehicleTypes } from "@/lib/validation/vehicle.schema";
import {
  SHEET_INPUT_CLASS,
  SHEET_INPUT_ERROR_CLASS,
  SHEET_SELECT_CLASS,
  SHEET_LABEL_CLASS,
  SheetChevronIcon,
} from "@/components/calendar/newRide/sheetFieldClasses";
import { vehicleDocumentChips, type DocumentChipData } from "@/lib/documentChips";
import { expiredDocMessageKey } from "@/lib/expiryStatus";

// Same visual language as the fleet table's DocumentChipsRow — a vehicle
// flagged there (e.g. "Inspection expired · 27d ago") shows the identical
// chip in the panel header (see PanelHeader's `chips` prop in
// EditVehiclePanel/AddVehiclePanel), so the warning that brought the
// carrier into this panel is still visible. The matching field itself
// (below) only gets a red border — no repeated chip next to it.
export function FieldExpiryChip({ chip, t }: { chip: DocumentChipData; t: ReturnType<typeof useTranslations> }) {
  const label = t(`carrier.docChip.${chip.docKind}`);
  if (chip.status === "expiringSoon") {
    return (
      <span
        className="inline-flex max-w-full items-center rounded-full px-[8px] py-[2px] text-[11px] font-semibold"
        style={{ background: "var(--warning-bg)", color: "var(--warning-text)" }}
      >
        {t("carrier.docChip.expiringSoonFull", { label, days: chip.daysLeft })}
      </span>
    );
  }
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full px-[8px] py-[2px] text-[11px] font-semibold"
      style={{ background: "var(--danger-bg)", color: "var(--danger-text)" }}
    >
      {t(expiredDocMessageKey(chip.docKind), { label })} · {t("carrier.docChip.daysAgo", { days: chip.daysAgo })}
    </span>
  );
}

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function docNameFromUrl(url: string): string {
  return url.split("/").pop() ?? url;
}

type VehicleFormValues = {
  type: string;
  model: string;
  licensePlate: string | null;
  year: number | null;
  seats: number;
  amenities: string[];
  otherAmenities: string | null;
  status: string;
  photos: string[];
  lastRegistrationDate: string;
  lastInspectionDate: string;
  documentUrls: string[];
};

type InitialVehicleValues = Omit<VehicleFormValues, "lastRegistrationDate" | "lastInspectionDate"> & {
  lastRegistrationDate: Date | string | null;
  lastInspectionDate: Date | string | null;
};

function buildFormValues(initial: InitialVehicleValues | undefined): VehicleFormValues {
  return initial
    ? {
        ...initial,
        lastRegistrationDate: toDateInputValue(initial.lastRegistrationDate),
        lastInspectionDate: toDateInputValue(initial.lastInspectionDate),
      }
    : {
        type: vehicleTypes[0],
        model: "",
        licensePlate: "",
        year: new Date().getFullYear(),
        seats: 50,
        amenities: [],
        otherAmenities: "",
        status: "ACTIVE",
        photos: [],
        lastRegistrationDate: "",
        lastInspectionDate: "",
        documentUrls: [],
      };
}

export function VehicleForm({
  vehicleId,
  initial,
  onSaved,
  onDelete,
  deleting,
  onChipsChange,
}: {
  vehicleId?: string;
  initial?: InitialVehicleValues;
  // When rendered inside the "add vehicle" side panel, closes the panel
  // and refreshes the list instead of navigating to the standalone fleet
  // page — the panel is already on that page.
  onSaved?: () => void;
  // Only passed in edit mode — renders a "Delete vehicle" action at the
  // bottom of the form, below Save, instead of in the panel header.
  onDelete?: () => void;
  deleting?: boolean;
  // Reports the live (not just `initial`) registration/inspection expiry
  // chips up to the panel, which renders them under its title — fixing a
  // date here clears the matching header chip immediately, before saving.
  onChipsChange?: (chips: DocumentChipData[]) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const uid = useId();
  const [form, setForm] = useState<VehicleFormValues>(() => buildFormValues(initial));
  // Snapshot of the values Save would be a no-op against — only set once,
  // from the same initializer `form` started from, so editing and then
  // reverting a field back by hand also re-disables Save.
  const [initialSnapshot] = useState<VehicleFormValues>(() => buildFormValues(initial));
  const isDirty = !initial || JSON.stringify(form) !== JSON.stringify(initialSnapshot);
  const [loading, setLoading] = useState(false);
  // Recomputed from the live field values (not the original `initial`) so
  // fixing the date clears the warning immediately, before saving.
  const docChips = useMemo(
    () =>
      vehicleDocumentChips({
        lastRegistrationDate: form.lastRegistrationDate ? new Date(form.lastRegistrationDate) : null,
        lastInspectionDate: form.lastInspectionDate ? new Date(form.lastInspectionDate) : null,
      }),
    [form.lastRegistrationDate, form.lastInspectionDate],
  );
  // vehicleDocumentChips returns one entry per document that has a date at
  // all, including "valid" ones — only surface the two problem states here.
  const registrationChip =
    docChips.find((c) => c.docKind === "registration" && c.status !== "valid") ?? null;
  const inspectionChip = docChips.find((c) => c.docKind === "inspection" && c.status !== "valid") ?? null;
  useEffect(() => {
    onChipsChange?.([registrationChip, inspectionChip].filter((c): c is DocumentChipData => c !== null));
    // onChipsChange intentionally omitted: parents pass an inline setState
    // callback, which would otherwise re-run this effect every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationChip, inspectionChip]);
  const [error, setError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  function toggleAmenity(amenity: string) {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  }

  async function onPhotosSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const room = 10 - form.photos.length;
    if (room <= 0) return;

    setPhotoUploading(true);
    setPhotoError(null);

    for (const file of files.slice(0, room)) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/carrier/vehicles/photos", { method: "POST", body });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setPhotoError(
          err?.error === "TOO_LARGE"
            ? t("carrier.vehicleForm.photoTooLarge")
            : err?.error === "UNSUPPORTED_TYPE"
              ? t("carrier.vehicleForm.photoUnsupportedType")
              : t("carrier.vehicleForm.photoUploadFailed"),
        );
        continue;
      }

      const { photoUrl } = await res.json();
      setForm((prev) => ({ ...prev, photos: [...prev.photos, photoUrl] }));
    }

    setPhotoUploading(false);
  }

  function removePhoto(url: string) {
    setForm((prev) => ({ ...prev, photos: prev.photos.filter((p) => p !== url) }));
  }

  async function onDocumentsSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const room = 10 - form.documentUrls.length;
    if (room <= 0) return;

    setDocUploading(true);
    setDocError(null);

    for (const file of files.slice(0, room)) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/carrier/vehicles/documents", { method: "POST", body });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setDocError(
          err?.error === "TOO_LARGE"
            ? t("carrier.vehicleForm.docTooLarge")
            : err?.error === "UNSUPPORTED_TYPE"
              ? t("carrier.vehicleForm.docUnsupportedType")
              : t("carrier.vehicleForm.docUploadFailed"),
        );
        continue;
      }

      const { url } = await res.json();
      setForm((prev) => ({ ...prev, documentUrls: [...prev.documentUrls, url] }));
    }

    setDocUploading(false);
  }

  function removeDocument(url: string) {
    setForm((prev) => ({ ...prev, documentUrls: prev.documentUrls.filter((d) => d !== url) }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const url = vehicleId ? `/api/carrier/vehicles/${vehicleId}` : "/api/carrier/vehicles";
    const method = vehicleId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        licensePlate: form.licensePlate || undefined,
        year: form.year || undefined,
        otherAmenities: form.otherAmenities || undefined,
        lastRegistrationDate: form.lastRegistrationDate || undefined,
        lastInspectionDate: form.lastInspectionDate || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      setError(t("carrier.vehicleForm.saveFailed"));
      return;
    }

    if (onSaved) {
      onSaved();
      return;
    }
    router.push("/carrier/fleet");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-[18px]">
      <div className="grid gap-[10px] sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-type`} className={SHEET_LABEL_CLASS}>{t("carrier.vehicleForm.type")}</label>
          <div className="relative mt-[6px]">
            <Select id={`${uid}-type`} unstyled className={SHEET_SELECT_CLASS} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {vehicleTypes.map((type) => (
                <option key={type} value={type}>
                  {t(`vehicleType.${type}`)}
                </option>
              ))}
            </Select>
            <SheetChevronIcon />
          </div>
        </div>
        <div>
          <label htmlFor={`${uid}-model`} className={SHEET_LABEL_CLASS}>{t("carrier.vehicleForm.model")}</label>
          <Input
            id={`${uid}-model`}
            unstyled
            className={`mt-[6px] ${SHEET_INPUT_CLASS}`}
            required
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-plate`} className={SHEET_LABEL_CLASS}>{t("carrier.vehicleForm.licensePlate")}</label>
          <Input
            id={`${uid}-plate`}
            unstyled
            className={`mt-[6px] ${SHEET_INPUT_CLASS}`}
            value={form.licensePlate ?? ""}
            onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-year`} className={SHEET_LABEL_CLASS}>{t("carrier.vehicleForm.year")}</label>
          <Input
            id={`${uid}-year`}
            unstyled
            className={`mt-[6px] ${SHEET_INPUT_CLASS}`}
            type="number"
            value={form.year ?? ""}
            onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-seats`} className={SHEET_LABEL_CLASS}>{t("carrier.vehicleForm.seats")}</label>
          <Input
            id={`${uid}-seats`}
            unstyled
            className={`mt-[6px] ${SHEET_INPUT_CLASS}`}
            type="number"
            required
            value={form.seats}
            onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-reg-date`} className={SHEET_LABEL_CLASS}>{t("carrier.vehicleForm.lastRegistrationDate")}</label>
          <Input
            id={`${uid}-reg-date`}
            unstyled
            className={`mt-[6px] ${registrationChip?.status === "expired" ? SHEET_INPUT_ERROR_CLASS : SHEET_INPUT_CLASS}`}
            type="date"
            value={form.lastRegistrationDate}
            onChange={(e) => setForm({ ...form, lastRegistrationDate: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-insp-date`} className={SHEET_LABEL_CLASS}>{t("carrier.vehicleForm.lastInspectionDate")}</label>
          <Input
            id={`${uid}-insp-date`}
            unstyled
            className={`mt-[6px] ${inspectionChip?.status === "expired" ? SHEET_INPUT_ERROR_CLASS : SHEET_INPUT_CLASS}`}
            type="date"
            value={form.lastInspectionDate}
            onChange={(e) => setForm({ ...form, lastInspectionDate: e.target.value })}
          />
        </div>
      </div>

      <div>
        <span className={SHEET_LABEL_CLASS}>{t("carrier.vehicleForm.amenities")}</span>
        <div className="mt-[6px] flex flex-wrap gap-3">
          {vehicleAmenities.map((amenity) => (
            <label key={amenity} className="flex items-center gap-2 text-[14px] text-[var(--ink-2)]">
              <input
                type="checkbox"
                checked={form.amenities.includes(amenity)}
                onChange={() => toggleAmenity(amenity)}
              />
              {t(`amenities.${amenity}`)}
            </label>
          ))}
        </div>
        <Input
          unstyled
          aria-label={t("carrier.vehicleForm.otherAmenitiesPlaceholder")}
          className={`mt-2 ${SHEET_INPUT_CLASS}`}
          placeholder={t("carrier.vehicleForm.otherAmenitiesPlaceholder")}
          value={form.otherAmenities ?? ""}
          onChange={(e) => setForm({ ...form, otherAmenities: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor={`${uid}-status`} className={SHEET_LABEL_CLASS}>{t("carrier.vehicleForm.status")}</label>
        <div className="relative mt-[6px]">
          <Select id={`${uid}-status`} unstyled className={SHEET_SELECT_CLASS} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {vehicleStatuses.map((status) => (
              <option key={status} value={status}>
                {t(`vehicleStatus.${status}`)}
              </option>
            ))}
          </Select>
          <SheetChevronIcon />
        </div>
      </div>

      <div className="space-y-2">
        {/* Not a <Field>/<label> here on purpose — the per-photo Remove
            buttons need to be normal, independently clickable controls,
            and a <button> nested inside a <label> is invalid HTML that
            browsers handle inconsistently. */}
        <span className={SHEET_LABEL_CLASS}>{t("carrier.vehicleForm.photos")}</span>
        {form.photos.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {form.photos.map((url) => (
              <div key={url} className="space-y-1 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-20 w-full rounded-control border border-[var(--border-hairline)] object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  className="text-[13px] font-semibold text-[var(--ink-destructive)] hover:underline"
                >
                  {t("common.remove")}
                </button>
              </div>
            ))}
          </div>
        ) : null}
        {form.photos.length < 10 ? (
          <label className="flex cursor-pointer items-center justify-center rounded-control border-[1.5px] border-dashed border-[var(--border-strong)] p-[11px] text-center text-[13px] font-semibold text-[var(--action-bg)]">
            {t("common.chooseFiles")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={photoUploading}
              onChange={onPhotosSelected}
              className="hidden"
            />
          </label>
        ) : null}
        <p className="text-[13px] text-[var(--ink-muted)]">
          {photoUploading ? t("common.loading") : t("carrier.vehicleForm.photosUploadHint")}
        </p>
        {photoError ? <p className="text-[13px] text-[var(--ink-destructive)]">{photoError}</p> : null}
      </div>

      <div className="space-y-2">
        <span className={SHEET_LABEL_CLASS}>{t("carrier.vehicleForm.documents")}</span>
        {form.documentUrls.length > 0 ? (
          <ul className="space-y-1">
            {form.documentUrls.map((url) => (
              <li
                key={url}
                className="flex items-center justify-between gap-3 rounded-control border border-[var(--border-hairline)] px-3 py-2 text-[14px]"
              >
                <a href={url} target="_blank" rel="noreferrer" className="truncate text-[var(--ink-2)] underline">
                  {docNameFromUrl(url)}
                </a>
                <button
                  type="button"
                  onClick={() => removeDocument(url)}
                  className="shrink-0 text-[13px] font-semibold text-[var(--ink-destructive)] hover:underline"
                >
                  {t("common.remove")}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {form.documentUrls.length < 10 ? (
          <label className="flex cursor-pointer items-center justify-center rounded-control border-[1.5px] border-dashed border-[var(--border-strong)] p-[11px] text-center text-[13px] font-semibold text-[var(--action-bg)]">
            {t("common.chooseFiles")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              multiple
              disabled={docUploading}
              onChange={onDocumentsSelected}
              className="hidden"
            />
          </label>
        ) : null}
        <p className="text-[13px] text-[var(--ink-muted)]">
          {docUploading ? t("common.loading") : t("carrier.vehicleForm.documentsUploadHint")}
        </p>
        {docError ? <p className="text-[13px] text-[var(--ink-destructive)]">{docError}</p> : null}
      </div>

      {error ? <p className="text-[14px] text-[var(--ink-destructive)]">{error}</p> : null}

      <div className="flex items-center gap-[10px]">
        <Button type="submit" disabled={loading || !isDirty}>
          {loading ? t("common.loading") : t("common.save")}
        </Button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={t("carrier.vehicleForm.deleteVehicle")}
            title={t("carrier.vehicleForm.deleteVehicle")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-[var(--border-strong)] text-[var(--ink-destructive)] transition-colors duration-[.12s] ease-out hover:bg-[var(--bg-subtle)] hover:border-[var(--ink-destructive)] disabled:opacity-50 disabled:pointer-events-none"
          >
            <Trash2 size={17} strokeWidth={1.9} />
          </button>
        ) : null}
      </div>
    </form>
  );
}
