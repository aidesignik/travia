"use client";

import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Primary action on both Calendar and Bookings — same "New ride" copy and
// shape on every screen.
export function NewRideSplitButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("carrier.calendar");

  return (
    <Button
      type="button"
      onClick={onClick}
    >
      <Plus size={16} strokeWidth={1.9} />
      {t("newRide")}
    </Button>
  );
}
