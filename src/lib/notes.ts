import type { Note, NoteAttachment, Prisma } from "@prisma/client";

// How notes are listed: the order the carrier dragged them into (lowest
// position first), newest edit first among equal positions.
export const NOTE_ORDER: Prisma.NoteOrderByWithRelationInput[] = [{ position: "asc" }, { updatedAt: "desc" }];

export interface NoteAttachmentDTO {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
}

export interface NoteDTO {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  attachments: NoteAttachmentDTO[];
}

export const noteAttachmentUrl = (noteId: string, attachmentId: string) =>
  `/api/carrier/notes/${noteId}/attachments/${attachmentId}`;

export function serializeAttachment(a: NoteAttachment): NoteAttachmentDTO {
  return { id: a.id, fileName: a.fileName, contentType: a.contentType, size: a.size, url: noteAttachmentUrl(a.noteId, a.id) };
}

export function serializeNote(note: Note & { attachments: NoteAttachment[] }): NoteDTO {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    attachments: [...note.attachments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map(serializeAttachment),
  };
}
