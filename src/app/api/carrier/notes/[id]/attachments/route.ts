import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { requireApiRole } from "@/auth/api";
import { prisma } from "@/lib/prisma";
import { serializeAttachment } from "@/lib/notes";
import { save } from "@/lib/uploads/noteStorage";
import { MAX_NOTE_ATTACHMENTS, MAX_NOTE_FILE_BYTES, resolveNoteFileType } from "@/lib/uploads/noteFileTypes";

// Attach one image or document to a note (multipart field "file").
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;
  const { id } = await params;

  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session.user.id } });
  const note = await prisma.note.findFirst({ where: { id, carrierId: carrier.id }, include: { _count: { select: { attachments: true } } } });
  if (!note) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (note._count.attachments >= MAX_NOTE_ATTACHMENTS) {
    return NextResponse.json({ error: "TOO_MANY" }, { status: 400 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "NO_FILE" }, { status: 400 });

  const type = resolveNoteFileType(file);
  if (!type) return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 400 });
  if (file.size > MAX_NOTE_FILE_BYTES) return NextResponse.json({ error: "TOO_LARGE" }, { status: 400 });

  const storedName = `${note.id}-${randomUUID()}.${type.ext}`;
  await save(storedName, Buffer.from(await file.arrayBuffer()));

  const attachment = await prisma.noteAttachment.create({
    data: {
      noteId: note.id,
      fileName: (file.name || `file.${type.ext}`).slice(0, 255),
      storedName,
      contentType: type.mime,
      size: file.size,
    },
  });
  // Touch the note so it moves to the top of the grid.
  await prisma.note.update({ where: { id: note.id }, data: { updatedAt: new Date() } });
  return NextResponse.json({ attachment: serializeAttachment(attachment) }, { status: 201 });
}
