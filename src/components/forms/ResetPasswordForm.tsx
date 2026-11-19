"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const CONTROL_STYLE = { height: 42, borderRadius: "var(--radius-control)" } as const;

export function ResetPasswordForm() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // No token at all in the URL — someone navigated here directly rather
  // than through an emailed link. Show the invalid-link state immediately,
  // no point rendering a form that can't possibly submit successfully.
  if (!token) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[16px] text-[var(--ink-destructive)]">{t("auth.resetPasswordInvalidToken")}</p>
        <Link href="/forgot-password" className="text-[14px] font-medium text-[var(--ink)] hover:underline">
          {t("auth.requestNewLink")}
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[16px] text-[var(--ink-body)]">{t("auth.resetPasswordSuccess")}</p>
        <Link href="/login" className="text-[14px] font-medium text-[var(--ink)] hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("auth.passwordsDontMatch"));
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);

    if (!res.ok) {
      setError(t("auth.resetPasswordInvalidToken"));
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="reset-password-new" className="mb-1.5 block text-[12px] font-semibold text-[var(--ink-2)]">
          {t("auth.newPassword")}
        </label>
        <Input
          id="reset-password-new"
          type="password"
          required
          autoFocus
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full"
          style={CONTROL_STYLE}
        />
      </div>
      <div>
        <label htmlFor="reset-password-confirm" className="mb-1.5 block text-[12px] font-semibold text-[var(--ink-2)]">
          {t("auth.confirmPassword")}
        </label>
        <Input
          id="reset-password-confirm"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full"
          style={CONTROL_STYLE}
        />
      </div>
      {error ? <p className="text-sm text-[var(--ink-destructive)]">{error}</p> : null}
      <Button type="submit" disabled={loading} className="w-full text-[14px]" style={CONTROL_STYLE}>
        {loading ? t("common.loading") : t("auth.resetPasswordButton")}
      </Button>
    </form>
  );
}
