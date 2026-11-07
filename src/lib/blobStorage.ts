import { put, list, del } from "@vercel/blob";

// Thin wrapper around Vercel Blob with the same save/read/remove shape the
// local-disk storage modules already use, so callers don't change. Blob
// pathnames are deterministic (no random suffix) since the filename itself
// is already unique (userId-randomUUID, or a ride id); read/remove resolve
// the blob's actual URL via a prefix list since del/fetch need a URL, not
// just a pathname.
export function createBlobStore(prefix: string) {
  const pathname = (filename: string) => `${prefix}/${filename}`;

  async function findUrl(filename: string): Promise<string | null> {
    const target = pathname(filename);
    const { blobs } = await list({ prefix: target, limit: 1 });
    return blobs.find((b) => b.pathname === target)?.url ?? null;
  }

  // Same pathname on every save, so a re-save (a ride's documents are
  // regenerated after each edit) has to overwrite: Vercel Blob refuses to
  // replace an existing pathname unless allowOverwrite is set. The short
  // cache lifetime keeps a replaced file from being served stale.
  async function save(filename: string, buffer: Buffer): Promise<void> {
    await put(pathname(filename), buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
  }

  async function read(filename: string): Promise<Buffer> {
    const url = await findUrl(filename);
    if (!url) throw new Error("NOT_FOUND");
    const res = await fetch(url);
    if (!res.ok) throw new Error("NOT_FOUND");
    return Buffer.from(await res.arrayBuffer());
  }

  async function remove(filename: string): Promise<void> {
    const url = await findUrl(filename);
    if (url) await del(url);
  }

  return { save, read, remove };
}
