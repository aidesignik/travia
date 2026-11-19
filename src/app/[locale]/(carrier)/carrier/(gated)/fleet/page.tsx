import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { AddVehicleButton } from "@/components/forms/AddVehicleButton";
import { FleetListSection } from "@/components/carrier/FleetListSection";
import { PageHeader } from "@/components/carrier/PageHeader";
import { PageContent } from "@/components/carrier/PageContent";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [session, t, params] = await Promise.all([auth(), getTranslations(), searchParams]);
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session!.user.id } });
  const vehicles = await prisma.vehicle.findMany({
    where: { carrierId: carrier.id },
    include: { drivers: { include: { driver: { select: { id: true, name: true, avatarColor: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PageContent>
      <PageHeader
        title={t("carrier.fleetTitle")}
        actions={<AddVehicleButton autoOpen={params.new === "1"} />}
      />
      {vehicles.length === 0 ? (
        <p className="text-[14px] text-[var(--ink-secondary)]">{t("carrier.noVehicles")}</p>
      ) : (
        <FleetListSection
          vehicles={vehicles.map((vehicle) => ({
            ...vehicle,
            drivers: vehicle.drivers.map((dv) => dv.driver),
          }))}
          initialEditingId={typeof params.edit === "string" ? params.edit : null}
        />
      )}
    </PageContent>
  );
}
