import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { formatRoute } from "@/lib/location";
import { clientDisplayName } from "@/lib/clientDisplay";
import { PageHeader } from "@/components/carrier/PageHeader";
import { PageContent } from "@/components/carrier/PageContent";
import { StatusDot } from "@/components/carrier/StatusDot";
import { formatShortDate } from "@/lib/rideDateFormat";

export default async function CarrierRequestsPage() {
  const t = await getTranslations("carrier");
  const requests = await prisma.ride.findMany({
    where: { carrierId: null, status: "PENDING" },
    include: { client: { select: { name: true, companyName: true } } },
    orderBy: { departureAt: "asc" },
  });

  return (
    <PageContent>
      <PageHeader title={t("requestsTitle")} context={`${requests.length}`} />
      {requests.length === 0 ? (
        <p className="text-[14px] text-[var(--ink-secondary)]">{t("noIncomingRequests")}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-[var(--border-container)] bg-white">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {requests.map((req) => (
              <Link
                key={req.id}
                href={`/carrier/requests/${req.id}`}
                className="flex h-[68px] items-center justify-between gap-3 border-b border-[var(--border-hairline)] px-5 transition-colors duration-[.12s] ease-out last:border-b-0 hover:bg-[var(--bg-subtle)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-[var(--ink-primary)]">{formatRoute(req)}</p>
                  <p className="truncate text-[13px] text-[var(--ink-secondary)]">
                    {formatShortDate(new Date(req.departureAt))}
                    {" · "}
                    {req.passengerCount} pax · {clientDisplayName(req.client)}
                  </p>
                </div>
                <StatusDot color="var(--accent-pending)" label={req.status} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </PageContent>
  );
}
