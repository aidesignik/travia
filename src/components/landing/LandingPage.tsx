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
// The documents list in the expiry phone illustration: real document
// kinds the app tracks (vehicle registration/inspection, driver licence,
// medical certificate), one of each status, and the first one renews.
const EXPIRY_ROWS = [
  { key: "setra", name: "Setra S 515 HD", photo: null, status: "warn", renews: true },
  { key: "daniel", name: "Daniel Reed", photo: "/landing/avatars/daniel-reed.png", status: "ok", renews: false },
  { key: "man", name: "MAN Lion's Coach", photo: null, status: "bad", renews: false },
  { key: "marco", name: "Marco Weber", photo: "/landing/avatars/marco-weber.png", status: "ok", renews: false },
] as const;
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

          {/* Same width and corners as the other full-width section panels
              (e.g. "Paperwork, sent in a click."), but its height is capped
              to the viewport (leaving room for the header) so the whole
              panel fits on screen when scrolled to. When the cap kicks in,
              the 16:9 video stays whole and centred; the panel colour
              matches the video's own background, so the extra space at its
              sides reads as part of the scene. */}
          <div className="mx-auto aspect-video max-h-[calc(100svh-140px)] w-full max-w-[1344px] overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--surface-hero-video)]">
            <video
              className="block h-full w-full object-contain"
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

        {/* Never miss an expiry. */}
        <section className="px-[var(--layout-page-margin)] pb-20 pt-12 lg:pb-24">
          <div className="mx-auto flex max-w-[1344px] flex-col items-center gap-12 overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--surface-muted)] px-6 pt-14 sm:px-12 lg:aspect-video lg:max-h-[calc(100svh-140px)] lg:w-full lg:flex-row lg:gap-16 lg:px-20 lg:pt-20">
            <div className="flex w-full max-w-[520px] flex-col items-start gap-6 lg:self-center lg:pb-20">
              <h2 className="lp-h2">{t("expiry.title")}</h2>
              <p className="lp-body-lg text-[var(--text-secondary)]">{t("expiry.body")}</p>
              <Link href={SIGNUP_HREF} className="lp-link">
                {t("expiry.cta")} →
              </Link>
            </div>
            <div className="flex w-full flex-1 justify-center self-end">
              {/* A short loop on the documents screen: a reminder drops in
                  for a registration that's about to run out, its row
                  pulses, then flips to renewed. The list is on screen from
                  the first frame. Pure CSS (see .lp-ph-* in landing.css);
                  with reduced motion it shows the list without animating. */}
              <div className="lp-phone-crop" aria-hidden>
                <div className="lp-phone">
                  <div className="lp-phone-screen">
                    <div className="lp-phone-island" />
                    <span className="lp-ph-time">9:41</span>
                    <span className="lp-ph-bars">
                      <i style={{ height: "35%" }} />
                      <i style={{ height: "55%" }} />
                      <i style={{ height: "75%" }} />
                      <i style={{ height: "100%" }} />
                    </span>
                    <p className="lp-phone-inbox">{t("expiry.phone.title")}</p>

                    <div className="lp-ph-notif">
                      <span className="lp-ph-notif-ic">
                        <Image src="/travia-icon.svg" alt="" width={30} height={30} loading="eager" />
                      </span>
                      <span className="lp-ph-notif-txt">
                        <b>Travia</b>
                        <span>{t("expiry.phone.notification")}</span>
                      </span>
                      <span className="lp-ph-notif-now">{t("expiry.phone.now")}</span>
                    </div>

                    <div className="lp-ph-docs">
                      {EXPIRY_ROWS.map((row) => (
                        <div key={row.key} className={`lp-ph-doc${row.renews ? " lp-ph-doc-renew" : ""}`}>
                          {row.photo ? (
                            <Image className="lp-ph-doc-ava" src={row.photo} alt="" width={96} height={96} loading="eager" />
                          ) : (
                            <span className="lp-ph-doc-tile">
                              <Bus aria-hidden strokeWidth={1.9} />
                            </span>
                          )}
                          <span className="lp-ph-doc-txt">
                            <b>{row.name}</b>
                            <small>{t(`expiry.phone.rows.${row.key}.doc`)}</small>
                            <span className="lp-ph-doc-chips">
                              <span className={`lp-ph-chip lp-ph-chip-${row.status}`}>
                                <i />
                                {t(`expiry.phone.rows.${row.key}.status`)}
                              </span>
                              {row.renews ? (
                                <span className="lp-ph-chip lp-ph-chip-ok lp-ph-chip-renewed">
                                  <Check aria-hidden strokeWidth={3} />
                                  {t(`expiry.phone.rows.${row.key}.renewed`)}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </div>
                      ))}
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
