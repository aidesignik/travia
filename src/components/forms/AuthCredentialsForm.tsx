"use client";

import { FormEvent, useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { GoogleSignInButton } from "@/components/forms/GoogleSignInButton";
import {
  readTripSearchState,
  tripStateToRequestBody,
} from "@/lib/tripQueryParams";

// Inputs, the submit button and the Google button all share one control
// size (52px tall, 12px radius), so the card reads as a single column.
const FIELD_CLASS =
  "h-[52px] w-full rounded-[12px] border border-[#D0D3D8] bg-white px-4 text-[16px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[var(--ink)] focus:shadow-[0_0_0_3px_rgba(11,27,51,0.2)]";
const PRIMARY_CLASS =
  "flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[var(--ink)] text-[16px] font-semibold text-white transition-colors hover:bg-[var(--ink-hover)] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2";

// One screen for both login and carrier registration — the user never
// picks a mode. Step 1 is just an email; submitting it asks
// /api/auth/check-email whether that address already has an account.
// Step 2 shows a password field with copy (and the submit action) that
// matches what was found: an existing account logs in, a new one
// registers (company details are collected afterward in
// /carrier/onboarding, same as before).
//
// `variant` only changes copy: /login and the sign-up page both run this
// same flow, so an email that doesn't match the page (a new address on
// /login, an existing one on sign-up) still works — it just gets a short
// hint explaining what will happen.
export function AuthCredentialsForm({ variant = "login" }: { variant?: "login" | "signup" }) {
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

  const mismatchHint =
    variant === "login" && !accountExists
      ? t("auth.noAccountFoundHint")
      : variant === "signup" && accountExists
        ? t("auth.accountExistsHint")
        : null;

  return (
    <div className="flex flex-col">
      {step === "email" ? (
        <>
          <form onSubmit={onSubmitEmail} className="flex flex-col gap-4">
            <div>
              <label htmlFor="auth-email-input" className="sr-only">
                {t("auth.workEmailLabel")}
              </label>
              <input
                id="auth-email-input"
                type="email"
                autoComplete="email"
                placeholder={t("auth.enterEmailPlaceholder")}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={FIELD_CLASS}
              />
              {error ? <p className="mt-2 text-sm text-[var(--ink-destructive)]">{error}</p> : null}
            </div>
            <button type="submit" disabled={loading} className={PRIMARY_CLASS}>
              {loading ? t("common.loading") : t("auth.continueWithEmail")}
            </button>
          </form>
          <div className="my-6 flex items-center gap-4 text-[15px] text-[#6B6F76]">
            <span className="h-px flex-1 bg-[#E2E0DC]" />
            {t("auth.orDivider")}
            <span className="h-px flex-1 bg-[#E2E0DC]" />
          </div>
          <GoogleSignInButton />
        </>
      ) : (
        <form onSubmit={onSubmitPassword} className="flex flex-col gap-4">
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
          {mismatchHint ? (
            <p className="m-0 rounded-[10px] bg-[#F3F1EA] px-3.5 py-2.5 text-sm text-zinc-700">{mismatchHint}</p>
          ) : null}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor="auth-password-input" className="block text-[13px] font-semibold text-[var(--ink-2)]">
                {t("common.password")}
              </label>
              {accountExists ? (
                <Link href="/forgot-password" className="text-[13px] font-medium text-[var(--ink)] hover:underline">
                  {t("auth.forgotPasswordLink")}
                </Link>
              ) : null}
            </div>
            <input
              id="auth-password-input"
              type="password"
              autoComplete={accountExists ? "current-password" : "new-password"}
              required
              autoFocus
              minLength={accountExists ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>
          {!accountExists ? (
            <p className="m-0 text-sm text-zinc-600">{t("auth.registerCarrierSubtitle")}</p>
          ) : null}
          {error ? <p className="m-0 text-sm text-[var(--ink-destructive)]">{error}</p> : null}
          <button type="submit" disabled={loading} className={PRIMARY_CLASS}>
            {loading
              ? t("common.loading")
              : accountExists
                ? t("auth.loginTitle")
                : t("auth.createAccountButton")}
          </button>
        </form>
      )}

      <p className="m-0 mt-4 text-[12px] text-zinc-400">
        {t("auth.needHelpPrefix")}{" "}
        <a href="mailto:support@travia.live" className="text-[var(--ink)] hover:underline">
          {t("auth.contactSupportLink")}
        </a>
      </p>
    </div>
  );
}
