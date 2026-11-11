import { NextResponse } from "next/server";
import { requireApiRole } from "@/auth/api";
import { prisma } from "@/lib/prisma";
import { NOTE_ORDER, serializeNote } from "@/lib/notes";
import { noteSchema } from "@/lib/validation/note.schema";

// The carrier's notes, in the order they arranged them (see ./order).
export async function GET() {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;

  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session.user.id } });
  const notes = await prisma.note.findMany({
    where: { carrierId: carrier.id },
    include: { attachments: true },
    orderBy: NOTE_ORDER,
  });
  return NextResponse.json({ notes: notes.map(serializeNote) });
}

export async function POST(request: Request) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;

  const parsed = noteSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session.user.id } });
  // A new note goes first: one position before the current first note.
  const first = await prisma.note.aggregate({ where: { carrierId: carrier.id }, _min: { position: true } });
  const note = await prisma.note.create({
    data: {
      carrierId: carrier.id,
      title: parsed.data.title ?? "",
      body: parsed.data.body ?? "",
      position: (first._min.position ?? 0) - 1,
    },
    include: { attachments: true },
  });
  return NextResponse.json({ note: serializeNote(note) }, { status: 201 });
}
