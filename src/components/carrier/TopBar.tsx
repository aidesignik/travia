import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { NotificationsButton } from "@/components/carrier/NotificationsButton";
import { CompanyMenu } from "@/components/carrier/CompanyMenu";
import { TopBarSearch } from "./TopBarSearch";

// Persistent, page-agnostic — search, notifications, company
// switcher only.
// Never a page title or a primary action; those live in each page's own
// title row.
export async function TopBar() {
  const session = await auth();
  const carrier = session
    ? await prisma.carrier.findUnique({ where: { userId: session.user.id }, select: { companyName: true, logoUrl: true } })
    : null;
  const companyName = carrier?.companyName ?? session?.user.name ?? session?.user.email ?? "";

  return (
    <div className="flex shrink-0">
      {/* --content-padding on top/left/right — the shell panel's single
          edge gutter (see globals.css) — so the search bar and avatar
          line up with the calendar/table edges below, and the sidebar's
          logo row (which uses the same token as its top offset) lines up
          with this row. */}
      <div className="flex w-full items-center justify-between gap-4 pt-[var(--content-padding)] pr-[var(--content-padding)] pl-[var(--content-padding)]">
        <TopBarSearch />
        <div className="flex shrink-0 items-center gap-[8px]">
          <NotificationsButton />
          <CompanyMenu companyName={companyName} logoUrl={carrier?.logoUrl ?? null} email={session?.user.email ?? null} />
        </div>
      </div>
    </div>
  );
}
