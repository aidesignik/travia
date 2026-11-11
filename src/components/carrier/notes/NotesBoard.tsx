"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, StickyNote } from "lucide-react";
import type { NoteDTO } from "@/lib/notes";
import { PageHeader } from "@/components/carrier/PageHeader";
import { usePathname, useRouter } from "@/i18n/navigation";
import { NotesGrid } from "./NotesGrid";
import { NoteOverlay } from "./NoteOverlay";

// The Notes page: a grid of note cards in the order the carrier dragged them
// into (new notes go first). A card, or "New note", opens the note in an
// overlay where it's edited in place.
export function NotesBoard({ initialNotes }: { initialNotes: NoteDTO[] }) {
  const t = useTranslations("carrier.notes");
  const [notes, setNotes] = useState(initialNotes);
  // The overlay, when open: the note it opened with (null for a new one)
  // and a key that stays the same while it's open — a new note gets its id
  // on first save without the overlay remounting and losing the typing.
  const [overlay, setOverlay] = useState<{ key: number; initial: NoteDTO | null } | null>(null);
  const openNote = (note: NoteDTO | null) => setOverlay({ key: Date.now(), initial: note });

  const notesRef = useRef(notes);
  useEffect(() => {
    notesRef.current = notes;
  });

  // ?note=<id> (e.g. from the top bar's search) opens that note, then the
  // parameter is dropped so a reload doesn't reopen it.
  const router = useRouter();
  const pathname = usePathname();
  const noteParam = useSearchParams().get("note");
  useEffect(() => {
    if (!noteParam) return;
    const note = notesRef.current.find((n) => n.id === noteParam);
    if (note) setOverlay({ key: Date.now(), initial: note });
    router.replace(pathname);
  }, [noteParam, pathname, router]);

  // Editing a note keeps its place; a new one goes first.
  const upsert = (note: NoteDTO) =>
    setNotes((prev) =>
      prev.some((n) => n.id === note.id) ? prev.map((n) => (n.id === note.id ? note : n)) : [note, ...prev],
    );
  const drop = (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id));

  // Live reorder while a card is dragged. The ref is updated right away so
  // the order saved on drop is the latest even before React re-renders.
  const moveNote = (id: string, index: number) => {
    const prev = notesRef.current;
    const from = prev.findIndex((n) => n.id === id);
    if (from === -1 || from === index) return;
    const next = [...prev];
    const [note] = next.splice(from, 1);
    next.splice(index, 0, note);
    notesRef.current = next;
    setNotes(next);
  };

  // A drag ended: save the new order; if that fails, put the cards back.
  const saveOrder = async (previousIds: string[]) => {
    const ids = notesRef.current.map((n) => n.id);
    if (ids.join() === previousIds.join()) return;
    const ok = await fetch("/api/carrier/notes/order", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then((res) => res.ok)
      .catch(() => false);
    if (!ok) {
      const rank = new Map(previousIds.map((id, i) => [id, i]));
      setNotes((prev) => [...prev].sort((a, b) => (rank.get(a.id) ?? -1) - (rank.get(b.id) ?? -1)));
    }
  };

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
        <NotesGrid notes={notes} onOpen={openNote} onMove={moveNote} onCommit={saveOrder} />
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
