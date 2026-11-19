import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";

export default async function ClientDashboardPage() {
  const [session, t, tNav] = await Promise.all([
    auth(),
    getTranslations("client"),
    getTranslations("nav"),
  ]);

  const [requestCount, bookingCount] = await Promise.all([
    prisma.ride.count({ where: { clientId: session!.user.id, status: "PENDING" } }),
    prisma.ride.count({ where: { clientId: session!.user.id, status: { in: ["CONFIRMED", "COMPLETED"] } } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{t("dashboardTitle")}</h1>
        <Link href="/requests/new">
          <Button>{t("newRequest")}</Button>
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/requests">
          <Card className="transition-shadow hover:shadow-[var(--shadow-card)]">
            <p className="text-sm text-[var(--ink-secondary)]">{tNav("requests")}</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--ink-primary)]">{requestCount}</p>
          </Card>
        </Link>
        <Link href="/bookings">
          <Card className="transition-shadow hover:shadow-[var(--shadow-card)]">
            <p className="text-sm text-[var(--ink-secondary)]">{tNav("bookings")}</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--ink-primary)]">{bookingCount}</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
