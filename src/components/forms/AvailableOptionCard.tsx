"use client";

import { MouseEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatAmenities, type AvailableOption } from "@/lib/matching";

export function AvailableOptionCard({
  option,
  bookHref,
  bookLabel,
  canBook,
}: {
  option: AvailableOption;
  bookHref: string;
  bookLabel: string;
  canBook: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  function stopPropagation(event: MouseEvent) {
    event.stopPropagation();
  }

  const amenitiesLabel = formatAmenities(option.amenities.map((a) => t(`amenities.${a}`)), option.otherAmenities);

  return (
    <>
      <Card
        className="flex cursor-pointer flex-col justify-between transition-shadow hover:shadow-md"
        onClick={() => setOpen(true)}
      >
        <div>
          <p className="font-medium text-zinc-900">{option.carrierName}</p>
          <p className="text-sm text-zinc-600">{option.carrierCity}</p>
          <p className="mt-2 text-sm text-zinc-700">
            {t(`vehicleType.${option.type}`)} {option.model} · {option.seats}{" "}
            {t("client.availableOptions.seats")}
          </p>
          {amenitiesLabel ? <p className="mt-1 text-xs text-zinc-500">{amenitiesLabel}</p> : null}
          {option.estimatedPrice !== null ? (
            <p className="mt-3 text-lg font-semibold text-zinc-900">
              ~{option.estimatedPrice.toLocaleString()} RSD
            </p>
          ) : null}
        </div>
        {canBook ? (
          <Link href={bookHref} onClick={stopPropagation} className="mt-4 block">
            <Button className="w-full">{bookLabel}</Button>
          </Link>
        ) : null}
      </Card>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={stopPropagation}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">{option.carrierName}</h3>
                <p className="text-sm text-zinc-600">{option.carrierCity}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 text-[var(--ink-muted)] hover:text-zinc-700"
                aria-label={t("common.close")}
              >
                ✕
              </button>
            </div>

            {option.carrierDescription ? (
              <p className="mt-3 text-sm text-zinc-700">{option.carrierDescription}</p>
            ) : null}

            <div className="mt-4 border-t border-zinc-200 pt-4">
              <p className="font-medium text-zinc-900">
                {t(`vehicleType.${option.type}`)} {option.model}
                {option.year ? ` (${option.year})` : ""}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {option.seats} {t("client.availableOptions.seats")}
              </p>
              {amenitiesLabel ? <p className="mt-1 text-sm text-zinc-600">{amenitiesLabel}</p> : null}
            </div>

            <div className="mt-4 border-t border-zinc-200 pt-4">
              {option.photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {option.photos.map((url) => (
                    // Served from our own upload route, but still a plain img —
                    // next/image isn't worth the config for a handful of thumbnails.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt={`${option.type} ${option.model}`}
                      className="h-32 w-full rounded-md border border-zinc-200 object-cover"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">{t("client.availableOptions.noPhotos")}</p>
              )}
            </div>

            {option.estimatedPrice !== null ? (
              <p className="mt-4 text-xl font-semibold text-zinc-900">
                ~{option.estimatedPrice.toLocaleString()} RSD
              </p>
            ) : null}

            {canBook ? (
              <Link href={bookHref} className="mt-4 block">
                <Button className="w-full">{bookLabel}</Button>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
