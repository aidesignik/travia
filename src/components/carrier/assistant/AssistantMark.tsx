import { useId } from "react";

// The assistant's mark: a sparkle filled with the blue→violet gradient used
// across the assistant surfaces (sidebar item, chat header, message labels).
export function AssistantMark({ size = 16, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={`shrink-0 ${className ?? ""}`}>
      <defs>
        <linearGradient id={id} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563EB" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M10.4 3.6c.2-.8 1.4-.8 1.6 0l.9 3.5a4 4 0 0 0 2.9 2.9l3.5.9c.8.2.8 1.4 0 1.6l-3.5.9a4 4 0 0 0-2.9 2.9l-.9 3.5c-.2.8-1.4.8-1.6 0l-.9-3.5a4 4 0 0 0-2.9-2.9l-3.5-.9c-.8-.2-.8-1.4 0-1.6l3.5-.9a4 4 0 0 0 2.9-2.9l.9-3.5Z"
      />
      <path
        fill={`url(#${id})`}
        d="M18.6 2.3c.1-.4.7-.4.8 0l.3 1.1c.1.4.4.7.8.8l1.1.3c.4.1.4.7 0 .8l-1.1.3c-.4.1-.7.4-.8.8l-.3 1.1c-.1.4-.7.4-.8 0l-.3-1.1a1.1 1.1 0 0 0-.8-.8l-1.1-.3c-.4-.1-.4-.7 0-.8l1.1-.3c.4-.1.7-.4.8-.8l.3-1.1Z"
      />
    </svg>
  );
}
