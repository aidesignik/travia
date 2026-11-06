import type { ReactNode } from "react";
import { AuthPageChrome } from "@/components/layout/AuthPageChrome";

// Sign-up (/register/carrier) and the password screens. Its own route
// group (not nested under (auth), where /login lives) because a parent
// layout can't be told by a child route to change a header it already
// rendered: these pages swap the "Get started" CTA for a "Log in" button,
// since whoever is here may already have an account. Same shell otherwise.
export default function AuthContinueLayout({ children }: { children: ReactNode }) {
  return (
    <AuthPageChrome showCta={false} showLoginButton>
      {children}
    </AuthPageChrome>
  );
}
