"use client";
import { useState } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { imageUrl } from "@/integrations/tmdb-display";
import { MediaImage } from "@/features/catalog/MediaImage";

export function PersonCard({
  id,
  name,
  profilePath,
  role,
  locale,
  movie = false,
}: {
  id: number;
  name: string;
  profilePath?: string | null;
  role?: string;
  locale: string;
  movie?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = imageUrl(profilePath, "w185");
  return (
    <Link
      href={`/${locale}/person/${id}`}
      className={`flex shrink-0 flex-col items-center gap-[5px] text-center text-[13px] ${movie ? "w-[88px]" : "basis-[120px] grow mobile:basis-[88px]"}`}
    >
      <span
        className={`relative grid aspect-square max-w-full place-items-center overflow-hidden rounded-full bg-title-placeholder text-[32px] text-title-muted [&_img]:absolute [&_img]:inset-0 [&_img]:h-full [&_img]:w-full [&_img]:object-cover ${movie ? "size-[72px]" : "h-[120px] w-[120px] mobile:h-[88px] mobile:w-[88px]"}`}
      >
        {movie ? (
          src && !failed ? (
            <img
              src={src}
              alt=""
              loading="lazy"
              onError={() => setFailed(true)}
            />
          ) : (
            <UserRound
              aria-hidden="true"
              className="size-10 text-black"
              strokeWidth={2.5}
            />
          )
        ) : (
          <MediaImage src={src} alt="" fallback={name.slice(0, 1)} />
        )}
      </span>
      <strong>{name}</strong>
      {role && <span className="text-xs text-detail-muted">{role}</span>}
    </Link>
  );
}
