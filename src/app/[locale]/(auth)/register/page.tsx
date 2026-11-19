import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { RegisterClientForm } from "@/components/forms/RegisterClientForm";
import { Link } from "@/i18n/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [t, params] = await Promise.all([getTranslations("auth"), searchParams]);

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  const loginHref = query.toString() ? `/login?${query.toString()}` : "/login";

  return (
    <main className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{t("registerTitle")}</h1>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">{t("registerSubtitle")}</p>
      </div>
      <Card>
        <RegisterClientForm />
      </Card>
      <p className="text-center text-sm text-[var(--ink-secondary)]">
        {t("haveAccount")}{" "}
        <Link href={loginHref} className="font-medium text-[var(--ink-primary)] underline">
          {t("loginTitle")}
        </Link>
      </p>
      <p className="text-center text-sm text-[var(--ink-secondary)]">
        <Link href="/register/carrier" className="underline">
          {t("asCarrier")}
        </Link>
      </p>
    </main>
  );
}
