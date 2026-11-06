import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { UserMenu } from "./UserMenu";
import { MARKETPLACE_ENABLED } from "@/config/features";

export async function Navbar({
  containerClassName = "mx-auto flex max-w-5xl items-center justify-between px-4 py-3",
  hideLoginLink = false,
  showDivider = true,
  showMarketingCta = false,
  // The "Get started for free" CTA within the marketing-CTA row — kept
  // separate from showMarketingCta itself so a page can still show the
  // language switcher + "Talk to sales" (e.g. the combined sign-in/sign-up
  // screen, where "Get started" doesn't fit: Google already covers both
  // new and returning users, and the email flow below is the same either
  // way) without losing those two.
  showCta = true,
  // An outlined "Log in" button in that same row — for the sign-up and
  // password screens, where the visitor may already have an account.
  showLoginButton = false,
}: {
  containerClassName?: string;
  hideLoginLink?: boolean;
  showDivider?: boolean;
  showMarketingCta?: boolean;
  showCta?: boolean;
  showLoginButton?: boolean;
} = {}) {
  const [session, t, tNav] = await Promise.all([
    auth(),
    getTranslations("common"),
    getTranslations("nav"),
  ]);

  const dashboardHref =
    session?.user.role === "ADMIN"
      ? "/admin/carriers"
      : session?.user.role === "CARRIER"
        ? "/carrier/dashboard"
        : "/dashboard";

  // The avatar dropdown shows who's signed in — the carrier's company name
  // where there is one, falling back to the account name/email otherwise.
  const carrier =
    session?.user.role === "CARRIER"
      ? await prisma.carrier.findUnique({
          where: { userId: session.user.id },
          select: { companyName: true },
        })
      : null;
  const displayName = carrier?.companyName ?? session?.user.name ?? session?.user.email ?? "";
  const profileHref = session?.user.role === "CARRIER" ? "/carrier/onboarding" : null;

  return (
    <header className={`bg-white ${showDivider ? "border-b border-[var(--border-control)]" : ""}`}>
      <div className={containerClassName}>
        <Link href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/travia-logo.svg" alt={t("appName")} className="h-6 w-auto" />
        </Link>
        <nav className="flex items-center gap-4">
          {showMarketingCta && !session?.user ? (
            <div className="flex items-center">
              <LocaleSwitcher variant="menu" />
              <a
                href="mailto:sales@travia.example"
                className={`hidden h-9 items-center whitespace-nowrap rounded-[8px] px-[10px] text-[14px] font-medium leading-5 sm:flex text-[var(--ink-2)] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)] ${
                  showCta || showLoginButton ? "ml-1" : "ml-2"
                }`}
              >
                {tNav("talkToSales")}
              </a>
              {showCta ? (
                <Link
                  href="/register/carrier"
                  className="ml-2 flex h-9 items-center whitespace-nowrap rounded-[8px] bg-[var(--ink)] px-[14px] text-[14px] font-semibold leading-5 text-white transition-colors hover:bg-[var(--ink-hover)]"
                >
                  {tNav("getStartedFree")}
                </Link>
              ) : null}
              {showLoginButton ? (
                <Link
                  href="/login"
                  className="ml-2 flex h-9 items-center whitespace-nowrap rounded-[8px] border border-[var(--ink)] px-[14px] text-[14px] font-semibold leading-5 text-[var(--ink)] transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  {tNav("login")}
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              {session?.user ? (
                <>
                  {/* With the marketplace hidden, "/" already redirects a signed-in
                      user straight to this same page (see src/proxy.ts) — the
                      logo link covers it, so this would just be a duplicate. */}
                  {MARKETPLACE_ENABLED ? (
                    <Link href={dashboardHref} className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink-primary)]">
                      {tNav("dashboard")}
                    </Link>
                  ) : null}
                </>
              ) : (
                <>
                  {!hideLoginLink ? (
                    <Link href="/login" className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink-primary)]">
                      {tNav("login")}
                    </Link>
                  ) : null}
                  {MARKETPLACE_ENABLED ? (
                    <Link href="/register" className="text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink-primary)]">
                      {tNav("register")}
                    </Link>
                  ) : null}
                </>
              )}
              {/* With the marketplace hidden this would just duplicate the login
                  page's own register link, so it only shows once there's a
                  distinct client side to contrast it against. */}
              {MARKETPLACE_ENABLED && session?.user.role !== "CARRIER" ? (
                <Link
                  href="/register/carrier"
                  className="rounded-md bg-[var(--bg-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--ink-primary)] hover:bg-[var(--border-soft)]"
                >
                  {tNav("forCarriers")}
                </Link>
              ) : null}
              {session?.user ? (
                <UserMenu
                  name={displayName}
                  email={session.user.email ?? null}
                  image={session.user.image}
                  profileHref={profileHref}
                />
              ) : (
                <LocaleSwitcher />
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
