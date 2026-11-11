"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, StickyNote } from "lucide-react";
import type { NoteDTO } from "@/lib/notes";
import { PageHeader } from "@/components/carrier/PageHeader";
import { NoteCard } from "./NoteCard";
import { NoteOverlay } from "./NoteOverlay";

const byUpdatedDesc = (a: NoteDTO, b: NoteDTO) => b.updatedAt.localeCompare(a.updatedAt);

// The Notes page: a grid of note cards (newest edit first). A card, or
// "New note", opens the note in an overlay where it's edited in place.
export function NotesBoard({ initialNotes }: { initialNotes: NoteDTO[] }) {
  const t = useTranslations("carrier.notes");
  const [notes, setNotes] = useState(initialNotes);
  // The overlay, when open: the note it opened with (null for a new one)
  // and a key that stays the same while it's open — a new note gets its id
  // on first save without the overlay remounting and losing the typing.
  const [overlay, setOverlay] = useState<{ key: number; initial: NoteDTO | null } | null>(null);
  const openNote = (note: NoteDTO | null) => setOverlay({ key: Date.now(), initial: note });

  const upsert = (note: NoteDTO) =>
    setNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)].sort(byUpdatedDesc));
  const drop = (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id));

  const newButton = (
    <button
      type="button"
      onClick={() => openNote(null)}
      className="flex h-[38px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[9px] bg-[var(--action-bg)] px-[14px] text-[14px] font-medium text-white transition-colors duration-[.12s] ease-out hover:bg-[var(--action-bg-hover)]"
    >
      <Plus size={16} strokeWidth={1.9} />
      {t("newNote")}
    </button>
  );

  return (
    <>
      <PageHeader title={t("title")} bold actions={newButton} />
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-card-bg)] px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-[var(--select-tint)] text-[var(--action-bg)]">
            <StickyNote size={22} strokeWidth={1.8} aria-hidden />
          </span>
          <p className="mt-4 text-[16px] font-semibold text-[var(--ink-primary)]">{t("emptyTitle")}</p>
          <p className="mt-1 max-w-[420px] text-[13.5px] text-[var(--ink-secondary)]">{t("emptyBody")}</p>
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} onOpen={() => openNote(note)} />
          ))}
        </div>
      )}

      {overlay ? (
        <NoteOverlay
          key={overlay.key}
          initialNote={overlay.initial}
          onSaved={upsert}
          onDeleted={(id) => {
            drop(id);
            setOverlay(null);
          }}
          onClose={() => setOverlay(null)}
        />
      ) : null}
    </>
  );
}
