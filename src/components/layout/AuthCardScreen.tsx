import type { ReactNode } from "react";
import { AuthBackgroundVideo } from "./AuthBackgroundVideo";

// Login and sign-up: one white card centered on the looping blue
// background video, which fills AuthPageChrome's inset container. The
// min-h and 24px radius match that container exactly (see its comment),
// so the video covers it edge to edge. `wide` is the two-column sign-up
// card; the default is the narrow login card.
export function AuthCardScreen({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="relative isolate flex min-h-[calc(100vh-76px)] items-center justify-center overflow-hidden rounded-window px-4 py-10 md:min-h-[calc(100vh-84px)] md:px-6 md:py-14">
      <AuthBackgroundVideo className="absolute inset-0 -z-10 h-full w-full object-cover" />
      {/* A light scrim keeps the card's edge crisp against the video's
          palest moments. */}
      <div className="absolute inset-0 -z-10 bg-[var(--auth-deep)]/10" />
      <div
        className={`w-full rounded-window bg-white px-6 py-8 sm:px-12 sm:py-12 ${wide ? "max-w-[980px]" : "max-w-[560px]"}`}
        style={{ boxShadow: "var(--shadow-auth-card)" }}
      >
        {children}
      </div>
    </main>
  );
}
