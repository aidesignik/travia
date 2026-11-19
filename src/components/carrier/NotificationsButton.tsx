"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Popover } from "@/components/ui/Popover";

// Visual spec only for now — there's no notifications backend yet (no
// Notification model, no feed API), so `unreadCount` always comes in as 0
// from the server and the dot never renders in production. The prop/dot/
// panel are all wired so a real feed can drop in later without touching
// this component's shell.
export function NotificationsButton({ unreadCount = 0 }: { unreadCount?: number }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const hasUnread = unreadCount > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={hasUnread ? t("notificationsUnread", { count: unreadCount }) : t("notifications")}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-control bg-white text-[var(--topbar-icon)] transition-colors duration-[.12s] ease-out hover:bg-[var(--topbar-hover)] hover:text-[var(--ink)] ${
          open ? "bg-[var(--topbar-hover)] text-[var(--ink)]" : ""
        }`}
      >
        <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
        {hasUnread ? (
          <span
            className="absolute rounded-full"
            style={{
              top: 9,
              right: 10,
              width: 8,
              height: 8,
              background: "var(--notif-dot)",
              boxShadow: "0 0 0 2px white",
            }}
          />
        ) : null}
      </button>
      {open ? (
        <Popover onClose={() => setOpen(false)} align="end" width={320}>
          <p className="px-4 py-5 text-center text-[14px] text-[var(--ink-muted)]">{t("noNotifications")}</p>
        </Popover>
      ) : null}
    </div>
  );
}
