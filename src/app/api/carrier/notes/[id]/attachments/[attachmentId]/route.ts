import { NextResponse } from "next/server";
import { requireApiRole } from "@/auth/api";
import { prisma } from "@/lib/prisma";
import { read, remove } from "@/lib/uploads/noteStorage";
import { isNoteImage } from "@/lib/uploads/noteFileTypes";

type Params = { params: Promise<{ id: string; attachmentId: string }> };

// An attachment of a note the signed-in carrier owns, or null.
async function findOwnAttachment(userId: string, noteId: string, attachmentId: string) {
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId } });
  return prisma.noteAttachment.findFirst({ where: { id: attachmentId, noteId, note: { carrierId: carrier.id } } });
}

// Serves the file. Images and PDFs open in the browser; other documents
// download under their original name.
export async function GET(request: Request, { params }: Params) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;
  const { id, attachmentId } = await params;

  const attachment = await findOwnAttachment(session.user.id, id, attachmentId);
  if (!attachment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  try {
    const buffer = await read(attachment.storedName);
    const download = new URL(request.url).searchParams.has("download");
    const inline = !download && (isNoteImage(attachment.contentType) || attachment.contentType === "application/pdf");
    const name = encodeURIComponent(attachment.fileName);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;
  const { id, attachmentId } = await params;

  const attachment = await findOwnAttachment(session.user.id, id, attachmentId);
  if (!attachment) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.noteAttachment.delete({ where: { id: attachment.id } });
  await remove(attachment.storedName);
  await prisma.note.update({ where: { id }, data: { updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
