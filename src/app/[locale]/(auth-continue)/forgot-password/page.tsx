import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthSplitScreen } from "@/components/layout/AuthSplitScreen";
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("forgotPasswordTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");

  return (
    <AuthSplitScreen>
      <div className="flex w-full flex-col gap-10">
        <div>
          <h1
            className="m-0 text-balance text-[clamp(28px,3.8vw,42px)] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--ink-primary)]"
            style={{ fontFamily: "var(--font-sora)" }}
          >
            {t("forgotPasswordTitle")}
          </h1>
          <p className="m-0 mt-3 text-balance text-[16px] leading-[1.5] text-[var(--ink-secondary)]">
            {t("forgotPasswordSubtitle")}
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </AuthSplitScreen>
  );
}
