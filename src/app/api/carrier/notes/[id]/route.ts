import { NextResponse } from "next/server";
import { requireApiRole } from "@/auth/api";
import { prisma } from "@/lib/prisma";
import { serializeNote } from "@/lib/notes";
import { remove } from "@/lib/uploads/noteStorage";
import { noteSchema } from "@/lib/validation/note.schema";

// A note the signed-in carrier owns, or null (another carrier's note reads
// as not found).
async function findOwnNote(userId: string, id: string) {
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId } });
  return prisma.note.findFirst({ where: { id, carrierId: carrier.id }, include: { attachments: true } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;
  const { id } = await params;

  const parsed = noteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const existing = await findOwnNote(session.user.id, id);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const note = await prisma.note.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
    },
    include: { attachments: true },
  });
  return NextResponse.json({ note: serializeNote(note) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;
  const { id } = await params;

  const existing = await findOwnNote(session.user.id, id);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Rows go with the note (onDelete: Cascade); the files themselves are
  // removed from storage here.
  await prisma.note.delete({ where: { id } });
  await Promise.allSettled(existing.attachments.map((a) => remove(a.storedName)));
  return NextResponse.json({ ok: true });
}
