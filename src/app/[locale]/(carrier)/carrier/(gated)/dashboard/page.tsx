import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { RidesCalendar } from "@/components/calendar/RidesCalendar";
import { NewRideProvider } from "@/components/calendar/NewRideContext";
import { NewRideTriggerButton } from "@/components/calendar/NewRideTriggerButton";
import { PageHeader } from "@/components/carrier/PageHeader";
import { PageContent } from "@/components/carrier/PageContent";

export default async function CarrierDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const [{ locale }, session, t] = await Promise.all([
    params,
    auth(),
    getTranslations("carrier"),
  ]);
  // The (gated) layout already redirects to onboarding when the session has
  // no carrierId, but a freshly created session can reach this page before
  // that carrierId is reflected — fall back to the same redirect here
  // instead of crashing on a missing Carrier row.
  const carrier = await prisma.carrier.findUnique({ where: { userId: session!.user.id } });
  if (!carrier) {
    redirect(`/${locale}/carrier/onboarding`);
  }

  const [vehicleCount, driverCount] = await Promise.all([
    prisma.vehicle.count({ where: { carrierId: carrier.id } }),
    prisma.driver.count({ where: { carrierId: carrier.id } }),
  ]);

  const readyForCalendar = vehicleCount > 0 && driverCount > 0;

  return (
    <NewRideProvider>
      <PageContent compactBottom>
        <PageHeader title={t("calendarTitle")} actions={readyForCalendar ? <NewRideTriggerButton /> : undefined} />
        {readyForCalendar ? (
          <RidesCalendar />
        ) : (
          <Card className="space-y-4 text-center">
            <p className="text-sm text-[var(--ink-secondary)]">
              {vehicleCount === 0 && driverCount === 0
                ? t("setupBothPrompt")
                : vehicleCount === 0
                  ? t("setupVehiclePrompt")
                  : t("setupDriverPrompt")}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {vehicleCount === 0 ? (
                <Link href="/carrier/fleet?new=1">
                  <Button>{t("addVehicle")}</Button>
                </Link>
              ) : null}
              {driverCount === 0 ? (
                <Link href="/carrier/drivers?new=1">
                  <Button variant={vehicleCount === 0 ? "secondary" : "primary"}>{t("addDriver")}</Button>
                </Link>
              ) : null}
            </div>
          </Card>
        )}
      </PageContent>
    </NewRideProvider>
  );
}
