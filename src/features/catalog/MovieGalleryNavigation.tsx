"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { MovieVideo } from "@/integrations/tmdb";
import {
  hasTrailerCategory,
  type MovieGalleryCategory,
} from "./movie-gallery-category";
export function GalleryNavigation({
  category,
  resolved,
  videos,
  hrefs,
  labels,
}: {
  category?: MovieGalleryCategory;
  resolved?: Promise<MovieGalleryCategory>;
  videos: Promise<MovieVideo[] | null>;
  hrefs: Record<MovieGalleryCategory, string>;
  labels: Record<MovieGalleryCategory | "gallery", string>;
}) {
  const [defaultCategory, setDefaultCategory] =
    useState<MovieGalleryCategory>();
  const [hasTrailers, setHasTrailers] = useState(false);
  useEffect(() => {
    let active = true;
    void resolved?.then((value) => {
      if (active) setDefaultCategory(value);
    });
    void videos.then((value) => {
      if (active) setHasTrailers(!!value && hasTrailerCategory(value));
    });
    return () => {
      active = false;
    };
  }, [resolved, videos]);
  const current = category ?? defaultCategory;
  return (
    <nav
      aria-label={labels.gallery}
      className="flex flex-wrap gap-4 border-b border-border"
    >
      {(
        [
          "posters",
          "images",
          ...(hasTrailers ? ["trailers" as const] : []),
          "extras",
        ] as MovieGalleryCategory[]
      ).map((value) => (
        <Link
          key={value}
          href={hrefs[value]}
          aria-current={current === value ? "page" : undefined}
          className={`border-b-2 pb-2 text-sm font-semibold ${current === value ? "border-primary text-primary" : "border-transparent text-subtle hover:text-foreground"}`}
        >
          {labels[value]}
        </Link>
      ))}
    </nav>
  );
}
