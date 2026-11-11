"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Bus, CircleHelp } from "lucide-react";
import {
  CalendarIcon as CalendarOutline,
  InboxIcon as InboxOutline,
  BookmarkIcon as BookmarkOutline,
  UserIcon as UserOutline,
  DocumentTextIcon as NotesOutline,
} from "@heroicons/react/24/outline";
import {
  CalendarIcon as CalendarSolid,
  InboxIcon as InboxSolid,
  BookmarkIcon as BookmarkSolid,
  UserIcon as UserSolid,
  DocumentTextIcon as NotesSolid,
} from "@heroicons/react/24/solid";
import { Link, usePathname } from "@/i18n/navigation";
import { AssistantIcon } from "@/components/carrier/assistant/AssistantIcon";
import { toggleAssistant, useAssistantOpen } from "@/components/carrier/assistant/assistantDock";

const ICON_SIZE_CLASS = "h-[17px] w-[17px] shrink-0";
const INACTIVE_COLOR = "#6E6E76";
const ACTIVE_COLOR = "#0D0D0D";

// Each item renders its own icon so inactive/active can come from two
// genuinely different glyphs (Heroicons ships matched outline/solid pairs)
// rather than faking "filled" by tinting the same outline shape. Heroicons
// has no bus icon though (only a generic truck), which would misrepresent
// a bus/coach fleet — so Fleet alone keeps lucide's Bus icon for both
// states, with the active state approximated via a tinted fill.
interface NavItem {
  href: string;
  labelKey: string;
  renderIcon: (active: boolean) => ReactNode;
  count?: number;
  badge?: boolean;
}

export interface SidebarExpiringItem {
  id: string;
  href: string;
  subject: string;
  status: "expired" | "expiringSoon";
  issue: string;
}

const NAV_ITEM_CLASS =
  "flex h-[34px] items-center gap-3 rounded-[8px] px-[10px] text-[13.5px] transition-colors duration-[.12s] ease-out";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const t = useTranslations("nav");
  const showCount = item.count !== undefined && item.count > 0;

  return (
    <Link
      href={item.href}
      className={`${NAV_ITEM_CLASS} ${
        active
          ? "bg-[var(--surface-card-bg)] font-semibold text-[#0D0D0D] shadow-[var(--shadow-surface-card)]"
          : "font-medium text-[#3F3F46] hover:bg-[#EBEBEB]"
      }`}
    >
      {item.renderIcon(active)}
      <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
      {showCount ? (
        item.badge ? (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F97316] text-[12px] font-semibold text-white">
            {item.count}
          </span>
        ) : (
          <span className="shrink-0 font-mono text-[11.5px] text-[#8E8E93]">{item.count}</span>
        )
      ) : null}
    </Link>
  );
}

export function CarrierSidebar({
  requestCount,
  fleetCount,
  driverCount,
  bookingCount,
  expiringItems,
}: {
  requestCount: number;
  fleetCount: number;
  driverCount: number;
  bookingCount: number;
  expiringItems: SidebarExpiringItem[];
}) {
  const pathname = usePathname();
  const t = useTranslations("carrier");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tAssistant = useTranslations("carrier.assistant");
  const assistantOpen = useAssistantOpen();

  const mainItems: NavItem[] = [
    {
      href: "/carrier/dashboard",
      labelKey: "calendar",
      renderIcon: (active) =>
        active ? (
          <CalendarSolid className={ICON_SIZE_CLASS} style={{ color: ACTIVE_COLOR }} />
        ) : (
          <CalendarOutline className={ICON_SIZE_CLASS} strokeWidth={1.9} style={{ color: INACTIVE_COLOR }} />
        ),
    },
    {
      href: "/carrier/requests",
      labelKey: "requests",
      count: requestCount,
      badge: true,
      renderIcon: (active) =>
        active ? (
          <InboxSolid className={ICON_SIZE_CLASS} style={{ color: ACTIVE_COLOR }} />
        ) : (
          <InboxOutline className={ICON_SIZE_CLASS} strokeWidth={1.9} style={{ color: INACTIVE_COLOR }} />
        ),
    },
    {
      href: "/carrier/bookings",
      labelKey: "bookings",
      count: bookingCount,
      renderIcon: (active) =>
        active ? (
          <BookmarkSolid className={ICON_SIZE_CLASS} style={{ color: ACTIVE_COLOR }} />
        ) : (
          <BookmarkOutline className={ICON_SIZE_CLASS} strokeWidth={1.9} style={{ color: INACTIVE_COLOR }} />
        ),
    },
    {
      href: "/carrier/fleet",
      labelKey: "fleet",
      count: fleetCount,
      // No bus icon in Heroicons — same lucide glyph both states, active
      // tinted rather than swapped (see the comment above NavItem).
      renderIcon: (active) => (
        <Bus
          size={17}
          strokeWidth={1.9}
          color={active ? ACTIVE_COLOR : INACTIVE_COLOR}
          fill={active ? ACTIVE_COLOR : "none"}
          fillOpacity={active ? 0.16 : undefined}
          className="shrink-0"
        />
      ),
    },
    {
      href: "/carrier/drivers",
      labelKey: "drivers",
      count: driverCount,
      renderIcon: (active) =>
        active ? (
          <UserSolid className={ICON_SIZE_CLASS} style={{ color: ACTIVE_COLOR }} />
        ) : (
          <UserOutline className={ICON_SIZE_CLASS} strokeWidth={1.9} style={{ color: INACTIVE_COLOR }} />
        ),
    },
    {
      href: "/carrier/notes",
      labelKey: "notes",
      renderIcon: (active) =>
        active ? (
          <NotesSolid className={ICON_SIZE_CLASS} style={{ color: ACTIVE_COLOR }} />
        ) : (
          <NotesOutline className={ICON_SIZE_CLASS} strokeWidth={1.9} style={{ color: INACTIVE_COLOR }} />
        ),
    },
  ];

  const hasCritical = expiringItems.some((item) => item.status === "expired");

  return (
    <aside className="sticky top-0 h-dvh w-[252px] shrink-0">
      <div
        className="flex h-full flex-col pb-[18px]"
        style={{ paddingTop: 16, paddingLeft: "var(--sidebar-padding)", paddingRight: "var(--sidebar-padding)" }}
      >
        <Link
          href="/carrier/dashboard"
          aria-label={tNav("home")}
          className="mb-[12px] flex h-9 shrink-0 items-center gap-[8px] px-[10px]"
        >
          {/* The full brand lockup (symbol + wordmark), sized so the symbol
              stays at the same ~22px it had as a standalone icon. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/travia-logo.svg" alt={tCommon("appName")} className="h-[26px] w-auto shrink-0" />
        </Link>

        <div className="flex min-h-0 flex-1 flex-col gap-[10px] overflow-y-auto">
          <nav className="flex flex-col gap-[2px]">
            {mainItems.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </nav>

          {expiringItems.length > 0 ? (
            <div className="flex flex-col gap-[8px] pt-[6px]">
              <div className="flex items-center justify-between px-[10px]">
                <span className="text-[12px] font-normal text-[#8E8E93]">{t("expiry.bannerTitle")}</span>
                <span
                  className="rounded-[6px] px-[6px] py-[2px] font-mono text-[11px] font-medium"
                  style={{
                    background: hasCritical ? "#FBDADB" : "#FBEBC2",
                    color: hasCritical ? "#7F1D1D" : "#5C3B06",
                  }}
                >
                  {expiringItems.length}
                </span>
              </div>
              {expiringItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex flex-col rounded-[8px] px-[10px] py-[6px] transition-colors duration-[.12s] ease-out hover:bg-[#EBEBEB]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex w-[17px] shrink-0 items-center justify-center">
                      <span
                        className="h-[7px] w-[7px] rounded-full"
                        style={{ background: item.status === "expired" ? "#E5484D" : "#F59E0B" }}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#18181B]">
                      {item.subject}
                    </span>
                  </span>
                  <span className="truncate pl-[29px] text-[12px] text-[#6B6B72]">{item.issue}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex shrink-0 flex-col gap-[2px] border-t border-[#E6E6E6] pt-[10px]">
          {/* Opens the assistant chat window (AssistantWindow, in the layout).
              Looks like the active nav item while the chat is open. */}
          <button
            type="button"
            onClick={toggleAssistant}
            aria-expanded={assistantOpen}
            className={`${NAV_ITEM_CLASS} ${
              assistantOpen
                ? "bg-[var(--surface-card-bg)] font-semibold text-[#0D0D0D] shadow-[var(--shadow-surface-card)]"
                : "font-medium text-[#3F3F46] hover:bg-[#EBEBEB]"
            }`}
          >
            <AssistantIcon size={17} strokeWidth={2.2} />
            <span className="min-w-0 flex-1 truncate text-left">{tAssistant("title")}</span>
            <span className="shrink-0 rounded-[5px] bg-white px-[5px] py-px text-[10.5px] font-medium text-[var(--ink-secondary)] shadow-[var(--shadow-pill)]">
              {tAssistant("shortcut")}
            </span>
          </button>
          <a href="mailto:support@travia.live" className={`${NAV_ITEM_CLASS} font-medium text-[#3F3F46] hover:bg-[#EBEBEB]`}>
            <CircleHelp size={17} strokeWidth={1.9} color="#6E6E76" className="shrink-0" />
            <span className="min-w-0 flex-1 truncate">{tNav("help")}</span>
          </a>
        </div>
      </div>
    </aside>
  );
}
