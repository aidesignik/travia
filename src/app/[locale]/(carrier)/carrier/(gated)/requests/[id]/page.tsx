import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { AssignRideForm } from "@/components/forms/AssignRideForm";
import { formatLocation } from "@/lib/location";
import { clientDisplayName } from "@/lib/clientDisplay";
import { formatShortDateTime } from "@/lib/rideDateFormat";

export default async function CarrierRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, t] = await Promise.all([auth(), getTranslations()]);
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session!.user.id } });

  const [ride, vehicles, drivers] = await Promise.all([
    prisma.ride.findUnique({
      where: { id },
      include: {
        client: { select: { name: true, companyName: true, phone: true, email: true } },
        stops: { where: { leg: "OUTBOUND" }, orderBy: { order: "asc" } },
      },
    }),
    prisma.vehicle.findMany({ where: { carrierId: carrier.id, status: "ACTIVE" } }),
    prisma.driver.findMany({ where: { carrierId: carrier.id, isAvailable: true } }),
  ]);

  if (!ride || (ride.carrierId && ride.carrierId !== carrier.id)) notFound();

  return (
    <div className="h-full space-y-6 overflow-y-auto bg-[var(--bg-canvas)] px-5 py-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">
          {formatLocation({ city: ride.pickupCity, location: ride.pickupLocation })}
        </h1>
        {ride.stops.length > 0 ? (
          <div className="mt-1 space-y-0.5">
            {ride.stops.map((stop) => (
              <p key={stop.id} className="text-sm text-[var(--ink-muted)]">
                ↓ {formatLocation(stop)}
              </p>
            ))}
          </div>
        ) : null}
        <p className="mt-1 text-lg font-semibold text-[var(--ink-primary)]">
          →{" "}
          {formatLocation({
            city: ride.destinationCity,
            location: ride.destinationLocation,
          })}
        </p>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">
          {formatShortDateTime(new Date(ride.departureAt))} · {ride.passengerCount} pax
        </p>
        {ride.isRoundTrip && ride.returnAt ? (
          <p className="text-sm font-medium text-[var(--status-pending-text)]">
            {t("client.requestForm.isRoundTrip")} — {t("client.requestForm.returnAt")}:{" "}
            {formatShortDateTime(new Date(ride.returnAt))}
          </p>
        ) : null}
        <p className="text-sm text-[var(--ink-secondary)]">
          {clientDisplayName(ride.client)}
          {ride.client.companyName ? ` (${ride.client.name ?? "—"})` : ""} · {ride.client.phone}
        </p>
        {ride.specialRequests ? (
          <p className="mt-2 text-sm text-[var(--ink-2)]">{ride.specialRequests}</p>
        ) : null}
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--ink-primary)]">{t("carrier.offerForm.title")}</h2>
        <AssignRideForm
          rideId={ride.id}
          vehicles={vehicles}
          drivers={drivers}
          carrierRates={{
            ratePerKm: carrier.ratePerKm ? Number(carrier.ratePerKm) : null,
            fixedFee: carrier.fixedFee ? Number(carrier.fixedFee) : null,
          }}
          initialDistanceKm={ride.estimatedDistanceKm}
        />
      </Card>
    </div>
  );
}
