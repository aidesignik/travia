import type { ReactNode } from "react";
import { AuthBackgroundVideo } from "./AuthBackgroundVideo";
import { NewRideShowcase } from "./NewRideShowcase";

// Shared split-screen shell for the login/register pages: the form sits
// directly on the page background (no shared card/border), a looping
// "create a ride" showcase (same on both pages, since there's only one
// audience while the client marketplace is hidden) floats as its own
// square media panel to the right — a Calendly-style panel standing in
// for a screen recording, a looping abstract video behind the animated
// showcase card. Shares Navbar's 1024px/40px(20px) container so the two
// line up, and vertically centers the row in the remaining viewport
// height below the 60px header. Below ~900px the columns wrap: form
// first, square panel full-width underneath.
//
// The panel's size is width-driven, not height-driven: it fills its own
// column's width (capped at max-w-500) and goes square off of that
// (aspect-square, height auto) — so it stays a fixed size for a given
// viewport regardless of how tall the sibling content is. This matters
// because /login, /forgot-password and /reset-password all share this
// shell but render very different amounts of content; an earlier
// height-driven version (h-full off the row's stretched height) made the
// panel visibly shrink on the shorter pages.
export async function AuthSplitScreen({ children }: { children: ReactNode }) {
  return (
    // min-h here must stay in sync with the beige container's own min-h in
    // (auth)/layout.tsx (both subtract the 60px header plus that
    // container's bottom margin) — this is what centers the row within
    // the container's actual height; if this were taller than the
    // container's min-h, the container would grow to fit it and swallow
    // the container's own bottom margin.
    <main className="mx-auto flex min-h-[calc(100vh-76px)] max-w-[1024px] items-center px-5 py-11 md:min-h-[calc(100vh-84px)] md:px-10">
      <div className="flex w-full flex-wrap justify-between gap-12">
        <div className="min-w-0 flex-[1_1_300px] max-w-[380px]">{children}</div>

        <div className="flex min-w-0 flex-[1_1_340px] max-w-[500px] items-center justify-center">
          <div
            className="aspect-square w-full max-w-full rounded-[26px]"
            style={{ boxShadow: "0 16px 48px rgba(16,30,80,.18)" }}
          >
            {/* The shadow and the corner-clip live on separate elements —
                combining overflow-hidden + border-radius + box-shadow on one
                element leaves a faint seam right at the clip edge in
                Chromium. */}
            <div
              className="relative h-full w-full overflow-hidden rounded-[26px] bg-[#15317F]"
              style={{ transform: "translateZ(0)" }}
            >
              <AuthBackgroundVideo className="absolute inset-0 h-full w-full object-cover" />
              {/* A light scrim keeps the floating white card readable against
                  whatever the video's brightest moment happens to be. */}
              <div className="absolute inset-0 bg-[#0E2466]/20" />
              <NewRideShowcase className="relative h-full w-full" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
