import { useId } from "react";

// The assistant's icon: lucide's "sparkles" outline, stroked with the
// cyan → blue gradient from the Travia logo's swoosh (public/travia-logo.svg)
// instead of a filled tile. Used for the sidebar "Assistant" item.
export function AssistantIcon({ size = 18, strokeWidth = 1.9, className }: { size?: number; strokeWidth?: number; className?: string }) {
  const id = useId();
  const stroke = `url(#${id})`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className ?? ""}`}
    >
      <defs>
        {/* userSpaceOnUse: the small strokes have zero-width bounding boxes,
            which a bounding-box gradient can't paint. */}
        <linearGradient id={id} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2BB4FF" />
          <stop offset="1" stopColor="#2F55FF" />
        </linearGradient>
      </defs>
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <path d="M20 2v4" />
      <path d="M22 4h-4" />
      <circle cx="4" cy="20" r="2" />
    </svg>
  );
}
