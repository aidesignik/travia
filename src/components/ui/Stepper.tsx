"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

// Numeric stepper (§7 Broj putnika) — a thin presentational wrapper
// around a plain number value, same as any other controlled field. The
// count also doubles as a text field: typing a number directly is faster
// than clicking +/- dozens of times for a full coach.
export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  "aria-label"?: string;
}) {
  const t = useTranslations("common");
  const [text, setText] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  function clamp(n: number) {
    let next = n;
    if (next < min) next = min;
    if (max !== undefined && next > max) next = max;
    return next;
  }

  function step(delta: number) {
    const next = clamp(value + delta);
    if (next !== value) onChange(next);
  }

  function commitText(raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const next = Number.isFinite(parsed) ? clamp(parsed) : value;
    setText(String(next));
    if (next !== value) onChange(next);
  }

  return (
    <div className="flex h-10 w-[136px] items-stretch overflow-hidden rounded-control shadow-[inset_0_0_0_1px_var(--border-control)]">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={value <= min}
        aria-label={t("decrease")}
        className="flex w-10 shrink-0 items-center justify-center text-[var(--ink-2)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-soft)] disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Minus size={15} strokeWidth={2} aria-hidden="true" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={text}
        aria-label={ariaLabel}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={() => {
          focused.current = false;
          commitText(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="w-14 shrink-0 border-x border-[var(--border-soft)] bg-transparent text-center text-[14px] font-medium tabular-nums text-[var(--ink-primary)] focus:outline-none"
      />
      <button
        type="button"
        onClick={() => step(1)}
        disabled={max !== undefined && value >= max}
        aria-label={t("increase")}
        className="flex w-10 shrink-0 items-center justify-center text-[var(--ink-2)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-soft)] disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Plus size={15} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
