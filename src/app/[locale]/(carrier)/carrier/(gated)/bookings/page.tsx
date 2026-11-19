import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/carrier/PageHeader";
import { PageContent } from "@/components/carrier/PageContent";
import { AddRideButton } from "@/components/forms/AddRideButton";
import { BookingsListSection } from "@/components/carrier/BookingsListSection";
import { STOPS_INCLUDE, splitLegs } from "@/lib/rideStopsShape";
import type { CalendarRide } from "@/components/calendar/types";

type Scope = "upcoming" | "past" | "all";
type SearchParams = Record<string, string | string[] | undefined>;

export default async function CarrierBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [session, t, params] = await Promise.all([auth(), getTranslations("carrier"), searchParams]);
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session!.user.id } });
  const [allBookings, vehicles, drivers] = await Promise.all([
    prisma.ride.findMany({
      where: { carrierId: carrier.id },
      include: { client: { select: { name: true, companyName: true, phone: true, email: true } }, stops: STOPS_INCLUDE },
      orderBy: { departureAt: "desc" },
    }),
    prisma.vehicle.findMany({ where: { carrierId: carrier.id } }),
    prisma.driver.findMany({ where: { carrierId: carrier.id } }),
  ]);

  const now = new Date();
  // allBookings is already departureAt desc (the base query's orderBy),
  // which is exactly what Prošle/Sve want — only Predstojeće needs the
  // opposite (soonest first), so it gets its own ascending sort instead of
  // inheriting the shared order.
  const upcoming = allBookings
    .filter((b) => b.departureAt >= now && b.status !== "CANCELLED")
    .sort((a, b) => a.departureAt.getTime() - b.departureAt.getTime());
  const past = allBookings.filter((b) => b.departureAt < now || b.status === "CANCELLED");

  const scopeParam = Array.isArray(params.scope) ? params.scope[0] : params.scope;
  const scope: Scope = scopeParam === "past" || scopeParam === "all" ? scopeParam : "upcoming";
  const bookings = scope === "upcoming" ? upcoming : scope === "past" ? past : allBookings;

  const tabs: { key: Scope; label: string; count: number }[] = [
    { key: "upcoming", label: t("bookingsTable.upcoming"), count: upcoming.length },
    { key: "past", label: t("bookingsTable.past"), count: past.length },
    { key: "all", label: t("bookingsTable.all"), count: allBookings.length },
  ];

  return (
    <PageContent>
      <PageHeader title={t("bookingsTitle")} actions={<AddRideButton />} />

      <div className="flex shrink-0 items-center gap-5">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "upcoming" ? "/carrier/bookings" : `/carrier/bookings?scope=${tab.key}`}
            className={`flex items-center gap-[6px] border-b-2 pb-[10px] text-[14px] font-medium transition-colors duration-[.12s] ease-out ${
              scope === tab.key
                ? "border-[var(--ink-primary)] text-[var(--ink-primary)]"
                : "border-transparent text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
            }`}
          >
            {tab.label}
            <span className="text-[13px] text-[var(--ink-muted)]">{tab.count}</span>
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <p className="text-[13.5px] text-[var(--ink-secondary)]">{t("noBookings")}</p>
      ) : (
        <BookingsListSection
          bookings={bookings.map(splitLegs).map(
            (b): CalendarRide => ({
              ...b,
              departureAt: b.departureAt.toISOString(),
              returnAt: b.returnAt ? b.returnAt.toISOString() : null,
              price: b.price !== null ? b.price.toString() : null,
            }),
          )}
          vehicles={vehicles}
          drivers={drivers}
          initialSelectedId={typeof params.edit === "string" ? params.edit : null}
        />
      )}
    </PageContent>
  );
}
