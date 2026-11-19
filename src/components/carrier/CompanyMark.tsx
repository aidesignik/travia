"use client";

import { useEffect, useRef, useState } from "react";

function companyInitials(name: string) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || "?";
}

// Shared mark for the carrier top bar's company button and dropdown header.
// Always a `size`x`size` tile, 8px radius, overflow hidden. Logo mode shows
// the image inset by 4px padding (object-fit: contain, so it never
// distorts or overflows); any load failure falls back to initials, same as
// having no logo at all.
export function CompanyMark({
  companyName,
  logoUrl,
  size,
}: {
  companyName: string;
  logoUrl: string | null;
  size: 32 | 36;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const showLogo = Boolean(logoUrl) && !logoFailed;
  const imageSize = size - 8;

  // The <img> is server-rendered, so a failure can land before hydration
  // attaches `onError` (a fast 404 easily beats JS parse/hydrate). Catch
  // that race on mount by checking the element's own load state directly.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth === 0) {
      setLogoFailed(true);
    }
  }, [logoUrl]);

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-control"
      style={{
        width: size,
        height: size,
        background: showLogo ? "white" : "var(--company-mark-bg)",
        border: showLogo ? "1px solid rgba(11,27,51,0.08)" : undefined,
        boxSizing: "border-box",
      }}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          src={logoUrl as string}
          alt=""
          width={imageSize}
          height={imageSize}
          style={{ width: imageSize, height: imageSize, objectFit: "contain" }}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className="text-[13px] font-bold" style={{ color: "var(--company-mark-ink)" }}>
          {companyInitials(companyName)}
        </span>
      )}
    </span>
  );
}
