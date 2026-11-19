import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { VehicleForm } from "@/components/forms/VehicleForm";
import { DeleteButton } from "@/components/forms/DeleteButton";

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const [session, tType] = await Promise.all([auth(), getTranslations("vehicleType")]);
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session!.user.id } });
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, carrierId: carrier.id } });

  if (!vehicle) notFound();

  return (
    <div className="h-full space-y-6 overflow-y-auto bg-[var(--bg-canvas)] px-5 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">
          {tType(vehicle.type)} {vehicle.model}
        </h1>
        <DeleteButton url={`/api/carrier/vehicles/${vehicle.id}`} redirectTo="/carrier/fleet" />
      </div>
      <Card>
        <VehicleForm
          vehicleId={vehicle.id}
          initial={{
            type: vehicle.type,
            model: vehicle.model,
            licensePlate: vehicle.licensePlate,
            year: vehicle.year,
            seats: vehicle.seats,
            amenities: vehicle.amenities,
            otherAmenities: vehicle.otherAmenities,
            status: vehicle.status,
            photos: vehicle.photos,
            lastRegistrationDate: vehicle.lastRegistrationDate,
            lastInspectionDate: vehicle.lastInspectionDate,
            documentUrls: vehicle.documentUrls,
          }}
        />
      </Card>
    </div>
  );
}
