import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth/auth";
import { routing } from "@/i18n/routing";
import { MARKETPLACE_ENABLED } from "@/config/features";

const intlMiddleware = createMiddleware(routing);

const PROTECTED_SEGMENTS = ["dashboard", "requests", "bookings", "carrier", "admin"];
const CLIENT_ONLY_SEGMENTS = ["dashboard", "requests", "bookings"];

function pathInfo(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const hasLocale = routing.locales.includes(segments[0] as never);
  return {
    locale: hasLocale ? segments[0] : routing.defaultLocale,
    withoutLocale: hasLocale ? segments.slice(1) : segments,
  };
}

function isProtectedPath(withoutLocale: string[]) {
  return PROTECTED_SEGMENTS.includes(withoutLocale[0]);
}

// The public marketplace: the landing/search page, client registration, and
// the client dashboard/requests/bookings. Carrier and admin routes (and
// carrier signup at /register/carrier) are never part of this.
function isMarketplacePath(withoutLocale: string[]) {
  if (withoutLocale.length === 0) return true;
  const [first, second] = withoutLocale;
  if (CLIENT_ONLY_SEGMENTS.includes(first)) return true;
  if (first === "register" && second !== "carrier") return true;
  return false;
}

export default async function middleware(request: NextRequest) {
  const { locale, withoutLocale } = pathInfo(request.nextUrl.pathname);

  if (!MARKETPLACE_ENABLED && isMarketplacePath(withoutLocale)) {
    const session = await auth();
    // While the marketplace is off, the root shows the marketing landing
    // page to signed-out visitors; signed-in users still go straight to
    // their workspace.
    if (withoutLocale.length === 0 && !session?.user) {
      return intlMiddleware(request);
    }
    const fallbackPath =
      session?.user.role === "ADMIN"
        ? "/admin/carriers"
        : session?.user.role === "CARRIER"
          ? "/carrier/dashboard"
          : "/login";
    return NextResponse.redirect(new URL(`/${locale}${fallbackPath}`, request.url));
  }

  if (isProtectedPath(withoutLocale)) {
    const session = await auth();
    if (!session?.user) {
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("from", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
