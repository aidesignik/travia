"use client";

import { useEffect, useRef, useState } from "react";

type Step = {
  title: string;
  description: string;
  video: string;
  poster: string;
};

// "Admin? Handled." — a rail of three steps beside a 788×504 illustration
// panel. The active step's track fills as its video plays; when the video
// ends the next step takes over, and clicking a step jumps straight to it.
export function StepsSection({
  title,
  copy,
  steps,
}: {
  title: string;
  copy: string;
  steps: Step[];
}) {
  const [active, setActive] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Drive the progress track straight from the video's clock.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const video = videoRef.current;
      const track = trackRef.current;
      if (video && track && video.duration) {
        track.style.transform = `scaleX(${Math.min(1, video.currentTime / video.duration)})`;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  const step = steps[active];

  return (
    <section
      id="how-it-works"
      className="scroll-mt-6 px-[var(--layout-page-margin)] pb-20 pt-16 lg:pt-20"
    >
      <div className="mx-auto flex max-w-[1344px] flex-col items-center gap-4 text-center">
        <h2 className="lp-h2 max-w-[760px]">{title}</h2>
        <p className="lp-body-lg max-w-[820px] text-[var(--text-secondary)]">{copy}</p>
      </div>

      <div className="mx-auto mt-12 flex max-w-[1344px] flex-col gap-10 lg:mt-16 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div className="w-full lg:max-w-[460px]" role="tablist" aria-label={title}>
          {steps.map((s, i) => {
            const isActive = i === active;
            return (
              <div key={s.title}>
                {i > 0 && <div className="h-px bg-[var(--border-default)]" />}
                <button
                  type="button"
                  role="tab"
                  id={`lp-step-${i}`}
                  aria-selected={isActive}
                  aria-controls="lp-step-panel"
                  onClick={() => setActive(i)}
                  className={`lp-step block w-full cursor-pointer text-left ${
                    isActive ? (i === 0 ? "pb-7" : "pb-7 pt-6") : "py-6"
                  }`}
                >
                  <span
                    className={`lp-title block ${
                      isActive
                        ? "font-bold text-[var(--text-primary)]"
                        : "font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {s.title}
                  </span>
                  {isActive && (
                    <>
                      <span className="lp-body-lg mt-3 block text-[var(--text-secondary)]">
                        {s.description}
                      </span>
                      <span className="mt-3 block">
                        <span className="block h-[2px] overflow-hidden">
                          <span
                            ref={trackRef}
                            className="lp-step-progress block h-full w-full bg-[var(--surface-inverse)]"
                          />
                        </span>
                        <span className="block h-px bg-[var(--border-default)]" />
                      </span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div
          id="lp-step-panel"
          role="tabpanel"
          aria-labelledby={`lp-step-${active}`}
          className="relative aspect-[788/504] w-full overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-muted)] bg-[var(--surface-muted)] lg:max-w-[788px]"
        >
          <video
            key={step.video}
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            src={step.video}
            poster={step.poster}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={() => setActive((a) => (a + 1) % steps.length)}
            aria-label={step.title}
          />
        </div>
      </div>
    </section>
  );
}
