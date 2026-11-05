import { getTranslations } from "next-intl/server";
import { auth } from "@/auth/auth";
import { Link } from "@/i18n/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PublicSearchForm } from "@/components/forms/PublicSearchForm";
import { AvailableOptionCard } from "@/components/forms/AvailableOptionCard";
import { findAvailableOptions } from "@/lib/matching";
import { estimateRouteDistance } from "@/lib/tripDistance";
import { readTripSearchState, tripStateToQueryString } from "@/lib/tripQueryParams";
import { MARKETPLACE_ENABLED } from "@/config/features";
import { LandingPage } from "@/components/landing/LandingPage";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // With the marketplace switched off, the root is the operator landing
  // page (src/proxy.ts sends signed-in users to their workspace instead).
  if (!MARKETPLACE_ENABLED) return <LandingPage />;

  const [t, tHome, session, params] = await Promise.all([
    getTranslations(),
    getTranslations("home"),
    auth(),
    searchParams,
  ]);

  const trip = readTripSearchState(params);
  const defaults = trip ?? {
    pickupCity: "",
    pickupLocation: "",
    destinationCity: "",
    destinationLocation: "",
    stops: [],
    departureAt: "",
    isRoundTrip: false,
    returnAt: "",
    passengerCount: "40",
  };

  let results: Awaited<ReturnType<typeof findAvailableOptions>> = [];
  if (trip) {
    const departureAt = new Date(trip.departureAt);
    const returnAt = trip.isRoundTrip && trip.returnAt ? new Date(trip.returnAt) : null;

    // Distance is never shown to the client — computed here purely to drive
    // the price estimate below.
    const estimate = await estimateRouteDistance([
      { city: trip.pickupCity, location: trip.pickupLocation },
      ...trip.stops,
      { city: trip.destinationCity, location: trip.destinationLocation },
    ]).catch(() => null);

    results = await findAvailableOptions({
      passengerCount: Number(trip.passengerCount),
      departureAt,
      returnAt,
      estimatedDistanceKm: estimate?.distanceKm ?? null,
    });
  }

  const carryQueryString = trip ? tripStateToQueryString(trip) : "";
  const bookHref =
    session?.user.role === "CLIENT"
      ? `/requests/new?${carryQueryString}`
      : `/register?${carryQueryString}`;
  const canShowBookCta = !session?.user || session.user.role === "CLIENT";

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-3xl space-y-10 px-4 py-16">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          {tHome("title")}
        </h1>
        <p className="mx-auto max-w-xl text-lg text-zinc-600">{tHome("subtitle")}</p>
      </div>

      <Card>
        <PublicSearchForm key={carryQueryString || "empty"} defaults={defaults} />
      </Card>

      {trip ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium text-zinc-900">{t("client.availableOptions.title")}</h2>
            <p className="text-sm text-zinc-600">{t("client.availableOptions.disclaimer")}</p>
          </div>

          {results.length === 0 ? (
            <p className="text-sm text-zinc-600">{t("client.availableOptions.none")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {results.map((option) => (
                <AvailableOptionCard
                  key={option.vehicleId}
                  option={option}
                  bookHref={bookHref}
                  bookLabel={tHome("requestToBook")}
                  canBook={canShowBookCta}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="space-y-3 border-t border-zinc-200 pt-8 text-center">
        <p className="text-sm text-zinc-600">{tHome("carrierPrompt")}</p>
        <Link href="/register/carrier">
          <Button variant="secondary">{tHome("ctaCarrier")}</Button>
        </Link>
      </div>
      </main>
    </>
  );
}
