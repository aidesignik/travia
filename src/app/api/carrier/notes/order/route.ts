import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/auth/api";
import { prisma } from "@/lib/prisma";
import { NOTE_ORDER } from "@/lib/notes";

const orderSchema = z.object({ ids: z.array(z.string().min(1).max(64)).max(5000) });

// Saves the grid order after a note is dragged: `ids` is the carrier's notes
// first to last. Ids that aren't theirs are ignored; any of their notes the
// list leaves out (say, one just made in another tab) keep their relative
// order after the listed ones.
export async function PUT(request: Request) {
  const { session, error } = await requireApiRole("CARRIER");
  if (error) return error;

  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session.user.id } });
  const notes = await prisma.note.findMany({
    where: { carrierId: carrier.id },
    select: { id: true, position: true, updatedAt: true },
    orderBy: NOTE_ORDER,
  });
  const own = new Map(notes.map((n) => [n.id, n]));
  const listed = [...new Set(parsed.data.ids)].filter((id) => own.has(id));
  const listedSet = new Set(listed);
  const order = [...listed, ...notes.map((n) => n.id).filter((id) => !listedSet.has(id))];

  const changes = order
    .map((id, position) => ({ id, position }))
    .filter(({ id, position }) => own.get(id)!.position !== position);
  if (changes.length > 0) {
    await prisma.$transaction(
      changes.map(({ id, position }) =>
        // Moving a note isn't editing it: keep updatedAt (the card's
        // "edited" date), which Prisma would otherwise bump.
        prisma.note.update({ where: { id }, data: { position, updatedAt: own.get(id)!.updatedAt } }),
      ),
    );
  }
  return NextResponse.json({ ok: true });
}
