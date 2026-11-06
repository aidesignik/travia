import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Check } from "lucide-react";
import { AuthCardScreen } from "@/components/layout/AuthCardScreen";
import { AuthCredentialsForm } from "@/components/forms/AuthCredentialsForm";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("signupPageTitle") };
}

const PERKS = ["signupPerk1", "signupPerk2", "signupPerk3", "signupPerk4", "signupPerk5"] as const;

// Where every "Try it free" / "Get started" link lands. The form still
// works out login vs. sign-up from the email itself, so someone who
// already has an account and ends up here can just log in.
export default async function RegisterCarrierPage() {
  const t = await getTranslations("auth");

  return (
    <AuthCardScreen wide>
      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
        <div>
          <h1
            className="m-0 text-balance text-[clamp(28px,3vw,36px)] font-semibold leading-[1.08] tracking-[-0.03em] text-zinc-900"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            {t("signupCardTitle")}
          </h1>
          <p className="m-0 mt-3 text-balance text-[16px] leading-[1.5] text-zinc-600">{t("signupCardSubtitle")}</p>
          <div className="mt-8">
            <AuthCredentialsForm variant="signup" />
          </div>
          <p className="m-0 mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-zinc-600">
            {t("haveAccount")}
            <Link href="/login" className="inline-flex items-center gap-1.5 font-semibold text-zinc-900 hover:underline">
              {t("loginLink")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </p>
        </div>

        <div className="flex flex-col justify-center border-t border-[#ECEAE4] pt-10 md:border-l md:border-t-0 md:pl-16 md:pt-0">
          <p className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-zinc-900">
            {t("signupPerksEyebrow")}
          </p>
          <h2
            className="m-0 mt-4 text-balance text-[clamp(24px,2.6vw,30px)] font-semibold leading-[1.15] tracking-[-0.02em] text-zinc-900"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            {t("signupPerksTitle")}
          </h2>
          <ul className="m-0 mt-7 flex list-none flex-col gap-4 p-0">
            {PERKS.map((key) => (
              <li key={key} className="flex items-start gap-3 text-[15px] leading-[1.45] text-zinc-600">
                <Check className="mt-[3px] h-[18px] w-[18px] shrink-0 text-zinc-900" strokeWidth={2.4} aria-hidden="true" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AuthCardScreen>
  );
}
