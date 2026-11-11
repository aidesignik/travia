"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import type { NoteAttachmentDTO } from "@/lib/notes";

const BUTTON_CLASS =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-[.12s] ease-out hover:bg-white/20";

// Full-screen preview of a note's images, over everything else. Arrows (and
// the arrow keys) flip through them; Esc closes just this preview — it
// handles the key in the capture phase so the note behind stays open.
export function NoteImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: NoteAttachmentDTO[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("carrier.notes");
  const image = images[index];
  const many = images.length > 1;
  const step = (delta: number) => onIndexChange((index + delta + images.length) % images.length);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      } else if (many && event.key === "ArrowRight") {
        event.stopPropagation();
        onIndexChange((index + 1) % images.length);
      } else if (many && event.key === "ArrowLeft") {
        event.stopPropagation();
        onIndexChange((index - 1 + images.length) % images.length);
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [index, images.length, many, onClose, onIndexChange]);

  if (!image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.fileName}
      className="fixed inset-0 z-[80] flex flex-col bg-[rgba(12,12,14,0.9)]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 px-5 text-white">
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
          {image.fileName}
          {many ? <span className="ml-2 text-white/60">{t("imageOf", { current: index + 1, total: images.length })}</span> : null}
        </span>
        <a href={`${image.url}?download`} aria-label={t("downloadFile", { name: image.fileName })} title={t("downloadFile", { name: image.fileName })} className={BUTTON_CLASS}>
          <Download size={18} strokeWidth={1.9} />
        </a>
        <button type="button" onClick={onClose} aria-label={t("closePreview")} title={t("closePreview")} className={BUTTON_CLASS}>
          <X size={20} strokeWidth={1.9} />
        </button>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-20 pb-10"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={image.fileName} className="max-h-full max-w-full rounded-[6px] object-contain shadow-[0_20px_60px_rgba(0,0,0,0.5)]" />
        {many ? (
          <>
            <button type="button" onClick={() => step(-1)} aria-label={t("previousImage")} title={t("previousImage")} className={`${BUTTON_CLASS} absolute left-5 top-1/2 -translate-y-1/2`}>
              <ChevronLeft size={22} strokeWidth={1.9} />
            </button>
            <button type="button" onClick={() => step(1)} aria-label={t("nextImage")} title={t("nextImage")} className={`${BUTTON_CLASS} absolute right-5 top-1/2 -translate-y-1/2`}>
              <ChevronRight size={22} strokeWidth={1.9} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
