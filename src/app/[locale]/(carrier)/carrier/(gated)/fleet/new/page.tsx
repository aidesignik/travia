import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { VehicleForm } from "@/components/forms/VehicleForm";

export default async function NewVehiclePage() {
  const t = await getTranslations("carrier");

  return (
    <div className="h-full space-y-6 overflow-y-auto bg-[var(--bg-canvas)] px-5 py-4">
      <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{t("addVehicle")}</h1>
      <Card>
        <VehicleForm />
      </Card>
    </div>
  );
}
