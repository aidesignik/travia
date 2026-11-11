"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { NoteDTO } from "@/lib/notes";
import { NoteCard } from "./NoteCard";

type Point = { x: number; y: number };

// How far (screen px) the pointer must move before a press becomes a drag —
// less than that is a click that opens the note.
const DRAG_THRESHOLD = 5;
const SLIDE_MS = 200;
// Scrolling while dragging near the top/bottom of the page's scroll area.
const SCROLL_EDGE = 64;
const SCROLL_SPEED = 14;

interface DragState {
  id: string;
  pointerId: number;
  start: Point;
  // Where the card was grabbed, relative to its top-left, in CSS px.
  grab: Point;
  active: boolean;
  startIds: string[];
}

// The page is zoomed on laptop screens (html { zoom: .9 }): pointer and
// bounding-rect values are screen px, offsets are CSS px.
function cssScale(el: HTMLElement): number {
  return el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth || 1 : 1;
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
  }
  return null;
}

// The notes grid. Press and drag a card to move it: it follows the pointer
// and the other cards slide aside as it passes over them; letting go saves
// the order. Alt + arrow keys move the focused card one place. A press that
// doesn't move opens the note as before.
export function NotesGrid({
  notes,
  onOpen,
  onMove,
  onCommit,
}: {
  notes: NoteDTO[];
  onOpen: (note: NoteDTO) => void;
  /** Live reorder while dragging: put note `id` at `index`. */
  onMove: (id: string, index: number) => void;
  /** A drag ended; `previousIds` is the order before it (saved if changed). */
  onCommit: (previousIds: string[]) => void;
}) {
  const t = useTranslations("carrier.notes");
  const gridRef = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const drag = useRef<DragState | null>(null);
  const pointer = useRef<Point>({ x: 0, y: 0 });
  // Where each card was on screen just before a reorder (grid CSS px), so
  // the cards that moved can slide from there to their new place.
  const before = useRef<Map<string, Point> | null>(null);
  const suppressClick = useRef(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const latest = useRef({ notes, onMove, onCommit });
  useEffect(() => {
    latest.current = { notes, onMove, onCommit };
  });

  // Pointer position in the grid's own CSS px.
  function gridPoint(): Point | null {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const scale = cssScale(grid);
    return { x: (pointer.current.x - rect.left) / scale, y: (pointer.current.y - rect.top) / scale };
  }

  // Keep the dragged card under the pointer, wherever its slot now is.
  function placeDragged() {
    const d = drag.current;
    const el = d && cards.current.get(d.id);
    const p = gridPoint();
    if (!d || !el || !p) return;
    el.style.transform = `translate(${p.x - d.grab.x - el.offsetLeft}px, ${p.y - d.grab.y - el.offsetTop}px)`;
  }

  // Snapshot every card's on-screen position (mid-slide included) before a
  // reorder re-renders them.
  function snapshot() {
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const scale = cssScale(grid);
    const map = new Map<string, Point>();
    cards.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      map.set(id, { x: (r.left - rect.left) / scale, y: (r.top - rect.top) / scale });
    });
    before.current = map;
  }

  // Move the dragged card into the slot under the pointer. Hit-testing uses
  // the slots' layout boxes (offsets), not where sliding cards currently
  // are, so the order can't flicker back and forth.
  function reorderUnderPointer() {
    const d = drag.current;
    const p = gridPoint();
    if (!d || !p) return;
    const { notes: list, onMove: move } = latest.current;
    const index = list.findIndex((note) => {
      const el = cards.current.get(note.id);
      return (
        el &&
        p.x >= el.offsetLeft &&
        p.x <= el.offsetLeft + el.offsetWidth &&
        p.y >= el.offsetTop &&
        p.y <= el.offsetTop + el.offsetHeight
      );
    });
    if (index === -1 || list[index].id === d.id) return;
    snapshot();
    move(d.id, index);
  }

  // After a reorder: slide each moved card from where it was to its new
  // slot, and re-pin the dragged card to the pointer.
  useLayoutEffect(() => {
    const prev = before.current;
    before.current = null;
    if (!prev) return;
    const draggedId = drag.current?.active ? drag.current.id : null;
    cards.current.forEach((el, id) => {
      if (id === draggedId) return;
      const from = prev.get(id);
      if (!from) return;
      const dx = from.x - el.offsetLeft;
      const dy = from.y - el.offsetTop;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.offsetWidth;
      el.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(.2,.7,.3,1)`;
      el.style.transform = "";
      window.setTimeout(() => {
        if (el.style.transform === "") el.style.transition = "";
      }, SLIDE_MS + 20);
    });
    placeDragged();
    // Runs on reorders only; placeDragged reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // Window-level listeners while a press is in progress.
  useEffect(() => {
    let frame = 0;
    const scroller = scrollParent(gridRef.current);

    function autoScroll() {
      frame = 0;
      if (!drag.current?.active || !scroller) return;
      const rect = scroller.getBoundingClientRect();
      const y = pointer.current.y;
      const delta = y < rect.top + SCROLL_EDGE ? -SCROLL_SPEED : y > rect.bottom - SCROLL_EDGE ? SCROLL_SPEED : 0;
      if (delta === 0) return;
      const top = scroller.scrollTop;
      scroller.scrollTop = top + delta;
      if (scroller.scrollTop !== top) {
        placeDragged();
        reorderUnderPointer();
      }
      frame = requestAnimationFrame(autoScroll);
    }

    function onPointerMove(event: PointerEvent) {
      const d = drag.current;
      if (!d || event.pointerId !== d.pointerId) return;
      pointer.current = { x: event.clientX, y: event.clientY };
      if (!d.active) {
        if (Math.hypot(event.clientX - d.start.x, event.clientY - d.start.y) < DRAG_THRESHOLD) return;
        d.active = true;
        suppressClick.current = true;
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        setDragId(d.id);
      }
      event.preventDefault();
      placeDragged();
      reorderUnderPointer();
      if (!frame) frame = requestAnimationFrame(autoScroll);
    }

    function onPointerUp(event: PointerEvent) {
      const d = drag.current;
      if (!d || event.pointerId !== d.pointerId) return;
      drag.current = null;
      if (!d.active) return;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      // Glide into the slot, then drop back into the grid.
      const el = cards.current.get(d.id);
      if (el) {
        el.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(.2,.7,.3,1)`;
        el.style.transform = "";
      }
      setDragId(null);
      setSettlingId(d.id);
      window.setTimeout(() => {
        if (el && el.style.transform === "") el.style.transition = "";
        setSettlingId((id) => (id === d.id ? null : id));
      }, SLIDE_MS + 20);
      latest.current.onCommit(d.startIds);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      if (frame) cancelAnimationFrame(frame);
    };
    // Handlers read refs only; listeners are bound once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLElement>, note: NoteDTO) {
    suppressClick.current = false;
    // Mouse and pen only: on touch, a swipe over the cards keeps scrolling.
    if (event.button !== 0 || event.pointerType === "touch" || drag.current) return;
    const el = event.currentTarget;
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const scale = cssScale(grid);
    pointer.current = { x: event.clientX, y: event.clientY };
    drag.current = {
      id: note.id,
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      grab: {
        x: (event.clientX - rect.left) / scale - el.offsetLeft,
        y: (event.clientY - rect.top) / scale - el.offsetTop,
      },
      active: false,
      startIds: latest.current.notes.map((n) => n.id),
    };
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>, note: NoteDTO) {
    if (!event.altKey) return;
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const ids = notes.map((n) => n.id);
    const index = ids.indexOf(note.id) + step;
    if (index < 0 || index >= ids.length) return;
    snapshot();
    onMove(note.id, index);
    onCommit(ids);
  }

  return (
    <>
      <p id="notes-reorder-hint" className="sr-only">
        {t("reorderHint")}
      </p>
      <div ref={gridRef} className="relative grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            ref={(el) => {
              if (el) cards.current.set(note.id, el);
              else cards.current.delete(note.id);
            }}
            note={note}
            dragging={dragId === note.id}
            lifted={dragId === note.id || settlingId === note.id}
            onOpen={() => {
              if (suppressClick.current) {
                suppressClick.current = false;
                return;
              }
              onOpen(note);
            }}
            onPointerDown={(event) => onPointerDown(event, note)}
            onKeyDown={(event) => onKeyDown(event, note)}
          />
        ))}
      </div>
    </>
  );
}
