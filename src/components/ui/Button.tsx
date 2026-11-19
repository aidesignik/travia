import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-[var(--action-bg)] text-white hover:bg-[var(--action-bg-hover)]",
  secondary:
    "bg-[var(--bg-panel)] text-[var(--ink-strong)] border border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]",
  danger: "bg-[var(--ink-destructive)] text-white hover:bg-[var(--ink-destructive-hover)]",
  ghost: "bg-transparent text-[var(--ink-2)] hover:bg-[var(--border-soft)]",
};

// The app's one button: 40px tall (the same height as the top bar's search
// field, so a page's header action lines up with it), control radius,
// semibold label. Page header actions ("New ride", "Add vehicle", …), panel
// footers and dialogs all use it.
export function buttonClassName(variant: Variant = "primary", className = "") {
  return `inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 text-[14px] font-semibold transition-[background-color,border-color,box-shadow] duration-[.12s] ease-out disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:border-[var(--action-bg)] focus-visible:shadow-[var(--focus-ring)] ${variantClasses[variant]} ${className}`;
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ className = "", variant = "primary", ...props }, ref) {
  return <button ref={ref} className={buttonClassName(variant, className)} {...props} />;
});
