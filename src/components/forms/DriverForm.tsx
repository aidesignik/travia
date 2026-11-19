"use client";

import { ChangeEvent, FormEvent, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DRIVER_COLORS, DRIVER_COLOR_KEYS, type DriverColorKey } from "@/lib/driver-colors";
import { SHEET_INPUT_CLASS, SHEET_LABEL_CLASS } from "@/components/calendar/newRide/sheetFieldClasses";

function ColorPicker({ value, onChange }: { value: DriverColorKey | undefined; onChange: (key: DriverColorKey) => void }) {
  const t = useTranslations();
  return (
    <div className="flex flex-wrap gap-2">
      {DRIVER_COLOR_KEYS.map((key) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={selected}
            aria-label={key}
            title={key}
            className="h-7 w-7 shrink-0 rounded-full transition-[box-shadow] duration-[.12s] ease-out"
            style={{
              background: DRIVER_COLORS[key].bg,
              boxShadow: selected
                ? `0 0 0 2px white, 0 0 0 4px ${DRIVER_COLORS[key].fg}`
                : "0 0 0 1px rgba(0,0,0,.08)",
            }}
          />
        );
      })}
      {!value ? <p className="w-full text-[13px] text-[var(--ink-muted)]">{t("carrier.driverForm.colorAuto")}</p> : null}
    </div>
  );
}

function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function DocSideUpload({
  label,
  url,
  uploading,
  onFile,
  onRemove,
}: {
  label: string;
  url: string;
  uploading: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const t = useTranslations();

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFile(file);
  }

  return (
    <div className="space-y-1">
      <p className="text-[13px] font-semibold text-[var(--ink-muted)]">{label}</p>
      {url ? (
        <div className="space-y-1 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-24 w-full rounded-control border border-[var(--border-hairline)] object-cover" />
          <button type="button" onClick={onRemove} className="text-[13px] font-semibold text-[var(--ink-destructive)] hover:underline">
            {t("common.remove")}
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center justify-center rounded-control border-[1.5px] border-dashed border-[var(--border-strong)] p-[11px] text-center text-[13px] font-semibold text-[var(--action-bg)]">
          {label}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            onChange={onChange}
            className="hidden"
          />
        </label>
      )}
    </div>
  );
}

function DriverDocumentSection({
  title,
  expiry,
  onExpiryChange,
  frontUrl,
  onFrontChange,
  backUrl,
  onBackChange,
  docType,
}: {
  title: string;
  expiry: string;
  onExpiryChange: (value: string) => void;
  frontUrl: string;
  onFrontChange: (url: string) => void;
  backUrl: string;
  onBackChange: (url: string) => void;
  docType: string;
}) {
  const t = useTranslations();
  const uid = useId();
  const [uploadingSide, setUploadingSide] = useState<"front" | "back" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState(false);

  async function upload(side: "front" | "back", file: File) {
    setUploadingSide(side);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("docType", docType);
    const res = await fetch("/api/carrier/drivers/documents", { method: "POST", body });
    setUploadingSide(null);

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setError(
        err?.error === "TOO_LARGE"
          ? t("carrier.driverForm.docTooLarge")
          : err?.error === "UNSUPPORTED_TYPE"
            ? t("carrier.driverForm.docUnsupportedType")
            : t("carrier.driverForm.docUploadFailed"),
      );
      return;
    }

    const { url, suggestedExpiry } = await res.json();
    if (side === "front") onFrontChange(url);
    else onBackChange(url);

    // Only offer the suggestion while the field is still blank — never
    // overwrite a date the carrier already typed in or already confirmed.
    if (suggestedExpiry && !expiry) {
      onExpiryChange(suggestedExpiry);
      setSuggested(true);
    }
  }

  return (
    <div className="space-y-3 rounded-control border border-[var(--border-hairline)] p-3">
      <p className="text-[14px] font-bold text-[var(--ink-primary)]">{title}</p>
      <div>
        <label htmlFor={`${uid}-expiry`} className={SHEET_LABEL_CLASS}>{t("carrier.driverForm.expiryDate")}</label>
        <Input
          id={`${uid}-expiry`}
          unstyled
          className={`mt-[6px] ${SHEET_INPUT_CLASS}`}
          type="date"
          value={expiry}
          onChange={(e) => {
            onExpiryChange(e.target.value);
            setSuggested(false);
          }}
        />
      </div>
      {suggested ? <p className="text-[13px] text-[var(--warning-ink)]">{t("carrier.driverForm.expirySuggested")}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <DocSideUpload
          label={t("carrier.driverForm.front")}
          url={frontUrl}
          uploading={uploadingSide === "front"}
          onFile={(file) => upload("front", file)}
          onRemove={() => onFrontChange("")}
        />
        <DocSideUpload
          label={t("carrier.driverForm.back")}
          url={backUrl}
          uploading={uploadingSide === "back"}
          onFile={(file) => upload("back", file)}
          onRemove={() => onBackChange("")}
        />
      </div>
      {uploadingSide ? <p className="text-[13px] text-[var(--ink-muted)]">{t("common.loading")}</p> : null}
      {error ? <p className="text-[13px] text-[var(--ink-destructive)]">{error}</p> : null}
    </div>
  );
}

type DriverFormValues = {
  name: string;
  phone: string;
  isAvailable: boolean;
  licenseNumber: string;
  avatarColor: DriverColorKey | undefined;
  vehicleIds: string[];
  idCardExpiry: string;
  idCardFrontUrl: string;
  idCardBackUrl: string;
  licenseExpiry: string;
  licenseFrontUrl: string;
  licenseBackUrl: string;
  cpcExpiry: string;
  cpcFrontUrl: string;
  cpcBackUrl: string;
  medicalCertExpiry: string;
  medicalCertFrontUrl: string;
  medicalCertBackUrl: string;
};

type InitialDriverValues = Omit<
  DriverFormValues,
  "idCardExpiry" | "licenseExpiry" | "cpcExpiry" | "medicalCertExpiry"
> & {
  idCardExpiry: Date | string | null;
  licenseExpiry: Date | string | null;
  cpcExpiry: Date | string | null;
  medicalCertExpiry: Date | string | null;
};

const EMPTY_FORM: DriverFormValues = {
  name: "",
  phone: "",
  isAvailable: true,
  licenseNumber: "",
  avatarColor: undefined,
  vehicleIds: [],
  idCardExpiry: "",
  idCardFrontUrl: "",
  idCardBackUrl: "",
  licenseExpiry: "",
  licenseFrontUrl: "",
  licenseBackUrl: "",
  cpcExpiry: "",
  cpcFrontUrl: "",
  cpcBackUrl: "",
  medicalCertExpiry: "",
  medicalCertFrontUrl: "",
  medicalCertBackUrl: "",
};

export function DriverForm({
  driverId,
  initial,
  vehicles,
  onSaved,
  onDelete,
  deleting,
}: {
  driverId?: string;
  initial?: InitialDriverValues;
  vehicles: { id: string; type: string; model: string }[];
  // When rendered inside the "add driver" side panel, closes the panel and
  // refreshes the list instead of navigating to the standalone drivers
  // page — the panel is already on that page.
  onSaved?: () => void;
  // Only passed in edit mode — renders a "Delete driver" action at the
  // bottom of the form, below Save, instead of in the panel header.
  onDelete?: () => void;
  deleting?: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const uid = useId();
  const [form, setForm] = useState<DriverFormValues>(
    initial
      ? {
          ...initial,
          idCardExpiry: toDateInputValue(initial.idCardExpiry),
          licenseExpiry: toDateInputValue(initial.licenseExpiry),
          cpcExpiry: toDateInputValue(initial.cpcExpiry),
          medicalCertExpiry: toDateInputValue(initial.medicalCertExpiry),
        }
      : EMPTY_FORM,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof DriverFormValues>(key: K, value: DriverFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleVehicle(vehicleId: string) {
    setForm((prev) => ({
      ...prev,
      vehicleIds: prev.vehicleIds.includes(vehicleId)
        ? prev.vehicleIds.filter((id) => id !== vehicleId)
        : [...prev.vehicleIds, vehicleId],
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const url = driverId ? `/api/carrier/drivers/${driverId}` : "/api/carrier/drivers";
    const method = driverId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        licenseNumber: form.licenseNumber || undefined,
        idCardExpiry: form.idCardExpiry || undefined,
        licenseExpiry: form.licenseExpiry || undefined,
        cpcExpiry: form.cpcExpiry || undefined,
        medicalCertExpiry: form.medicalCertExpiry || undefined,
      }),
    });
    setLoading(false);

    if (!res.ok) {
      setError(t("common.saveFailed"));
      return;
    }

    if (onSaved) {
      onSaved();
      return;
    }
    router.push("/carrier/drivers");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-[18px]">
      <div>
        <label htmlFor={`${uid}-name`} className={SHEET_LABEL_CLASS}>{t("carrier.driverForm.name")}</label>
        <Input
          id={`${uid}-name`}
          unstyled
          className={`mt-[6px] ${SHEET_INPUT_CLASS}`}
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={`${uid}-phone`} className={SHEET_LABEL_CLASS}>{t("carrier.driverForm.phone")}</label>
        <Input
          id={`${uid}-phone`}
          unstyled
          className={`mt-[6px] ${SHEET_INPUT_CLASS}`}
          required
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </div>
      <div>
        <label htmlFor={`${uid}-license`} className={SHEET_LABEL_CLASS}>{t("carrier.driverForm.licenseNumber")}</label>
        <Input
          id={`${uid}-license`}
          unstyled
          className={`mt-[6px] ${SHEET_INPUT_CLASS}`}
          value={form.licenseNumber}
          onChange={(e) => set("licenseNumber", e.target.value)}
        />
      </div>
      <div>
        <span className={SHEET_LABEL_CLASS}>{t("carrier.driverForm.avatarColor")}</span>
        <div className="mt-[6px]">
          <ColorPicker value={form.avatarColor} onChange={(key) => set("avatarColor", key)} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-[14px] text-[var(--ink-2)]">
        <input
          type="checkbox"
          checked={form.isAvailable}
          onChange={(e) => set("isAvailable", e.target.checked)}
        />
        {t("carrier.driverForm.isAvailable")}
      </label>

      <div>
        <span className={SHEET_LABEL_CLASS}>{t("carrier.driverForm.assignedVehicles")}</span>
        {vehicles.length === 0 ? (
          <p className="mt-[6px] text-[14px] text-[var(--ink-muted)]">{t("carrier.noVehicles")}</p>
        ) : (
          <div className="mt-[6px] flex flex-wrap gap-3">
            {vehicles.map((vehicle) => (
              <label key={vehicle.id} className="flex items-center gap-2 text-[14px] text-[var(--ink-2)]">
                <input
                  type="checkbox"
                  checked={form.vehicleIds.includes(vehicle.id)}
                  onChange={() => toggleVehicle(vehicle.id)}
                />
                {t(`vehicleType.${vehicle.type}`)} {vehicle.model}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-[var(--border-soft)] pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.065em] text-[var(--ink-eyebrow)]">
          {t("carrier.driverForm.documentsTitle")}
        </p>
        <DriverDocumentSection
          title={t("carrier.driverForm.idCard")}
          docType="idCard"
          expiry={form.idCardExpiry}
          onExpiryChange={(v) => set("idCardExpiry", v)}
          frontUrl={form.idCardFrontUrl}
          onFrontChange={(v) => set("idCardFrontUrl", v)}
          backUrl={form.idCardBackUrl}
          onBackChange={(v) => set("idCardBackUrl", v)}
        />
        <DriverDocumentSection
          title={t("carrier.driverForm.license")}
          docType="license"
          expiry={form.licenseExpiry}
          onExpiryChange={(v) => set("licenseExpiry", v)}
          frontUrl={form.licenseFrontUrl}
          onFrontChange={(v) => set("licenseFrontUrl", v)}
          backUrl={form.licenseBackUrl}
          onBackChange={(v) => set("licenseBackUrl", v)}
        />
        <DriverDocumentSection
          title={t("carrier.driverForm.cpc")}
          docType="cpc"
          expiry={form.cpcExpiry}
          onExpiryChange={(v) => set("cpcExpiry", v)}
          frontUrl={form.cpcFrontUrl}
          onFrontChange={(v) => set("cpcFrontUrl", v)}
          backUrl={form.cpcBackUrl}
          onBackChange={(v) => set("cpcBackUrl", v)}
        />
        <DriverDocumentSection
          title={t("carrier.driverForm.medicalCert")}
          docType="medicalCert"
          expiry={form.medicalCertExpiry}
          onExpiryChange={(v) => set("medicalCertExpiry", v)}
          frontUrl={form.medicalCertFrontUrl}
          onFrontChange={(v) => set("medicalCertFrontUrl", v)}
          backUrl={form.medicalCertBackUrl}
          onBackChange={(v) => set("medicalCertBackUrl", v)}
        />
      </div>

      {error ? <p className="text-[14px] text-[var(--ink-destructive)]">{error}</p> : null}

      <div className="flex items-center gap-[10px]">
        <Button type="submit" disabled={loading}>
          {loading ? t("common.loading") : t("common.save")}
        </Button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={t("carrier.driverForm.deleteDriver")}
            title={t("carrier.driverForm.deleteDriver")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-[var(--border-strong)] text-[var(--ink-destructive)] transition-colors duration-[.12s] ease-out hover:bg-[var(--bg-subtle)] hover:border-[var(--ink-destructive)] disabled:opacity-50 disabled:pointer-events-none"
          >
            <Trash2 size={17} strokeWidth={1.9} />
          </button>
        ) : null}
      </div>
    </form>
  );
}
