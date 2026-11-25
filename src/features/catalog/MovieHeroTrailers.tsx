import Link from "next/link";
import { Suspense } from "react";
import {
  getMovieImages,
  type MovieVideo,
  type Title,
} from "@/integrations/tmdb";
import { VideoCards } from "./MovieMediaClient";

const labels = {
  en: {
    title: "Trailers",
    single: "Trailer",
    gallery: "View gallery",
    loading: "Loading trailers…",
    error: "Trailers are temporarily unavailable.",
  },
  "pt-BR": {
    title: "Trailers",
    single: "Trailer",
    gallery: "Ver galeria",
    loading: "Carregando trailers…",
    error: "Trailers temporariamente indisponíveis.",
  },
  es: {
    title: "Tráileres",
    single: "Tráiler",
    gallery: "Ver galería",
    loading: "Cargando tráileres…",
    error: "Los tráileres no están disponibles temporalmente.",
  },
};

async function Trailers({
  locale,
  item,
  videos,
  galleryHref,
}: {
  locale: string;
  item: Title;
  videos: Promise<MovieVideo[]>;
  galleryHref: string;
}) {
  const t = labels[locale as keyof typeof labels] || labels.en;
  const [result, images] = await Promise.all([
    videos.then(
      (data) => ({ data, failed: false }),
      () => ({ data: [], failed: true }),
    ),
    getMovieImages(locale, item.id).catch(() => null),
  ]);
  const trailers = result.data
    .filter((video) => video.type === "Trailer")
    .slice(0, 3);
  const artwork = [
    ...new Set(
      [
        item.backdrop_path,
        ...(images?.backdrops.map((image) => image.file_path) ?? []),
      ].filter((path): path is string => Boolean(path)),
    ),
  ].slice(0, trailers.length);
  const hasMedia = !!(
    images?.posters.length ||
    images?.backdrops.length ||
    result.data.some((video) => video.type !== "Trailer")
  );
  if (!trailers.length && !hasMedia && !result.failed) return null;
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
              backdrop={item.backdrop_path ?? item.poster_path}
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
      {hasMedia && (
        <Link
          href={galleryHref}
          className="self-center rounded-md border border-border bg-background/80 px-4 py-2 text-sm font-semibold text-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t.gallery} →
        </Link>
      )}
    </div>
  );
}
export function MovieHeroTrailers(props: {
  locale: string;
  item: Title;
  videos: Promise<MovieVideo[]>;
  galleryHref: string;
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
