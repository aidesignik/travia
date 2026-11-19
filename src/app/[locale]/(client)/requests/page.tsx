import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { formatRoute } from "@/lib/location";

export default async function ClientRequestsPage() {
  const [session, t] = await Promise.all([auth(), getTranslations("client")]);
  const requests = await prisma.ride.findMany({
    where: { clientId: session!.user.id, status: { in: ["PENDING", "CANCELLED"] } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{t("myRequests")}</h1>

      {requests.length === 0 ? (
        <p className="text-sm text-[var(--ink-secondary)]">{t("noRequests")}</p>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Link key={req.id} href={`/requests/${req.id}`}>
              <Card className="flex items-center justify-between transition-shadow hover:shadow-[var(--shadow-card)]">
                <div>
                  <p className="font-medium text-[var(--ink-primary)]">{formatRoute(req)}</p>
                  <p className="text-sm text-[var(--ink-secondary)]">
                    {new Date(req.departureAt).toLocaleString()} ·{" "}
                    {req.vehicleId ? t("assigned") : t("awaitingAssignment")}
                  </p>
                </div>
                <Badge tone={req.status === "CANCELLED" ? "neutral" : "warning"}>
                  {t(`requestStatus.${req.status}`)}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
