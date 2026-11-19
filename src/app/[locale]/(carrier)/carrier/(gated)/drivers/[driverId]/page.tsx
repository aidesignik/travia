import { notFound } from "next/navigation";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { DriverForm } from "@/components/forms/DriverForm";
import { DeleteButton } from "@/components/forms/DeleteButton";
import { DriverAvatar } from "@/components/ui/DriverAvatar";
import { isDriverColorKey } from "@/lib/driver-colors";

export default async function EditDriverPage({
  params,
}: {
  params: Promise<{ driverId: string }>;
}) {
  const { driverId } = await params;
  const session = await auth();
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session!.user.id } });
  const [driver, vehicles] = await Promise.all([
    prisma.driver.findFirst({
      where: { id: driverId, carrierId: carrier.id },
      include: { vehicles: true },
    }),
    prisma.vehicle.findMany({ where: { carrierId: carrier.id }, orderBy: { createdAt: "desc" } }),
  ]);

  if (!driver) notFound();

  return (
    <div className="h-full space-y-6 overflow-y-auto bg-[var(--bg-canvas)] px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DriverAvatar driver={driver} size={40} decorative />
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{driver.name}</h1>
        </div>
        <DeleteButton url={`/api/carrier/drivers/${driver.id}`} redirectTo="/carrier/drivers" />
      </div>
      <Card>
        <DriverForm
          driverId={driver.id}
          vehicles={vehicles}
          initial={{
            name: driver.name,
            phone: driver.phone,
            isAvailable: driver.isAvailable,
            licenseNumber: driver.licenseNumber ?? "",
            avatarColor: isDriverColorKey(driver.avatarColor) ? driver.avatarColor : undefined,
            vehicleIds: driver.vehicles.map((v) => v.vehicleId),
            idCardExpiry: driver.idCardExpiry,
            idCardFrontUrl: driver.idCardFrontUrl ?? "",
            idCardBackUrl: driver.idCardBackUrl ?? "",
            licenseExpiry: driver.licenseExpiry,
            licenseFrontUrl: driver.licenseFrontUrl ?? "",
            licenseBackUrl: driver.licenseBackUrl ?? "",
            cpcExpiry: driver.cpcExpiry,
            cpcFrontUrl: driver.cpcFrontUrl ?? "",
            cpcBackUrl: driver.cpcBackUrl ?? "",
            medicalCertExpiry: driver.medicalCertExpiry,
            medicalCertFrontUrl: driver.medicalCertFrontUrl ?? "",
            medicalCertBackUrl: driver.medicalCertBackUrl ?? "",
          }}
        />
      </Card>
    </div>
  );
}
