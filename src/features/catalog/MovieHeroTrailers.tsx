import Link from "next/link";
import { Suspense } from "react";
import {
  getMovieImages,
  type MovieVideo,
  type Title,
} from "@/integrations/tmdb";
import { VideoCards } from "./MovieMediaClient";
import { hasTrailerCategory } from "./movie-gallery-category";

const labels = {
  en: {
    title: "Trailers",
    single: "Trailer",
    gallery: "View gallery",
    allTrailers: "View all trailers",
    loading: "Loading trailers…",
    error: "Trailers are temporarily unavailable.",
  },
  "pt-BR": {
    title: "Trailers",
    single: "Trailer",
    gallery: "Ver galeria",
    allTrailers: "Ver todos os trailers",
    loading: "Carregando trailers…",
    error: "Trailers temporariamente indisponíveis.",
  },
  es: {
    title: "Tráileres",
    single: "Tráiler",
    gallery: "Ver galería",
    allTrailers: "Ver todos los tráileres",
    loading: "Cargando tráileres…",
    error: "Los tráileres no están disponibles temporalmente.",
  },
};

function GalleryLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="self-center rounded-md border border-border bg-background/80 px-4 py-2 text-sm font-semibold text-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {label} <span aria-hidden>→</span>
    </Link>
  );
}

async function GalleryLinkWithImages({
  images,
  href,
  label,
}: {
  images: Promise<Awaited<ReturnType<typeof getMovieImages>> | null>;
  href: string;
  label: string;
}) {
  const available = await images;
  return available?.posters.length || available?.backdrops.length ? (
    <GalleryLink href={href} label={label} />
  ) : null;
}

async function Trailers({
  locale,
  item,
  videos,
  galleryHref,
  trailersHref,
}: {
  locale: string;
  item: Title;
  videos: Promise<MovieVideo[]>;
  galleryHref: string;
  trailersHref: string;
}) {
  const t = labels[locale as keyof typeof labels] || labels.en;
  const result = await videos.then(
    (data) => ({ data, failed: false }),
    () => ({ data: [] as MovieVideo[], failed: true }),
  );
  const allTrailers = result.data.filter((video) => video.type === "Trailer");
  const trailers = allTrailers.slice(0, 3);
  const hasGalleryVideos =
    hasTrailerCategory(result.data) ||
    result.data.some((video) => video.type !== "Trailer");
  const backdrop = item.backdrop_path ?? item.poster_path;
  const images =
    trailers.length > 1 || !hasGalleryVideos
      ? getMovieImages(locale, item.id).catch(() => null)
      : undefined;
  const artwork =
    trailers.length > 1 && images
      ? images.then((data) =>
          [
            ...new Set(
              [
                item.backdrop_path,
                ...(data?.backdrops ?? []).map((image) => image.file_path),
              ].filter((path): path is string => !!path),
            ),
          ].slice(0, trailers.length),
        )
      : undefined;
  return (
    <div
      className={`flex h-full min-h-0 flex-col gap-3 ${trailers.length <= 1 ? "justify-center" : ""}`}
    >
      {trailers.length > 0 && (
        <>
          <h2
            className={`font-display text-2xl font-bold ${trailers.length === 1 ? "text-center" : ""}`}
          >
            {trailers.length === 1 ? t.single : t.title}
          </h2>
          <div className={trailers.length > 1 ? "min-h-0 flex-1" : undefined}>
            <VideoCards
              locale={locale}
              videos={trailers}
              backdrop={backdrop}
              artwork={artwork}
              hero
            />
          </div>
        </>
      )}
      {result.failed && (
        <p role="alert" className="text-sm text-subtle">
          {t.error}
        </p>
      )}
      {hasTrailerCategory(result.data) && (
        <Link
          href={trailersHref}
          className="self-center text-sm font-semibold text-primary hover:underline"
        >
          {t.allTrailers} →
        </Link>
      )}
      {hasGalleryVideos ? (
        <GalleryLink href={galleryHref} label={t.gallery} />
      ) : (
        images && (
          <Suspense>
            <GalleryLinkWithImages
              images={images}
              href={galleryHref}
              label={t.gallery}
            />
          </Suspense>
        )
      )}
    </div>
  );
}
export function MovieHeroTrailers(props: {
  locale: string;
  item: Title;
  videos: Promise<MovieVideo[]>;
  galleryHref: string;
  trailersHref: string;
}) {
  const t = labels[props.locale as keyof typeof labels] || labels.en;
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-subtle">
          {t.loading}
        </p>
      }
    >
      <Trailers {...props} />
    </Suspense>
  );
}
