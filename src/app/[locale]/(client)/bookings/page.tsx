import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Link } from "@/i18n/navigation";
import { formatRoute } from "@/lib/location";

export default async function ClientBookingsPage() {
  const [session, t] = await Promise.all([auth(), getTranslations("client")]);
  const bookings = await prisma.ride.findMany({
    where: { clientId: session!.user.id, status: { in: ["CONFIRMED", "COMPLETED"] } },
    include: { carrier: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">{t("myBookings")}</h1>

      {bookings.length === 0 ? (
        <p className="text-sm text-[var(--ink-secondary)]">{t("noBookings")}</p>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <Link key={booking.id} href={`/bookings/${booking.id}`}>
              <Card className="flex items-center justify-between transition-shadow hover:shadow-[var(--shadow-card)]">
                <div>
                  <p className="font-medium text-[var(--ink-primary)]">{formatRoute(booking)}</p>
                  <p className="text-sm text-[var(--ink-secondary)]">
                    {new Date(booking.departureAt).toLocaleString()} · {booking.carrier?.companyName}
                  </p>
                </div>
                <Badge tone="positive">{t(`requestStatus.${booking.status}`)}</Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
