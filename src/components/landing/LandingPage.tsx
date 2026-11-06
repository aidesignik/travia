import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Bookmark, Bus, CalendarDays, Check, Route, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { StepsSection } from "./StepsSection";
import "./landing.css";

// Where the marketing CTAs lead: straight into the existing auth screens.
// /register/carrier renders the same email-first screen as /login, which
// works out sign-in vs. sign-up from the address itself.
const LOGIN_HREF = "/login";
const SIGNUP_HREF = "/register/carrier";

const FEATURES = [
  { key: "calendar", Icon: CalendarDays },
  { key: "bookings", Icon: Bookmark },
  { key: "fleet", Icon: Bus },
  { key: "drivers", Icon: User },
] as const;

const AUDIENCES = ["owners", "dispatchers", "clients"] as const;
const BENEFITS = ["planning", "connected", "paperwork"] as const;
const STEPS = [
  { key: "calendar", video: "/landing/step-calendar.mp4", poster: "/landing/step-calendar-poster.jpg" },
  { key: "assign", video: "/landing/step-assign.mp4", poster: "/landing/step-assign-poster.jpg" },
  { key: "paperwork", video: "/landing/step-paperwork.mp4", poster: "/landing/step-paperwork-poster.jpg" },
] as const;

export async function LandingPage() {
  const t = await getTranslations("landing");

  return (
    <div className="lp min-h-full">
      {/* Header */}
      <header className="flex h-20 items-center justify-between gap-6 px-[var(--layout-page-margin)]">
        <Link href="/" aria-label="Travia" className="shrink-0">
          <Image
            src="/travia-logo.svg"
            alt="Travia"
            width={134}
            height={34}
            priority
            className="h-[24px] w-auto sm:h-[28px]"
          />
        </Link>
        <nav aria-label={t("nav.label")} className="hidden items-center gap-8 md:flex">
          <a href="#platform" className="text-[14px] font-medium text-[var(--text-strong)] hover:text-[var(--text-primary)]">
            {t("nav.product")}
          </a>
          <a href="#how-it-works" className="text-[14px] font-medium text-[var(--text-strong)] hover:text-[var(--text-primary)]">
            {t("nav.howItWorks")}
          </a>
          <a href="#operators" className="text-[14px] font-medium text-[var(--text-strong)] hover:text-[var(--text-primary)]">
            {t("nav.operators")}
          </a>
        </nav>
        <div className="flex items-center gap-5 sm:gap-7">
          <Link href={LOGIN_HREF} className="lp-link">
            {t("login")}
          </Link>
          <Link href={SIGNUP_HREF} className="lp-btn lp-btn-md lp-btn-primary">
            {t("tryFree")}
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="px-[var(--layout-page-margin)]">
          <div className="mx-auto flex max-w-[1344px] flex-col items-center pb-12 pt-14 text-center lg:pb-16 lg:pt-20">
            <p className="lp-eyebrow flex items-center gap-2">
              <Route aria-hidden size={16} strokeWidth={2} className="text-[var(--icon-default)]" />
              {t("hero.eyebrow")}
            </p>
            <h1 className="lp-display mt-7 max-w-[780px]">
              {t("hero.titleLine1")}
              <br />
              {t("hero.titleLine2")}
            </h1>
            <p className="lp-body-lg mt-6 max-w-[520px] text-[var(--text-secondary)]">{t("hero.body")}</p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link href={SIGNUP_HREF} className="lp-btn lp-btn-primary">
                {t("tryFree")}
                <ArrowUpRight aria-hidden size={18} strokeWidth={2} />
              </Link>
              <Link href={LOGIN_HREF} className="lp-btn lp-btn-secondary">
                {t("login")}
              </Link>
            </div>
            <p className="mt-4 text-[12px] text-[var(--text-secondary)]">{t("hero.reassurance")}</p>
          </div>

          {/* Sized from the viewport height (16:9, leaving room for the
              header) so the whole video fits on screen when scrolled to —
              on a laptop it narrows and centres instead of running off the
              bottom; on a large monitor it still reaches the full 1344px. */}
          <div
            className="mx-auto max-w-[1344px] overflow-hidden rounded-[var(--radius-xl)] bg-[var(--surface-hero-video)]"
            style={{ width: "min(100%, calc((100svh - 140px) * 16 / 9))" }}
          >
            <video
              className="block aspect-video w-full object-cover"
              src="/landing/hero.mp4"
              poster="/landing/hero-poster.jpg"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-label={t("hero.videoLabel")}
            />
          </div>

          <div className="mx-auto max-w-[1344px] py-10">
            <div className="h-px bg-[var(--border-muted)]" />
            <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <p className="text-[14px] font-semibold">{t("hero.supporting")}</p>
              <ul className="flex flex-wrap gap-x-8 gap-y-2">
                {BENEFITS.map((key) => (
                  <li key={key} className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-secondary)]">
                    <Check aria-hidden size={14} strokeWidth={2.2} className="text-[var(--icon-success)]" />
                    {t(`benefits.${key}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Admin? Handled. */}
        <StepsSection
          title={t("steps.title")}
          copy={t("steps.copy")}
          steps={STEPS.map((s) => ({
            title: t(`steps.${s.key}.title`),
            description: t(`steps.${s.key}.description`),
            video: s.video,
            poster: s.poster,
          }))}
        />

        {/* Your whole operation on one platform. */}
        <section id="platform" className="scroll-mt-6 px-[var(--layout-page-margin)] py-20 lg:py-24">
          <div className="mx-auto flex max-w-[1344px] flex-col items-center gap-4 text-center">
            <h2 className="lp-h2 max-w-[760px]">{t("platform.title")}</h2>
            <p className="lp-body-lg max-w-[580px] text-[var(--text-secondary)]">{t("platform.copy")}</p>
          </div>
          <div className="mx-auto mt-14 grid max-w-[1344px] gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ key, Icon }) => (
              <article key={key} className="flex flex-col items-start gap-5 p-6">
                <span className="flex size-14 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-accent)]">
                  <Icon aria-hidden size={24} strokeWidth={1.75} className="text-[var(--icon-default)]" />
                </span>
                <h3 className="lp-subtitle font-bold">{t(`platform.${key}.title`)}</h3>
                <p className="lp-body text-[var(--text-secondary)]">{t(`platform.${key}.description`)}</p>
                <Link href={SIGNUP_HREF} className="lp-link">
                  {t(`platform.${key}.link`)} →
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* Paperwork, sent in a click. */}
        <section className="px-[var(--layout-page-margin)] pb-20 pt-12 lg:pb-24">
          <div className="mx-auto flex max-w-[1344px] flex-col items-center gap-12 overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--surface-muted)] px-6 pt-14 sm:px-12 lg:h-[720px] lg:flex-row lg:gap-16 lg:px-20 lg:pt-20">
            <div className="flex w-full max-w-[520px] flex-col items-start gap-6 lg:self-center lg:pb-20">
              <h2 className="lp-h2">{t("paperwork.title")}</h2>
              <p className="lp-body-lg text-[var(--text-secondary)]">{t("paperwork.body")}</p>
              <Link href={SIGNUP_HREF} className="lp-link">
                {t("paperwork.cta")} →
              </Link>
            </div>
            <div className="flex w-full flex-1 justify-center self-end">
              <div className="lp-phone-crop" aria-hidden>
                <div className="lp-phone">
                  <div className="lp-phone-screen">
                    <div className="lp-phone-island" />
                    <p className="lp-phone-inbox">{t("paperwork.phone.inbox")}</p>
                    <div className="lp-mail lp-mail-main">
                      <span className="lp-mail-avatar" />
                      <p className="lp-mail-from">{t("paperwork.phone.from")}</p>
                      <p className="lp-mail-subject">{t("paperwork.phone.subject")}</p>
                      <span className="lp-mail-line" style={{ top: "calc(var(--u) * 90.6)", width: "calc(var(--u) * 380)" }} />
                      <span className="lp-mail-line" style={{ top: "calc(var(--u) * 116.6)", width: "calc(var(--u) * 304)" }} />
                      <span className="lp-mail-chip" style={{ left: "calc(var(--u) * 22.6)", top: "calc(var(--u) * 148.6)" }}>
                        Confirmation.pdf
                      </span>
                      <span className="lp-mail-chip" style={{ left: "calc(var(--u) * 213.6)", top: "calc(var(--u) * 148.6)" }}>
                        Contract.pdf
                      </span>
                      <span className="lp-mail-chip" style={{ left: "calc(var(--u) * 22.6)", top: "calc(var(--u) * 200.6)" }}>
                        Invoice.pdf
                      </span>
                    </div>
                    <div className="lp-mail lp-mail-next">
                      <span
                        className="lp-mail-line"
                        style={{ top: "calc(var(--u) * 23.6)", width: "calc(var(--u) * 190)", height: "calc(var(--u) * 11)" }}
                      />
                      <span
                        className="lp-mail-line"
                        style={{ top: "calc(var(--u) * 46.6)", width: "calc(var(--u) * 322)", height: "calc(var(--u) * 11)", background: "#f4f4f6" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Made for the people who keep things moving. */}
        <section id="operators" className="lp-inverse scroll-mt-0 bg-[var(--surface-inverse)] px-[var(--layout-page-margin)] py-20 text-[var(--text-inverse)] lg:py-24">
          <div className="mx-auto flex max-w-[1344px] flex-col gap-14">
            <h2 className="lp-h2 mx-auto max-w-[760px] text-center">{t("audience.title")}</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {AUDIENCES.map((key) => (
                <article
                  key={key}
                  className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-[var(--border-inverse-subtle)] bg-[var(--surface-inverse-raised)] p-7"
                >
                  <p className="lp-eyebrow text-[var(--text-inverse-secondary)]">{t(`audience.${key}.label`)}</p>
                  <p className="lp-subtitle font-semibold">{t(`audience.${key}.statement`)}</p>
                </article>
              ))}
            </div>
            <div className="h-px bg-[var(--surface-inverse-subtle)]" />
            <div className="flex flex-col items-center gap-6 text-center">
              <h2 className="lp-h3 max-w-[1000px]">{t("closing.title")}</h2>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href={SIGNUP_HREF} className="lp-btn lp-btn-inverse">
                  {t("closing.demo")}
                </Link>
                <a href="#how-it-works" className="lp-btn lp-btn-inverse-outline">
                  {t("closing.explore")}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
