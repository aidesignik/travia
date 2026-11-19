import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Plus_Jakarta_Sans, IBM_Plex_Mono, Sora } from "next/font/google";
import { routing } from "@/i18n/routing";
import { AuthProvider } from "@/components/layout/AuthProvider";
import "../globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-data",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
});

// Only used for the sign-in page's headline — everything else stays on
// Plus Jakarta Sans.
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin", "latin-ext"],
  weight: ["600"],
});

export const metadata: Metadata = {
  title: "Travia — digital dispatcher for coach transport",
  description: "Organize bus and coach transport bookings end to end.",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html
      lang={locale}
      className={`${plusJakartaSans.variable} ${ibmPlexMono.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg-subtle)]">
        <NextIntlClientProvider>
          <AuthProvider>
            <div className="flex-1">{children}</div>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
