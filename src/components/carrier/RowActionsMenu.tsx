"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { MoreVertical } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const MENU_WIDTH = 144; // w-36

export function RowActionsMenu({ onEdit, deleteUrl }: { onEdit: () => void; deleteUrl: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Measured from the trigger so the menu can be portaled out to
  // document.body (see below) instead of positioned absolute-in-place.
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function closeAndRefocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Every table this renders a row for (Fleet/Drivers/Bookings) wraps its
  // rows in a rounded, overflow-hidden container — an absolute-positioned
  // menu would get clipped at that container's edge instead of floating
  // above the page. Rendering it through a portal, fixed-positioned from
  // the trigger's own on-screen rect, sidesteps that entirely.
  useLayoutEffect(() => {
    if (!open) return;
    function reposition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom + 4, left: rect.right - MENU_WIDTH });
    }
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAndRefocus();
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function onDelete() {
    setDeleting(true);
    await fetch(deleteUrl, { method: "DELETE" });
    setDeleting(false);
    setConfirmingDelete(false);
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-[9px] p-2 text-[var(--ink-disabled)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-soft)]"
        aria-label={t("actions")}
      >
        <MoreVertical size={16} strokeWidth={1.9} aria-hidden="true" />
      </button>
      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
              className="fixed z-[70] rounded-[12px] border border-[var(--border-hairline)] bg-[var(--bg-panel)] py-1 shadow-[var(--shadow-card)]"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="block h-9 w-full px-3 text-left text-[14px] leading-9 text-[var(--ink-2)] hover:bg-[var(--border-soft)]"
              >
                {t("edit")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  setConfirmingDelete(true);
                }}
                disabled={deleting}
                className="block h-9 w-full px-3 text-left text-[14px] leading-9 text-[var(--ink-destructive)] hover:bg-[var(--border-soft)] disabled:opacity-50"
              >
                {t("delete")}
              </button>
            </div>,
            document.body,
          )
        : null}
      {confirmingDelete ? (
        <ConfirmDialog
          title={t("deleteConfirmTitle")}
          body={t("deleteConfirmBody")}
          cancelLabel={t("cancel")}
          confirmLabel={t("delete")}
          confirming={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  );
}
