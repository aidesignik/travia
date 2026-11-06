import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { AuthCardScreen } from "@/components/layout/AuthCardScreen";
import { AuthCredentialsForm } from "@/components/forms/AuthCredentialsForm";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("loginPageTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <AuthCardScreen>
      <h1
        className="m-0 text-balance text-[clamp(28px,3vw,36px)] font-semibold leading-[1.08] tracking-[-0.03em] text-zinc-900"
        style={{ fontFamily: "var(--font-sora)" }}
      >
        {t("loginCardTitle")}
      </h1>
      <div className="mt-8">
        <AuthCredentialsForm variant="login" />
      </div>
      <p className="m-0 mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-zinc-600">
        {t("noAccount")}
        <Link
          href="/register/carrier"
          className="inline-flex items-center gap-1.5 font-semibold text-zinc-900 hover:underline"
        >
          {t("tryFreeLink")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </p>
    </AuthCardScreen>
  );
}
