import { auth } from "@/auth/auth";
import { prisma } from "@/lib/prisma";
import { NOTE_ORDER, serializeNote } from "@/lib/notes";
import { PageContent } from "@/components/carrier/PageContent";
import { NotesBoard } from "@/components/carrier/notes/NotesBoard";

export default async function NotesPage() {
  const session = await auth();
  const carrier = await prisma.carrier.findUniqueOrThrow({ where: { userId: session!.user.id } });
  const notes = await prisma.note.findMany({
    where: { carrierId: carrier.id },
    include: { attachments: true },
    orderBy: NOTE_ORDER,
  });

  return (
    <PageContent>
      <NotesBoard initialNotes={notes.map(serializeNote)} />
    </PageContent>
  );
}
