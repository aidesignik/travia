import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { CarrierSidebar } from "@/components/carrier/CarrierSidebar";
import { TopBar } from "@/components/carrier/TopBar";
import { vehicleExpiringItems, driverExpiringItems, sortExpiringItems, expiredDocMessageKey } from "@/lib/expiryStatus";

const DOC_LABEL_KEY = {
  registration: "carrier.docChip.registration",
  inspection: "carrier.docChip.inspection",
  idCard: "carrier.docChip.idCard",
  license: "carrier.docChip.license",
  cpc: "carrier.docChip.cpc",
  medicalCert: "carrier.docChip.medicalCert",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function CarrierGatedLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  const t = await getTranslations("carrierStatus");

  if (!session?.user.carrierId) {
    redirect(`/${locale}/carrier/onboarding`);
  }

  const status = session.user.carrierStatus;

  if (status && status !== "APPROVED") {
    return (
      <>
        <Navbar />
        <div className="mx-auto max-w-5xl px-4 py-10">
          <Card>
            <p className="font-medium text-zinc-900">{t(status)}</p>
            <p className="mt-2 text-sm text-zinc-600">{t("pendingNotice")}</p>
            <Link
              href="/carrier/onboarding"
              className="mt-4 inline-block text-sm font-medium underline"
            >
              {t("PENDING")}
            </Link>
          </Card>
        </div>
      </>
    );
  }

  const carrierId = session.user.carrierId;
  const tDoc = await getTranslations();
  const [requestCount, bookingCount, vehicles, drivers] = await Promise.all([
    prisma.ride.count({ where: { carrierId: null, status: "PENDING" } }),
    prisma.ride.count({ where: { carrierId } }),
    prisma.vehicle.findMany({
      where: { carrierId },
      select: {
        id: true,
        type: true,
        model: true,
        licensePlate: true,
        lastRegistrationDate: true,
        lastInspectionDate: true,
      },
    }),
    prisma.driver.findMany({
      where: { carrierId },
      select: { id: true, name: true, idCardExpiry: true, licenseExpiry: true, cpcExpiry: true, medicalCertExpiry: true },
    }),
  ]);

  const expiringItems = sortExpiringItems([
    ...vehicles.flatMap((vehicle) =>
      vehicleExpiringItems(
        vehicle,
        `${tDoc(`vehicleType.${vehicle.type}`)} ${vehicle.model}${vehicle.licensePlate ? ` · ${vehicle.licensePlate}` : ""}`,
      ),
    ),
    ...drivers.flatMap((driver) => driverExpiringItems(driver, driver.name)),
  ]);

  const now = new Date().getTime();
  const sidebarExpiringItems = expiringItems.map((item) => {
    const label = tDoc(DOC_LABEL_KEY[item.docKind]);
    const daysLeft = Math.max(0, Math.ceil((item.expiryDate.getTime() - now) / DAY_MS));
    return {
      id: `${item.entityType}-${item.entityId}-${item.docKind}`,
      href: item.entityType === "vehicle" ? `/carrier/fleet?edit=${item.entityId}` : `/carrier/drivers?edit=${item.entityId}`,
      subject: item.entityLabel,
      status: item.status,
      issue:
        item.status === "expired"
          ? tDoc(expiredDocMessageKey(item.docKind), { label })
          : tDoc("carrier.docChip.expiringSoon", { label, days: daysLeft }),
    };
  });

  return (
    <div className="app-scale surface-app grid h-dvh grid-cols-[252px_1fr] overflow-hidden">
      <CarrierSidebar
        requestCount={requestCount}
        bookingCount={bookingCount}
        fleetCount={vehicles.length}
        driverCount={drivers.length}
        expiringItems={sidebarExpiringItems}
      />
      <div className="flex h-dvh min-w-0 flex-col p-2">
        <div className="surface-shell flex h-full min-h-0 flex-col overflow-hidden rounded-[12px]">
          <TopBar />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}
