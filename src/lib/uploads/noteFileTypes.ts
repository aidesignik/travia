import { IMAGE_MIME_TO_EXT } from "./imageTypes";

// What a note can hold: photos (shown as thumbnails) and everyday office
// documents (listed as files). Keyed by MIME type → stored extension.
export const NOTE_IMAGE_MIME_TO_EXT: Record<string, string> = {
  ...IMAGE_MIME_TO_EXT,
  "image/gif": "gif",
};

export const NOTE_DOCUMENT_MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "text/csv": "csv",
};

export const NOTE_MIME_TO_EXT: Record<string, string> = { ...NOTE_IMAGE_MIME_TO_EXT, ...NOTE_DOCUMENT_MIME_TO_EXT };

// The file picker's accept list (MIME types plus extensions, since some
// browsers report office files with an empty or generic type).
export const NOTE_ACCEPT = [...Object.keys(NOTE_MIME_TO_EXT), ...Object.values(NOTE_MIME_TO_EXT).map((e) => `.${e}`)].join(",");

// Vercel functions accept request bodies up to ~4.5 MB, so one upload is
// capped just under that.
export const MAX_NOTE_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_NOTE_ATTACHMENTS = 20;

export const isNoteImage = (contentType: string) => contentType in NOTE_IMAGE_MIME_TO_EXT;

// Fallback for browsers that send office files as "" or
// "application/octet-stream": trust the extension if it's one we accept.
const EXT_TO_MIME: Record<string, string> = Object.fromEntries(Object.entries(NOTE_MIME_TO_EXT).map(([m, e]) => [e, m]));
export function resolveNoteFileType(file: { type: string; name: string }): { mime: string; ext: string } | null {
  if (NOTE_MIME_TO_EXT[file.type]) return { mime: file.type, ext: NOTE_MIME_TO_EXT[file.type] };
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const fromExt = ext === "jpeg" ? "image/jpeg" : EXT_TO_MIME[ext];
  return fromExt ? { mime: fromExt, ext: NOTE_MIME_TO_EXT[fromExt] } : null;
}
