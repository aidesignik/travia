import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { createBlobStore } from "@/lib/blobStorage";

const STORAGE_DIR = process.env.NOTE_STORAGE_DIR ?? path.join(process.cwd(), "storage/notes");

// Note attachments (images and documents). Same split as the other upload
// stores: Vercel Blob in production (BLOB_READ_WRITE_TOKEN), local disk in
// development. Files are only ever served through the authenticated
// /api/carrier/notes/[id]/attachments/[attachmentId] route.
const blob = process.env.BLOB_READ_WRITE_TOKEN ? createBlobStore("notes") : null;

export async function save(filename: string, buffer: Buffer): Promise<void> {
  if (blob) return blob.save(filename, buffer);
  await mkdir(/* turbopackIgnore: true */ STORAGE_DIR, { recursive: true });
  await writeFile(path.join(/* turbopackIgnore: true */ STORAGE_DIR, filename), buffer);
}

export async function read(filename: string): Promise<Buffer> {
  if (blob) return blob.read(filename);
  return readFile(path.join(/* turbopackIgnore: true */ STORAGE_DIR, filename));
}

export async function remove(filename: string): Promise<void> {
  if (blob) return blob.remove(filename);
  await unlink(path.join(/* turbopackIgnore: true */ STORAGE_DIR, filename)).catch(() => {});
}
