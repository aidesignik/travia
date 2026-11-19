import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { DocumentDownloads } from "@/components/forms/DocumentDownloads";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { formatRoute } from "@/lib/location";
import { clientDisplayName } from "@/lib/clientDisplay";
import { formatShortDateTime } from "@/lib/rideDateFormat";

export default async function CarrierBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, t] = await Promise.all([auth(), getTranslations()]);
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session!.user.id } });

  const booking = await prisma.ride.findFirst({
    where: { id, carrierId: carrier.id },
    include: {
      client: { select: { name: true, companyName: true, phone: true, email: true } },
      vehicle: true,
      driver: true,
      documents: true,
    },
  });
  if (!booking) notFound();

  return (
    <div className="h-full space-y-6 overflow-y-auto bg-[var(--bg-canvas)] px-5 py-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{formatRoute(booking)}</h1>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">
          {formatShortDateTime(new Date(booking.departureAt))} · {booking.passengerCount} pax
        </p>
      </div>

      <Card className="space-y-2">
        <p className="text-sm font-medium text-[var(--ink-primary)]">
          {clientDisplayName(booking.client)}
          {booking.client.companyName ? ` (${booking.client.name ?? "—"})` : ""}
        </p>
        <p className="text-sm text-[var(--ink-secondary)]">{t("common.email")}: {booking.client.email}</p>
        <p className="text-sm text-[var(--ink-secondary)]">{t("common.phone")}: {booking.client.phone}</p>
        <p className="text-sm text-[var(--ink-secondary)]">
          {booking.vehicle ? `${t(`vehicleType.${booking.vehicle.type}`)} ${booking.vehicle.model}` : t("carrier.assignment.noVehicleAssigned")}
        </p>
        <div className="flex items-center gap-2">
          <DriverAvatar driver={booking.driver} size={32} decorative={Boolean(booking.driver)} />
          <p className="text-sm text-[var(--ink-secondary)]">
            {booking.driver ? booking.driver.name : t("carrier.assignment.noDriverAssigned")}
          </p>
        </div>
        <p className="text-lg font-semibold text-[var(--ink-primary)]">
          {Number(booking.price ?? 0).toLocaleString()} {booking.currency}
        </p>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--ink-primary)]">{t("documents.title")}</h2>
        <DocumentDownloads bookingId={booking.id} initialDocuments={booking.documents} clientEmail={booking.client.email} />
      </Card>
    </div>
  );
}
