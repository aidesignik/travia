"use client";

import { FormEvent, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { GoogleSignInButton } from "@/components/forms/GoogleSignInButton";
import {
  readTripSearchState,
  tripStateToRequestBody,
} from "@/lib/tripQueryParams";

// Google button, email/password inputs and the submit button all share
// this sizing (42px tall, 10px radius, 14px type) — overridden via
// inline style rather than editing the shared Button/Input components,
// which are used all over the app.
const CONTROL_STYLE = { height: 42, borderRadius: 10 } as const;
const INPUT_STYLE = { ...CONTROL_STYLE, paddingLeft: 13, paddingRight: 13, fontSize: 14 } as const;

// One screen for both login and carrier registration — the user never
// picks a mode. Step 1 is just an email; submitting it asks
// /api/auth/check-email whether that address already has an account.
// Step 2 shows a password field with copy (and the submit action) that
// matches what was found: an existing account logs in, a new one
// registers (company details are collected afterward in
// /carrier/onboarding, same as before).
export function AuthCredentialsForm() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountExists, setAccountExists] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "AccessDenied" ? t("auth.googleAccountTypeMismatch") : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmitEmail(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
    setLoading(false);

    if (!res.ok) {
      setError(t("auth.invalidEmail"));
      return;
    }

    const { exists } = await res.json();
    setAccountExists(exists);
    setStep("password");
  }

  function onChangeEmail() {
    setStep("email");
    setPassword("");
    setError(null);
  }

  async function onSubmitPassword(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (!accountExists) {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "CARRIER", email, password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setLoading(false);
        if (res.status === 429) {
          setError(t("auth.tooManyAttempts"));
        } else if (body?.error === "EMAIL_IN_USE") {
          setAccountExists(true);
          setError(t("auth.emailInUse"));
        } else if (body?.error?.fieldErrors?.email) {
          setError(t("auth.invalidEmail"));
        } else {
          setError(t("common.saveFailed"));
        }
        return;
      }

      await signIn("credentials", { email, password, redirect: false });
      setLoading(false);
      router.push("/carrier/onboarding");
      router.refresh();
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError(t("auth.invalidCredentials"));
      return;
    }

    const session = await getSession();

    if (session?.user.role === "CLIENT") {
      const trip = readTripSearchState(searchParams);
      if (trip) {
        const tripRes = await fetch("/api/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tripStateToRequestBody(trip)),
        });
        if (tripRes.ok) {
          const { request } = await tripRes.json();
          router.push(`/requests/${request.id}`);
          router.refresh();
          return;
        }
      }
    }

    const destination =
      session?.user.role === "ADMIN"
        ? "/admin/carriers"
        : session?.user.role === "CARRIER"
          ? "/carrier/dashboard"
          : "/dashboard";
    router.push(destination);
    router.refresh();
  }

  return (
    <div className="flex flex-col">
      <GoogleSignInButton />
      <div className="mb-5 mt-7 flex items-center gap-3 text-[14px] text-[#6B6F76]">
        <span className="h-px flex-1 bg-[#E2E0DC]" />
        {t("auth.orDivider")}
        <span className="h-px flex-1 bg-[#E2E0DC]" />
      </div>

      {step === "email" ? (
        <form onSubmit={onSubmitEmail}>
          <label
            htmlFor="auth-email-input"
            className="mb-2 block text-[15px] font-medium text-[#3A3D42]"
          >
            {t("auth.workEmailLabel")}
          </label>
          <div className="flex h-[52px] items-center rounded-[12px] border border-[#D0D3D8] bg-white pl-4 pr-[3px] focus-within:border-[var(--ink)] focus-within:shadow-[0_0_0_3px_rgba(11,27,51,0.25)]">
            <input
              id="auth-email-input"
              type="email"
              autoComplete="email"
              placeholder={t("auth.workEmailPlaceholder")}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-full flex-1 border-0 bg-transparent text-[16px] text-zinc-900 outline-none placeholder:text-zinc-400"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label={t("auth.continueWithEmailAriaLabel")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#F0F1F3] text-[#3A3D42] transition-colors hover:bg-[#E4E6E9] disabled:pointer-events-none disabled:opacity-50"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-[var(--ink-destructive)]">{error}</p> : null}
        </form>
      ) : (
        <form onSubmit={onSubmitPassword} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-zinc-700">{email}</span>
            <button
              type="button"
              onClick={onChangeEmail}
              className="shrink-0 font-medium text-zinc-900 underline"
            >
              {t("auth.changeEmail")}
            </button>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor="auth-password-input" className="block text-[12px] font-semibold text-[var(--ink-2)]">
                {t("common.password")}
              </label>
              {accountExists ? (
                <Link href="/forgot-password" className="text-[12px] font-medium text-[var(--ink)] hover:underline">
                  {t("auth.forgotPasswordLink")}
                </Link>
              ) : null}
            </div>
            <Input
              id="auth-password-input"
              type="password"
              required
              autoFocus
              minLength={accountExists ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
              style={INPUT_STYLE}
            />
          </div>
          {!accountExists ? (
            <p className="text-sm text-zinc-600">{t("auth.registerCarrierSubtitle")}</p>
          ) : null}
          {error ? <p className="text-sm text-[var(--ink-destructive)]">{error}</p> : null}
          <Button
            type="submit"
            disabled={loading}
            className="w-full text-[14px]"
            style={CONTROL_STYLE}
          >
            {loading
              ? t("common.loading")
              : accountExists
                ? t("auth.loginTitle")
                : t("auth.createAccountButton")}
          </Button>
        </form>
      )}

      <p className="mt-3 text-[12px] text-zinc-400">
        {t("auth.needHelpPrefix")}{" "}
        <a href="mailto:support@travia.live" className="text-[var(--ink)] hover:underline">
          {t("auth.contactSupportLink")}
        </a>
      </p>
    </div>
  );
}
