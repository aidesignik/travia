import { getTranslations } from "next-intl/server";
import { Bus, Check, FileText, Mail } from "lucide-react";
import { RingMarker, PinMarker, DotConnector } from "@/components/calendar/newRide/timelineMarkers";

const DOC_ROWS = [
  { labelKey: "showcaseDocContract", reveal: "showcase-doc-1" },
  { labelKey: "showcaseDocInvoice", reveal: "showcase-doc-2" },
  { labelKey: "showcaseDocConfirmation", reveal: "showcase-doc-3" },
] as const;

// Floats over the login/register marketing panel's background video: a
// looping, purely decorative mock of booking a ride, told as two scenes
// that crossfade inside the same square card (the card shell itself
// never animates, so it never visibly disappears):
//   Scene A ("compose") — route and price filling the whole card, ending
//     in a "Confirm ride" button that visibly presses to simulate a
//     click once the price has settled.
//   Scene B ("result") — generated documents appearing one by one, then
//     emailed to the client.
// Timing is driven by the shared `showcase-*` keyframes in globals.css.
// Sized relative to its parent (66% width, aspect-square) rather than a
// fixed pixel size, so it stays proportional as the outer square resizes.
export async function NewRideShowcase({ className = "" }: { className?: string }) {
  const t = await getTranslations("auth");

  return (
    <div aria-hidden="true" className={`pointer-events-none ${className}`}>
      <div className="flex h-full w-full items-center justify-center">
        {/* Frame: a semi-transparent rim between the video and the white
            card, sized to 75% of the outer square so it reads as a
            smaller square nested inside a bigger one. */}
        <div
          className="showcase-anim-scope aspect-square w-[75%] rounded-window p-[5px]"
          style={{ background: "rgba(255,255,255,0.35)" }}
        >
          <div
            className="relative flex h-full w-full flex-col overflow-hidden rounded-window bg-white p-[22px]"
            style={{ boxShadow: "var(--shadow-auth-card)" }}
          >
          <div className="flex items-center gap-[8px]">
            <span className="flex h-7 w-7 items-center justify-center rounded-control" style={{ background: "var(--select-tint)" }}>
              <Bus size={15} strokeWidth={2} color="var(--action-bg)" />
            </span>
            <span className="text-[14px] font-semibold text-[var(--ink-primary)]">{t("showcaseTitle")}</span>
          </div>

          <div className="relative mt-6 min-h-0 flex-1">
            {/* Scene A — compose: route + price, ending in a "Confirm ride" button. */}
            <div
              className="absolute inset-0 flex flex-col"
              style={{ animation: "showcase-scene-a 12s ease-in-out infinite" }}
            >
              {/* ml-[6px]: centers the marker column (16px wide) under the
                  28px bus-icon badge above — (28-16)/2 = 6px — without
                  moving the badge itself. */}
              <div className="ml-[6px] flex flex-col gap-[6px]">
                <div className="flex items-center gap-[10px]">
                  <div className="flex h-5 w-4 shrink-0 items-center justify-center">
                    <RingMarker />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-medium leading-5 text-[var(--ink-primary)]">
                      {t("showcasePickupCity")}
                    </p>
                    <span className="shrink-0 text-[12px] tabular-nums text-[var(--ink-secondary)]">
                      {t("showcasePickupTime")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-[10px]">
                  <div className="flex w-4 shrink-0 items-center justify-center">
                    <DotConnector />
                  </div>
                </div>
                <div className="flex items-center gap-[10px]">
                  <div className="flex h-5 w-4 shrink-0 items-center justify-center">
                    <PinMarker />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-medium leading-5 text-[var(--ink-primary)]">
                      {t("showcaseDestinationCity")}
                    </p>
                    <span className="shrink-0 text-[12px] tabular-nums text-[var(--ink-muted)]">
                      {t("showcaseDestinationTime")}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className="mt-3"
                style={{ animation: "showcase-price-row 12s ease-in-out infinite" }}
              >
                <div className="mb-2 h-px bg-[var(--border-hairline)]" />
                <p className="text-[12px] text-[var(--ink-muted)]">{t("showcasePriceLabel")}</p>
                <div className="relative mt-[2px] h-[26px]">
                  <span
                    className="absolute inset-0 flex items-center text-[13px] text-[var(--ink-muted)]"
                    style={{ animation: "showcase-price-placeholder 12s ease-in-out infinite" }}
                  >
                    {t("showcasePriceCalculating")}
                  </span>
                  <span
                    className="absolute inset-0 -mx-1 flex items-center rounded-chip px-1 text-[20px] font-semibold text-[var(--ink-primary)]"
                    style={{ animation: "showcase-price-value 12s ease-in-out infinite" }}
                  >
                    {t("showcasePriceValue")}
                  </span>
                </div>
              </div>

              <div
                className="mt-auto flex h-[36px] items-center justify-center gap-[6px] rounded-control text-[14px] font-semibold text-white"
                style={{ animation: "showcase-button-press 12s ease-in-out infinite", background: "var(--action-bg)" }}
              >
                <Check size={15} strokeWidth={2.5} />
                {t("showcaseConfirmButton")}
              </div>
            </div>

            {/* Scene B — result: generated documents, then emailed to the client. */}
            <div
              className="absolute inset-0 flex flex-col"
              style={{ animation: "showcase-scene-b 12s ease-in-out infinite" }}
            >
              <p className="truncate text-[13px] text-[var(--ink-secondary)]">
                {t("showcasePickupCity")} → {t("showcaseDestinationCity")}
                <span className="text-[var(--ink-muted)]"> · {t("showcasePriceValue")}</span>
              </p>

              <div className="my-2 h-px bg-[var(--border-hairline)]" />

              <div style={{ animation: "showcase-docs-row 12s ease-in-out infinite" }}>
                <p className="text-[12px] text-[var(--ink-muted)]">{t("showcaseDocsLabel")}</p>
                <div className="mt-[6px] flex flex-col gap-[6px]">
                  {DOC_ROWS.map(({ labelKey, reveal }) => (
                    <div
                      key={labelKey}
                      className="flex items-center gap-[8px]"
                      style={{ animation: `${reveal} 12s ease-in-out infinite` }}
                    >
                      <FileText size={14} strokeWidth={1.9} color="var(--accent-completed)" className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-primary)]">
                        {t(labelKey)}
                      </span>
                      <Check size={13} strokeWidth={2.5} color="var(--accent-completed)" className="shrink-0" />
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="relative mt-auto h-[34px]"
                style={{ animation: "showcase-email-row 12s ease-in-out infinite" }}
              >
                <div
                  className="absolute inset-0 flex items-center justify-center gap-[6px] rounded-control text-[14px] font-semibold text-white"
                  style={{ animation: "showcase-button-default 12s ease-in-out infinite", background: "var(--action-bg)" }}
                >
                  <Mail size={14} strokeWidth={2} />
                  {t("showcaseEmailButton")}
                </div>
                <div
                  className="absolute inset-0 flex items-center justify-center gap-[6px] rounded-control text-[14px] font-semibold text-white"
                  style={{ animation: "showcase-button-success 12s ease-in-out infinite", background: "var(--accent-completed)" }}
                >
                  <Check size={15} strokeWidth={2.5} />
                  {t("showcaseEmailSent")}
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
