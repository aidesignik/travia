"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, FileText, Loader2, Paperclip, Trash2, X } from "lucide-react";
import type { NoteAttachmentDTO, NoteDTO } from "@/lib/notes";
import { MAX_NOTE_FILE_BYTES, NOTE_ACCEPT, isNoteImage, resolveNoteFileType } from "@/lib/uploads/noteFileTypes";
import { NOTE_BODY_MAX, NOTE_TITLE_MAX } from "@/lib/validation/note.schema";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { NoteImageViewer } from "./NoteImageViewer";

const AUTOSAVE_MS = 700;

type SaveState = "idle" | "saving" | "saved" | "error";

// Files picked but not attached yet: uploading, or failed with a reason.
interface PendingFile {
  key: string;
  name: string;
  error: string | null;
}

const ICON_BUTTON_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-[var(--ink-secondary)] transition-colors duration-[.12s] ease-out hover:bg-[var(--border-soft)] hover:text-[var(--ink-primary)]";

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A note opened over the page. The title and text save as you type; images
// and documents upload as soon as they're added. A new note is only created
// once there's something in it, and a note left empty is removed on close.
export function NoteOverlay({
  initialNote,
  onSaved,
  onDeleted,
  onClose,
}: {
  initialNote: NoteDTO | null;
  onSaved: (note: NoteDTO) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("carrier.notes");
  const locale = useLocale();
  const [title, setTitle] = useState(initialNote?.title ?? "");
  const [body, setBody] = useState(initialNote?.body ?? "");
  const [attachments, setAttachments] = useState<NoteAttachmentDTO[]>(initialNote?.attachments ?? []);
  const [updatedAt, setUpdatedAt] = useState(initialNote?.updatedAt ?? null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Index of the image open in the full-screen preview, if any.
  const [viewing, setViewing] = useState<number | null>(null);

  const noteId = useRef<string | null>(initialNote?.id ?? null);
  const creating = useRef<Promise<string> | null>(null);
  const saved = useRef({ title: initialNote?.title ?? "", body: initialNote?.body ?? "" });
  // The latest title/text (kept in step by the inputs' handlers) and
  // attachments, for saves and closing that run outside a render.
  const latest = useRef({ title: initialNote?.title ?? "", body: initialNote?.body ?? "" });
  const attachmentsRef = useRef<NoteAttachmentDTO[]>(initialNote?.attachments ?? []);
  const fileInput = useRef<HTMLInputElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
  const closing = useRef(false);

  const report = useCallback(
    (note: NoteDTO) => {
      setUpdatedAt(note.updatedAt);
      onSaved(note);
    },
    [onSaved],
  );

  // Updates the attachment list here and in the grid.
  const publishAttachments = useCallback(
    (id: string, next: NoteAttachmentDTO[]) => {
      attachmentsRef.current = next;
      setAttachments(next);
      const now = new Date().toISOString();
      report({ id, title: latest.current.title, body: latest.current.body, createdAt: initialNote?.createdAt ?? now, updatedAt: now, attachments: next });
    },
    [report, initialNote?.createdAt],
  );

  // The note's id, creating the note first if this is a new one.
  const ensureNote = useCallback(async (): Promise<string> => {
    if (noteId.current) return noteId.current;
    creating.current ??= (async () => {
      const draft = { ...latest.current };
      const res = await fetch("/api/carrier/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        creating.current = null;
        throw new Error("CREATE_FAILED");
      }
      const { note } = (await res.json()) as { note: NoteDTO };
      noteId.current = note.id;
      saved.current = draft;
      report(note);
      return note.id;
    })();
    return creating.current;
  }, [report]);

  // Saves the title/text if they changed since the last save.
  const flush = useCallback(async () => {
    const draft = { ...latest.current };
    const dirty = draft.title !== saved.current.title || draft.body !== saved.current.body;
    if (!dirty) return;
    if (!noteId.current && !draft.title.trim() && !draft.body.trim()) return;
    setSaveState("saving");
    try {
      const existed = !!noteId.current;
      const id = await ensureNote();
      if (existed || draft.title !== saved.current.title || draft.body !== saved.current.body) {
        const res = await fetch(`/api/carrier/notes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) throw new Error("SAVE_FAILED");
        const { note } = (await res.json()) as { note: NoteDTO };
        saved.current = draft;
        report(note);
      }
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [ensureNote, report]);

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (title === saved.current.title && body === saved.current.body) return;
    const timer = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [title, body, flush]);

  // Close: save what's pending, and drop a note that ended up empty.
  const close = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    await flush();
    const empty = !latest.current.title.trim() && !latest.current.body.trim() && attachmentsRef.current.length === 0;
    if (noteId.current && empty) {
      const id = noteId.current;
      await fetch(`/api/carrier/notes/${id}`, { method: "DELETE" }).catch(() => null);
      onDeleted(id);
      return;
    }
    onClose();
  }, [flush, onClose, onDeleted]);

  // Esc closes (the delete confirmation handles its own Esc first).
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !confirmDelete && viewing === null) void close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, confirmDelete, viewing]);

  // Focus the title for a new note, the end of the text otherwise; give
  // focus back to whatever opened the overlay when it closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (initialNote) {
      const el = bodyInput.current;
      el?.focus();
      el?.setSelectionRange(el.value.length, el.value.length);
    } else {
      titleInput.current?.focus();
    }
    return () => previouslyFocused?.focus();
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The text area grows with its content.
  useEffect(() => {
    const el = bodyInput.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  async function upload(files: File[]) {
    for (const file of files) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const type = resolveNoteFileType(file);
      const error = !type ? t("errors.unsupported") : file.size > MAX_NOTE_FILE_BYTES ? t("errors.tooLarge") : null;
      setPending((prev) => [...prev, { key, name: file.name, error }]);
      if (error) continue;
      try {
        const id = await ensureNote();
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/carrier/notes/${id}/attachments`, { method: "POST", body: form });
        if (!res.ok) {
          const code = (await res.json().catch(() => null))?.error;
          throw new Error(code === "TOO_MANY" ? t("errors.tooMany") : code === "TOO_LARGE" ? t("errors.tooLarge") : t("errors.uploadFailed"));
        }
        const { attachment } = (await res.json()) as { attachment: NoteAttachmentDTO };
        setPending((prev) => prev.filter((p) => p.key !== key));
        publishAttachments(id, [...attachmentsRef.current, attachment]);
      } catch (e) {
        const message = e instanceof Error && e.message !== "CREATE_FAILED" ? e.message : t("errors.uploadFailed");
        setPending((prev) => prev.map((p) => (p.key === key ? { ...p, error: message } : p)));
      }
    }
  }

  async function removeAttachment(attachment: NoteAttachmentDTO) {
    const id = noteId.current;
    if (!id) return;
    const res = await fetch(`/api/carrier/notes/${id}/attachments/${attachment.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return;
    publishAttachments(id, attachmentsRef.current.filter((a) => a.id !== attachment.id));
  }

  async function deleteNote() {
    const id = noteId.current;
    if (!id) {
      onClose();
      return;
    }
    setDeleting(true);
    const res = await fetch(`/api/carrier/notes/${id}`, { method: "DELETE" }).catch(() => null);
    setDeleting(false);
    if (res?.ok) onDeleted(id);
    else setConfirmDelete(false);
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void upload(files);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void upload(Array.from(event.dataTransfer.files));
  }

  const images = attachments.filter((a) => isNoteImage(a.contentType));
  const files = attachments.filter((a) => !isNoteImage(a.contentType));
  const editedLabel = updatedAt
    ? t("edited", {
        date: new Intl.DateTimeFormat(locale === "sr" ? "sr-Latn" : "en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(updatedAt)),
      })
    : t("newNote");
  const status = saveState === "saving" ? t("saving") : saveState === "error" ? t("errors.saveFailed") : editedLabel;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(24,24,27,0.32)] p-6"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) void close();
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label={title || t("untitled")}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget === event.target) setDragging(false);
          }}
          onDrop={onDrop}
          className="relative flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-panel border border-[var(--border-container)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)]"
        >
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border-hairline)] pl-6 pr-3">
            <span
              className={`flex-1 truncate text-[13px] font-medium ${saveState === "error" ? "text-[var(--ink-destructive)]" : "text-[var(--ink-secondary)]"}`}
              aria-live="polite"
            >
              {status}
            </span>
            <button type="button" onClick={() => setConfirmDelete(true)} aria-label={t("delete")} title={t("delete")} className={ICON_BUTTON_CLASS}>
              <Trash2 size={18} strokeWidth={1.8} />
            </button>
            <button type="button" onClick={() => void close()} aria-label={t("close")} title={t("close")} className={ICON_BUTTON_CLASS}>
              <X size={18} strokeWidth={1.8} />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
            <label htmlFor="note-title" className="sr-only">
              {t("titlePlaceholder")}
            </label>
            <input
              id="note-title"
              ref={titleInput}
              value={title}
              maxLength={NOTE_TITLE_MAX}
              onChange={(e) => {
                latest.current.title = e.target.value;
                setTitle(e.target.value);
              }}
              placeholder={t("titlePlaceholder")}
              className="w-full border-0 bg-transparent p-0 text-[24px] font-semibold tracking-[-0.02em] text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:outline-none"
            />
            <label htmlFor="note-body" className="sr-only">
              {t("bodyPlaceholder")}
            </label>
            <textarea
              id="note-body"
              ref={bodyInput}
              value={body}
              maxLength={NOTE_BODY_MAX}
              rows={6}
              onChange={(e) => {
                latest.current.body = e.target.value;
                setBody(e.target.value);
              }}
              placeholder={t("bodyPlaceholder")}
              className={`mt-3 block w-full resize-none ${attachments.length > 0 ? "min-h-[48px]" : "min-h-[150px]"} overflow-hidden border-0 bg-transparent p-0 text-[15px] font-medium leading-[1.6] text-[var(--ink-body)] placeholder:text-[var(--ink-muted)] focus:outline-none`}
            />

            {/* Images sit in the note at full width, in the order they were
                added; very tall ones are capped and shown whole. Clicking one
                opens the full-screen preview. */}
            {images.length > 0 ? (
              <div className="mt-5 flex flex-col gap-3">
                {images.map((image, i) => (
                  <figure key={image.id} className="group relative m-0 overflow-hidden rounded-[10px] border border-[var(--border-hairline)] bg-[var(--bg-subtle)]">
                    <button
                      type="button"
                      onClick={() => setViewing(i)}
                      aria-label={t("viewImage", { name: image.fileName })}
                      className="block w-full cursor-zoom-in"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt={image.fileName} className="mx-auto block max-h-[460px] w-auto max-w-full object-contain" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeAttachment(image)}
                      aria-label={t("removeFile", { name: image.fileName })}
                      title={t("removeFile", { name: image.fileName })}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(24,24,27,0.6)] text-white opacity-0 transition-opacity duration-[.12s] group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <X size={16} strokeWidth={2} />
                    </button>
                  </figure>
                ))}
              </div>
            ) : null}

            {files.length > 0 || pending.length > 0 ? (
              <ul className="mt-5 flex flex-col gap-2">
                {files.map((file) => (
                  <li key={file.id} className="flex items-center gap-3 rounded-[10px] border border-[var(--border-hairline)] px-3 py-[10px]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[var(--select-tint)] text-[var(--action-bg)]">
                      <FileText size={18} strokeWidth={1.8} aria-hidden />
                    </span>
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-[var(--ink-primary)] hover:underline">{file.fileName}</span>
                      <span className="block text-[12.5px] text-[var(--ink-secondary)]">{formatSize(file.size)}</span>
                    </a>
                    <a href={`${file.url}?download`} aria-label={t("downloadFile", { name: file.fileName })} title={t("downloadFile", { name: file.fileName })} className={ICON_BUTTON_CLASS}>
                      <Download size={17} strokeWidth={1.8} />
                    </a>
                    <button type="button" onClick={() => void removeAttachment(file)} aria-label={t("removeFile", { name: file.fileName })} title={t("removeFile", { name: file.fileName })} className={ICON_BUTTON_CLASS}>
                      <X size={17} strokeWidth={1.8} />
                    </button>
                  </li>
                ))}
                {pending.map((p) => (
                  <li key={p.key} className="flex items-center gap-3 rounded-[10px] border border-dashed border-[var(--border-strong)] px-3 py-[10px]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center text-[var(--ink-secondary)]">
                      {p.error ? <FileText size={18} strokeWidth={1.8} aria-hidden /> : <Loader2 size={18} strokeWidth={1.8} className="animate-spin" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-[var(--ink-primary)]">{p.name}</span>
                      <span className={`block text-[12.5px] ${p.error ? "text-[var(--ink-destructive)]" : "text-[var(--ink-secondary)]"}`}>
                        {p.error ?? t("uploading")}
                      </span>
                    </span>
                    {p.error ? (
                      <button type="button" onClick={() => setPending((prev) => prev.filter((x) => x.key !== p.key))} aria-label={t("dismiss")} title={t("dismiss")} className={ICON_BUTTON_CLASS}>
                        <X size={17} strokeWidth={1.8} />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <footer className="flex shrink-0 items-center gap-3 border-t border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-6 py-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex h-9 shrink-0 items-center gap-2 rounded-[9px] border border-[var(--border-strong)] bg-white px-3 text-[13.5px] font-semibold text-[var(--ink-strong)] transition-colors duration-[.12s] ease-out hover:bg-[var(--bg-subtle)]"
            >
              <Paperclip size={16} strokeWidth={1.9} aria-hidden />
              {t("addFiles")}
            </button>
            <span className="min-w-0 truncate text-[12.5px] text-[var(--ink-secondary)]">{t("filesHint")}</span>
            <input ref={fileInput} type="file" multiple accept={NOTE_ACCEPT} onChange={onPick} className="hidden" />
          </footer>

          {dragging ? (
            <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-[10px] border-2 border-dashed border-[var(--action-bg)] bg-[rgba(239,244,255,0.92)] text-[15px] font-semibold text-[var(--action-800)]">
              {t("dropHint")}
            </div>
          ) : null}
        </section>
      </div>

      {viewing !== null ? (
        <NoteImageViewer images={images} index={Math.min(viewing, images.length - 1)} onIndexChange={setViewing} onClose={() => setViewing(null)} />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={t("deleteTitle")}
          body={t("deleteBody")}
          cancelLabel={t("cancel")}
          confirmLabel={t("delete")}
          confirming={deleting}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => void deleteNote()}
        />
      ) : null}
    </>
  );
}
