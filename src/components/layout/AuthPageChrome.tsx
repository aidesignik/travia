import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";

// Shared shell for every auth page (login, sign-up, password reset) — the
// 60px header plus the inset beige content container. Pulled out of
// layout.tsx so a route group that needs a different header (sign-up
// swaps "Get started" for "Log in" — see (auth-continue)/layout.tsx) can
// still reuse the exact same shell instead of duplicating it.
export function AuthPageChrome({
  children,
  showCta = true,
  showLoginButton = false,
}: {
  children: ReactNode;
  showCta?: boolean;
  showLoginButton?: boolean;
}) {
  return (
    <div className="min-h-screen bg-white">
      <Navbar
        containerClassName="flex h-[60px] w-full items-center justify-between px-5 md:px-10"
        hideLoginLink
        showDivider={false}
        showMarketingCta
        showCta={showCta}
        showLoginButton={showLoginButton}
      />
      {/* Bottom margin matches the side margins (mx-4/mx-6) so the beige
          container is inset on all three edges, not just flush to the
          viewport bottom — min-h is reduced by that same amount and must
          stay in sync with AuthSplitScreen's own min-h (see its comment). */}
      <div className="mx-4 mb-4 min-h-[calc(100vh-76px)] rounded-[24px] bg-[#F3F1EA] md:mx-6 md:mb-6 md:min-h-[calc(100vh-84px)]">
        {children}
      </div>
    </div>
  );
}
