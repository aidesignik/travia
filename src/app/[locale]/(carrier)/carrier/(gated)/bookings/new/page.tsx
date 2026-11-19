import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { CarrierRideForm } from "@/components/forms/CarrierRideForm";

export default async function NewCarrierRidePage() {
  const [session, t] = await Promise.all([auth(), getTranslations("carrier")]);
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session!.user.id } });

  const [vehicles, drivers] = await Promise.all([
    prisma.vehicle.findMany({ where: { carrierId: carrier.id, status: "ACTIVE" } }),
    prisma.driver.findMany({ where: { carrierId: carrier.id, isAvailable: true } }),
  ]);

  return (
    <div className="h-full space-y-6 overflow-y-auto bg-[var(--bg-canvas)] px-5 py-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{t("rideForm.title")}</h1>
        <p className="mt-1 text-sm text-[var(--ink-secondary)]">{t("rideForm.subtitle")}</p>
      </div>
      <Card>
        <CarrierRideForm
          vehicles={vehicles}
          drivers={drivers}
          carrierRates={{
            ratePerKm: carrier.ratePerKm ? Number(carrier.ratePerKm) : null,
            fixedFee: carrier.fixedFee ? Number(carrier.fixedFee) : null,
          }}
        />
      </Card>
    </div>
  );
}
