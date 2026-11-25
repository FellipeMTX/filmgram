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
import { GalleryNavigation } from "./MovieGalleryNavigation";
import {
  hasTrailerCategory,
  type MovieGalleryCategory as Category,
} from "./movie-gallery-category";

const labels = {
  en: {
    gallery: "Gallery",
    posters: "Posters",
    images: "Images",
    extras: "Extra videos",
    trailers: "Trailers",
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
    trailers: "Trailers",
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
    trailers: "Tráileres",
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

type ImageResult = Awaited<ReturnType<typeof getMovieImages>> | null;
type VideoResult = MovieVideo[] | null;

async function PreviewImages({
  images,
  categoryHref,
  t,
}: {
  images: Promise<ImageResult>;
  categoryHref: Props["categoryHref"];
  t: typeof labels.en;
}) {
  const data = await images;
  if (!data)
    return (
      <p role="alert" className="text-sm text-subtle">
        {t.error}
      </p>
    );
  return (
    <>
      {(["posters", "images"] as Category[])
        .filter((value) =>
          value === "posters" ? data.posters.length : data.backdrops.length,
        )
        .map((value) => (
          <PreviewCard
            key={value}
            value={value}
            path={
              value === "posters"
                ? data.posters[0]?.file_path
                : data.backdrops[0]?.file_path
            }
            categoryHref={categoryHref}
            t={t}
          />
        ))}
    </>
  );
}

function PreviewCard({
  value,
  path,
  categoryHref,
  t,
}: {
  value: Category;
  path?: string | null;
  categoryHref: Props["categoryHref"];
  t: typeof labels.en;
}) {
  const src = imageUrl(path, "w500");
  return (
    <Link
      href={categoryHref(value)}
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
}

async function PreviewVideos({
  videos,
  item,
  categoryHref,
  t,
}: {
  videos: Promise<VideoResult>;
  item: Title;
  categoryHref: Props["categoryHref"];
  t: typeof labels.en;
}) {
  const data = await videos;
  if (!data)
    return (
      <p role="alert" className="text-sm text-subtle">
        {t.error}
      </p>
    );
  const values: Category[] = [];
  if (hasTrailerCategory(data)) values.push("trailers");
  if (data.some((video) => video.type !== "Trailer")) values.push("extras");
  return (
    <>
      {values.map((value) => (
        <PreviewCard
          key={value}
          value={value}
          path={item.backdrop_path}
          categoryHref={categoryHref}
          t={t}
        />
      ))}
    </>
  );
}

async function PreviewEmpty({
  images,
  videos,
  t,
}: {
  images: Promise<ImageResult>;
  videos: Promise<VideoResult>;
  t: typeof labels.en;
}) {
  const [imageData, videoData] = await Promise.all([images, videos]);
  if (!imageData || !videoData) return null;
  const hasVideos =
    videoData.some((video) => video.type !== "Trailer") ||
    hasTrailerCategory(videoData);
  return !imageData.posters.length &&
    !imageData.backdrops.length &&
    !hasVideos ? (
    <p className="text-sm text-subtle">{t.empty}</p>
  ) : null;
}

async function CategoryContent({
  category,
  images,
  videos,
  item,
  locale,
  t,
}: {
  category: Category;
  images: Promise<ImageResult>;
  videos: Promise<VideoResult>;
  item: Title;
  locale: string;
  t: typeof labels.en;
}) {
  if (category === "extras" || category === "trailers") {
    const data = await videos;
    if (!data)
      return (
        <p role="alert" className="text-sm text-subtle">
          {t.error}
        </p>
      );
    const selected = data.filter((video) =>
      category === "trailers"
        ? video.type === "Trailer"
        : video.type !== "Trailer",
    );
    // A direct trailers URL is unavailable unless the category is offered.
    if (category === "trailers" && !hasTrailerCategory(data))
      return <p className="text-sm text-subtle">{t.empty}</p>;
    return selected.length ? (
      <VideoCards
        locale={locale}
        videos={selected}
        backdrop={item.backdrop_path}
      />
    ) : (
      <p className="text-sm text-subtle">{t.empty}</p>
    );
  }
  const data = await images;
  if (!data)
    return (
      <p role="alert" className="text-sm text-subtle">
        {t.error}
      </p>
    );
  const selected = category === "posters" ? data.posters : data.backdrops;
  return selected.length ? (
    <ImageGrid
      locale={locale}
      images={selected}
      name={titleName(item)}
      poster={category === "posters"}
    />
  ) : (
    <p className="text-sm text-subtle">{t.empty}</p>
  );
}

async function defaultCategory(
  images: Promise<ImageResult>,
  videos: Promise<VideoResult>,
): Promise<Category> {
  const imageData = await images;
  if (imageData?.posters.length) return "posters";
  if (imageData?.backdrops.length) return "images";
  const videoData = await videos;
  if (videoData?.some((video) => video.type !== "Trailer")) return "extras";
  if (videoData && hasTrailerCategory(videoData)) return "trailers";
  return imageData ? (videoData ? "posters" : "extras") : "posters";
}

async function ResolvedContent({
  resolved,
  ...props
}: Omit<Parameters<typeof CategoryContent>[0], "category"> & {
  resolved: Promise<Category>;
}) {
  return <CategoryContent {...props} category={await resolved} />;
}

export function MovieGallery({
  locale,
  item,
  videos,
  category,
  variant,
  galleryHref,
  categoryHref,
}: Props) {
  const t = labels[locale as keyof typeof labels] || labels.en;
  const images: Promise<ImageResult> = getMovieImages(locale, item.id).catch(
    () => null,
  );
  const safeVideos: Promise<VideoResult> = videos.catch(() => null);
  const fallback = (
    <p role="status" className="text-sm text-subtle">
      {t.loading}
    </p>
  );
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Suspense fallback={fallback}>
            <PreviewImages images={images} categoryHref={categoryHref} t={t} />
          </Suspense>
          <Suspense fallback={fallback}>
            <PreviewVideos
              videos={safeVideos}
              item={item}
              categoryHref={categoryHref}
              t={t}
            />
          </Suspense>
          <Suspense>
            <PreviewEmpty images={images} videos={safeVideos} t={t} />
          </Suspense>
        </div>
      </section>
    );
  const contentProps = { images, videos: safeVideos, item, locale, t };
  const resolved = category ? undefined : defaultCategory(images, safeVideos);
  return (
    <section className="space-y-4" aria-label={t.gallery}>
      <h2 className="font-display text-2xl font-bold">{t.gallery}</h2>
      <GalleryNavigation
        category={category}
        resolved={resolved}
        videos={safeVideos}
        hrefs={
          Object.fromEntries(
            (["posters", "images", "trailers", "extras"] as Category[]).map(
              (value) => [value, categoryHref(value)],
            ),
          ) as Record<Category, string>
        }
        labels={{
          gallery: t.gallery,
          posters: t.posters,
          images: t.images,
          trailers: t.trailers,
          extras: t.extras,
        }}
      />
      <Suspense fallback={fallback}>
        {category ? (
          <CategoryContent {...contentProps} category={category} />
        ) : (
          <ResolvedContent {...contentProps} resolved={resolved!} />
        )}
      </Suspense>
    </section>
  );
}
