"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import type { Carrier } from "@prisma/client";

type ExistingCarrier = Pick<
  Carrier,
  | "companyName"
  | "taxId"
  | "registrationNumber"
  | "legalRepresentative"
  | "contactEmail"
  | "contactPhone"
  | "city"
  | "address"
  | "postalCode"
  | "logoUrl"
>;

type Props = {
  carrier: ExistingCarrier | null;
  email: string;
};

export function CarrierProfileForm({ carrier, email }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const { update } = useSession();
  const isNew = carrier === null;
  const [form, setForm] = useState({
    companyName: carrier?.companyName ?? "",
    taxId: carrier?.taxId ?? "",
    registrationNumber: carrier?.registrationNumber ?? "",
    legalRepresentative: carrier?.legalRepresentative ?? "",
    contactEmail: carrier?.contactEmail ?? email,
    contactPhone: carrier?.contactPhone ?? "",
    city: carrier?.city ?? "",
    address: carrier?.address ?? "",
    postalCode: carrier?.postalCode ?? "",
    logoUrl: carrier?.logoUrl ?? "",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onLogoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setLogoUploading(true);
    setLogoError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/carrier/profile/logo", { method: "POST", body });
    setLogoUploading(false);

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setLogoError(
        err?.error === "TOO_LARGE"
          ? t("auth.logoTooLarge")
          : err?.error === "UNSUPPORTED_TYPE"
            ? t("auth.logoUnsupportedType")
            : t("auth.logoUploadFailed"),
      );
      return;
    }

    const { logoUrl } = await res.json();
    set("logoUrl", logoUrl);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/carrier/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          taxId: form.taxId,
          registrationNumber: form.registrationNumber,
          legalRepresentative: form.legalRepresentative,
          contactEmail: isNew ? email : form.contactEmail,
          contactPhone: form.contactPhone,
          city: form.city,
          address: form.address || undefined,
          postalCode: form.postalCode || undefined,
          // Sent as-is (not `|| undefined`) so an explicitly removed logo
          // (empty string) actually clears it — `undefined` would be a no-op
          // update and leave the old value in place.
          logoUrl: form.logoUrl,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          body?.error === "TAX_ID_IN_USE"
            ? t("auth.taxIdInUse")
            : t("common.saveFailed"),
        );
        return;
      }

      if (isNew) {
        // Passing an (even empty) object forces a POST with trigger: "update",
        // which re-runs the jwt callback to pick up the carrier just created —
        // update() with no args only GETs the still-stale cached session.
        await update({});
        router.push("/carrier/dashboard");
        router.refresh();
        return;
      }

      setSaved(true);
    } catch (err) {
      console.error("Failed to save carrier profile", err);
      setError(t("common.saveFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("auth.companyName")}>
          <Input
            required
            value={form.companyName}
            onChange={(e) => set("companyName", e.target.value)}
          />
        </Field>
        <Field label={t("auth.taxId")}>
          <Input
            required
            value={form.taxId}
            onChange={(e) => set("taxId", e.target.value)}
          />
        </Field>
        <Field label={t("auth.registrationNumber")}>
          <Input
            required
            value={form.registrationNumber}
            onChange={(e) => set("registrationNumber", e.target.value)}
          />
        </Field>
        <Field label={t("auth.legalRepresentative")}>
          <Input
            required
            value={form.legalRepresentative}
            onChange={(e) => set("legalRepresentative", e.target.value)}
          />
        </Field>
        <Field label={isNew ? t("common.email") : t("auth.contactEmail")}>
          <Input
            type="email"
            required
            disabled={isNew}
            value={isNew ? email : form.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
          />
        </Field>
        <Field label={t("auth.contactPhone")}>
          <Input
            type="tel"
            required
            value={form.contactPhone}
            onChange={(e) => set("contactPhone", e.target.value)}
          />
        </Field>
        <Field label={t("common.city")}>
          <Input
            required
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </Field>
        <Field label={t("auth.postalCode")}>
          <Input
            value={form.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
          />
        </Field>
      </div>

      <Field label={t("auth.address")}>
        <Input
          value={form.address}
          onChange={(e) => set("address", e.target.value)}
        />
      </Field>

      <div className="space-y-1">
        {/* Not a <Field>/<label> here on purpose: the Remove button below
            needs to be a normal, independently clickable control, and a
            <button> nested inside a <label> is invalid HTML that browsers
            handle inconsistently (clicks can get redirected to the label's
            associated control instead of the button). */}
        <span className="block text-sm font-medium text-[var(--ink-body)]">{t("auth.logoUrl")}</span>
        <div className="flex items-center gap-4">
          {form.logoUrl ? (
            <div className="shrink-0 space-y-1 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.logoUrl}
                alt=""
                className="h-16 w-16 rounded-chip border border-[var(--border-control)] object-contain"
              />
              <button
                type="button"
                onClick={() => set("logoUrl", "")}
                className="text-xs font-medium text-[var(--ink-destructive)] hover:underline"
              >
                {t("common.remove")}
              </button>
            </div>
          ) : null}
          <div className="space-y-1">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={logoUploading}
              onChange={onLogoSelected}
              className="text-sm text-[var(--ink-body)] file:mr-3 file:rounded-chip file:border file:border-[var(--border-strong)] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--ink-body)] hover:file:bg-[var(--bg-subtle)]"
            />
            <p className="text-xs text-[var(--ink-muted)]">
              {logoUploading ? t("common.loading") : t("auth.logoUploadHint")}
            </p>
            {logoError ? <p className="text-xs text-[var(--ink-destructive)]">{logoError}</p> : null}
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-[var(--ink-destructive)]">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading
            ? t("common.loading")
            : isNew
              ? t("carrier.completeProfileCta")
              : t("common.save")}
        </Button>
        {saved ? (
          <span className="text-sm text-[var(--status-completed-text)]">
            {t("carrier.profileSaved")}
          </span>
        ) : null}
      </div>
    </form>
  );
}
