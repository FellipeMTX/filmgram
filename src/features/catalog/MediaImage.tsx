"use client";
import { useState } from "react";
export function MediaImage({
  src,
  alt,
  fallback,
}: {
  src?: string;
  alt: string;
  fallback: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  return src && failedSrc !== src ? (
    <img src={src} alt={alt} loading="lazy" onError={() => setFailedSrc(src)} />
  ) : (
    <span>{fallback}</span>
  );
}
