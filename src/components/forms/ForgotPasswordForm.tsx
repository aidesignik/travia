"use client";

import { FormEvent, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// 42px controls, sized for the split-screen layout this page still uses
// (the login and sign-up cards use their own 52px controls).
const CONTROL_STYLE = { height: 42, borderRadius: 10 } as const;

export function ForgotPasswordForm() {
  const t = useTranslations();
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);

    // Always shown on success regardless of what the server actually did —
    // the endpoint itself never reveals whether the email has an account.
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, locale }),
    });

    setLoading(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[15px] text-zinc-700">{t("auth.forgotPasswordSentBody")}</p>
        <Link href="/login" className="text-[14px] font-medium text-[var(--ink)] hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="forgot-password-email" className="mb-1.5 block text-[12px] font-semibold text-[var(--ink-2)]">
          {t("auth.workEmailLabel")}
        </label>
        <Input
          id="forgot-password-email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full"
          style={CONTROL_STYLE}
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full text-[14px]" style={CONTROL_STYLE}>
        {loading ? t("common.loading") : t("auth.sendResetLink")}
      </Button>
      <Link href="/login" className="text-[14px] font-medium text-[var(--ink)] hover:underline">
        {t("auth.backToLogin")}
      </Link>
    </form>
  );
}
