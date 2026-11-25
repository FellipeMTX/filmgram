import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import {
  getMovieImages,
  type MovieVideo,
  type Title,
} from "@/integrations/tmdb";
import { imageUrl, titleName } from "@/integrations/tmdb-display";
import { ImageGrid, VideoCards } from "./MovieMediaClient";

type Category = "posters" | "images" | "extras";
const labels = {
  en: {
    gallery: "Gallery",
    posters: "Posters",
    images: "Images",
    extras: "Extra videos",
    all: "View gallery",
    loading: "Loading gallery…",
    error: "Gallery is temporarily unavailable.",
    empty: "No media available in this category.",
  },
  "pt-BR": {
    gallery: "Galeria",
    posters: "Pôsteres",
    images: "Imagens",
    extras: "Vídeos extras",
    all: "Ver galeria",
    loading: "Carregando galeria…",
    error: "Galeria temporariamente indisponível.",
    empty: "Não há mídias nesta categoria.",
  },
  es: {
    gallery: "Galería",
    posters: "Carteles",
    images: "Imágenes",
    extras: "Vídeos extra",
    all: "Ver galería",
    loading: "Cargando galería…",
    error: "La galería no está disponible temporalmente.",
    empty: "No hay contenido en esta categoría.",
  },
};
type Props = {
  locale: string;
  item: Title;
  videos: Promise<MovieVideo[]>;
  category?: Category;
  variant: "preview" | "full";
  galleryHref: string;
  categoryHref: (category: Category) => string;
};
async function Content({
  locale,
  item,
  videos,
  category: requestedCategory,
  variant,
  galleryHref,
  categoryHref,
}: Props) {
  const t = labels[locale as keyof typeof labels] || labels.en;
  const [imageResult, videoResult] = await Promise.all([
    getMovieImages(locale, item.id).then(
      (data) => ({ data, failed: false }),
      () => ({ data: null, failed: true }),
    ),
    videos.then(
      (data) => ({ data, failed: false }),
      () => ({ data: [], failed: true }),
    ),
  ]);
  const posters = imageResult.data?.posters ?? [];
  const backdrops = imageResult.data?.backdrops ?? [];
  const extras = videoResult.data.filter((video) => video.type !== "Trailer");
  const availableCategories: Category[] = [];
  if (posters.length) availableCategories.push("posters");
  if (backdrops.length) availableCategories.push("images");
  if (extras.length) availableCategories.push("extras");
  const category = requestedCategory ?? availableCategories[0] ?? "posters";
  const images = category === "posters" ? posters : backdrops;
  const failed =
    category === "extras" ? videoResult.failed : imageResult.failed;
  if (variant === "preview")
    return (
      <section className="space-y-4" aria-label={t.gallery}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">{t.gallery}</h2>
          <Link
            href={galleryHref}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t.all} →
          </Link>
        </div>
        {imageResult.failed && videoResult.failed ? (
          <p role="alert" className="text-sm text-subtle">
            {t.error}
          </p>
        ) : availableCategories.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {availableCategories.map((value) => {
              const path =
                value === "posters"
                  ? imageResult.data?.posters[0]?.file_path
                  : imageResult.data?.backdrops[0]?.file_path ||
                    item.backdrop_path;
              const src = imageUrl(path, "w500");
              return (
                <Link
                  href={categoryHref(value)}
                  key={value}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {src && (
                    <Image
                      src={src}
                      alt=""
                      fill
                      sizes="(min-width: 900px) 30vw, 90vw"
                      unoptimized
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/90 to-black/10" />
                  <span className="absolute bottom-3 left-3 font-semibold text-white">
                    {t[value]} →
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-subtle">{t.empty}</p>
        )}
      </section>
    );
  return (
    <section className="space-y-4" aria-label={t.gallery}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">{t.gallery}</h2>
      </div>
      <nav
        aria-label={t.gallery}
        className="flex flex-wrap gap-4 border-b border-border"
      >
        {(["posters", "images", "extras"] as Category[]).map((value) => (
          <Link
            key={value}
            href={categoryHref(value)}
            aria-current={category === value ? "page" : undefined}
            className={`border-b-2 pb-2 text-sm font-semibold ${category === value ? "border-primary text-primary" : "border-transparent text-subtle hover:text-foreground"}`}
          >
            {t[value]}
          </Link>
        ))}
      </nav>
      {failed ? (
        <p role="alert" className="text-sm text-subtle">
          {t.error}
        </p>
      ) : category === "extras" ? (
        extras.length ? (
          <VideoCards
            locale={locale}
            videos={extras}
            backdrop={item.backdrop_path}
          />
        ) : (
          <p className="text-sm text-subtle">{t.empty}</p>
        )
      ) : images.length ? (
        <ImageGrid
          locale={locale}
          images={images}
          name={titleName(item)}
          poster={category === "posters"}
        />
      ) : (
        <p className="text-sm text-subtle">{t.empty}</p>
      )}
    </section>
  );
}
export function MovieGallery(props: Props) {
  const t = labels[props.locale as keyof typeof labels] || labels.en;
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-subtle">
          {t.loading}
        </p>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
