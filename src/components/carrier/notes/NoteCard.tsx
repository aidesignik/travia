"use client";

import { useLocale, useTranslations } from "next-intl";
import { Paperclip } from "lucide-react";
import type { NoteDTO } from "@/lib/notes";
import { isNoteImage } from "@/lib/uploads/noteFileTypes";

// A note in the grid: its first image as a cover (if any), the title and the
// start of the text, then when it was last edited and how many files it has.
export function NoteCard({ note, onOpen }: { note: NoteDTO; onOpen: () => void }) {
  const t = useTranslations("carrier.notes");
  const locale = useLocale();
  const cover = note.attachments.find((a) => isNoteImage(a.contentType));
  const edited = new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn" : "en-GB", { day: "numeric", month: "short" }).format(
    new Date(note.updatedAt),
  );

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-[248px] min-w-0 flex-col overflow-hidden rounded-[12px] border border-[var(--border-hairline)] bg-[var(--surface-card-bg)] text-left shadow-[var(--shadow-surface-card)] transition-[box-shadow,translate] duration-[.12s] ease-out hover:-translate-y-px hover:shadow-[var(--shadow-card)]"
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt="" className="h-[116px] w-full shrink-0 border-b border-[var(--border-hairline)] object-cover" />
      ) : null}
      <span className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-[14px]">
        <span
          className={`truncate text-[15px] font-semibold ${note.title ? "text-[var(--ink-primary)]" : "text-[var(--ink-muted)]"}`}
        >
          {note.title || t("untitled")}
        </span>
        {note.body ? (
          <span
            className={`mt-[6px] whitespace-pre-line text-[13.5px] leading-[1.5] text-[var(--ink-secondary)] ${cover ? "line-clamp-2" : "line-clamp-6"}`}
          >
            {note.body}
          </span>
        ) : null}
        <span className="mt-auto flex items-center gap-3 pt-2 text-[12.5px] text-[var(--ink-muted)]">
          <span>{edited}</span>
          {note.attachments.length > 0 ? (
            <span className="flex items-center gap-1">
              <Paperclip size={13} strokeWidth={1.9} aria-hidden />
              {t("fileCount", { count: note.attachments.length })}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
