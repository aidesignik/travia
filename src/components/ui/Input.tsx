import { InputHTMLAttributes, forwardRef } from "react";

const DEFAULT_CLASS =
  "h-[42px] w-full rounded-control border border-[var(--border-hairline)] bg-[var(--bg-panel)] px-3 text-[14px] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] transition-[border-color,box-shadow] duration-[.12s] ease-out focus:outline-none focus:border-[var(--action-bg)] focus:shadow-[var(--focus-ring)]";

// `unstyled` skips the default look entirely so a caller with a different
// field spec to follow (e.g. a redesigned sheet) can supply its own classes
// via `className` without fighting the defaults — conflicting Tailwind
// utilities (two different `h-*`, say) don't reliably override by
// concatenation alone. Existing callers are unaffected: default is false.
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { unstyled?: boolean }
>(function Input({ className = "", unstyled = false, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`${unstyled ? "" : DEFAULT_CLASS} ${className}`}
      {...props}
    />
  );
});
