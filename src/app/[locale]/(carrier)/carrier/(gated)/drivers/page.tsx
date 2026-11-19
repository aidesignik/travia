import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { AddDriverButton } from "@/components/forms/AddDriverButton";
import { DriversListSection } from "@/components/carrier/DriversListSection";
import { PageHeader } from "@/components/carrier/PageHeader";
import { PageContent } from "@/components/carrier/PageContent";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [session, t, params] = await Promise.all([auth(), getTranslations(), searchParams]);
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session!.user.id } });
  const [drivers, vehicles] = await Promise.all([
    prisma.driver.findMany({
      where: { carrierId: carrier.id },
      include: {
        vehicles: {
          include: { vehicle: { select: { id: true, type: true, model: true, licensePlate: true, photos: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vehicle.findMany({ where: { carrierId: carrier.id }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <PageContent>
      <PageHeader
        title={t("carrier.driversTitle")}
        actions={<AddDriverButton vehicles={vehicles} autoOpen={params.new === "1"} />}
      />
      {drivers.length === 0 ? (
        <p className="text-[14px] text-[var(--ink-secondary)]">{t("carrier.noDrivers")}</p>
      ) : (
        <DriversListSection
          drivers={drivers.map((driver) => ({
            ...driver,
            vehicles: driver.vehicles.map((dv) => dv.vehicle),
          }))}
          vehicles={vehicles}
          initialEditingId={typeof params.edit === "string" ? params.edit : null}
        />
      )}
    </PageContent>
  );
}
