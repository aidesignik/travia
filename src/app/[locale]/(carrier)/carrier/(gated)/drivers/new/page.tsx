import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { DriverForm } from "@/components/forms/DriverForm";

export default async function NewDriverPage() {
  const [session, t] = await Promise.all([auth(), getTranslations("carrier")]);
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session!.user.id } });
  const vehicles = await prisma.vehicle.findMany({ where: { carrierId: carrier.id }, orderBy: { createdAt: "desc" } });

  return (
    <div className="h-full space-y-6 overflow-y-auto bg-[var(--bg-canvas)] px-5 py-4">
      <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{t("addDriver")}</h1>
      <Card>
        <DriverForm vehicles={vehicles} />
      </Card>
    </div>
  );
}
