import { Suspense } from "react";
import { FilmgramRating } from "@/components/FilmgramRating";
import { MovieReviews } from "@/features/social/MovieReviews";
import { messages } from "@/i18n/messages";
import { currentUser, supabase } from "@/integrations/supabase";
import {
  getMovieVideos,
  getMovieReleases,
  movieRegion,
  imageUrl,
  titleName,
  year,
  type Title,
} from "@/integrations/tmdb";
import { container, eyebrow } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { MovieCrew } from "./MovieCrew";
import { MovieExtraPanel } from "./MovieExtraPanel";
import { MovieOverview } from "./MovieOverview";
import { MovieSectionNavigation } from "./MovieSectionNavigation";
import {
  movieReviewId,
  movieHref,
  resolveMovieLocation,
  movieHeroRelease,
} from "./movie-section-links";
import { MovieHeroTrailers } from "./MovieHeroTrailers";
import { MovieGallery } from "./MovieGallery";
import Link from "next/link";
import { TitleActions } from "./TitleActions";
import { getTitleActionsData } from "./title-actions-data";

const labels = {
  en: {
    loading: "Loading…",
    reviews: "Community reviews",
    watchDetails: "View information",
  },
  "pt-BR": {
    loading: "Carregando…",
    reviews: "Resenhas da comunidade",
    watchDetails: "Ver informações",
  },
  es: {
    loading: "Cargando…",
    reviews: "Reseñas de la comunidad",
    watchDetails: "Ver información",
  },
};

type MovieStats = { average_rating: number; review_count: number } | null;

async function ReleaseMetadata({
  locale,
  id,
  country,
  originalDate,
  metadata,
}: {
  locale: string;
  id: number;
  country?: string;
  originalDate?: string;
  metadata: string;
}) {
  const releases = await getMovieReleases(
    locale,
    id,
    movieRegion(locale, country),
  ).catch(() => []);
  const release = movieHeroRelease(releases);
  const rawDate = release?.date || originalDate;
  const date = rawDate ? new Date(rawDate + "T00:00:00Z") : null;
  if (!date || Number.isNaN(date.valueOf())) return metadata || null;
  const formatted = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
  const original =
    locale === "pt-BR"
      ? "Lan\u00e7amento original"
      : locale === "es"
        ? "Estreno original"
        : "Original release";
  return (
    <>
      {!release && original + ": "}
      <time dateTime={rawDate}>{formatted}</time>
      {release?.certification && (
        <>
          {" "}
          <strong className="inline-block rounded bg-primary/15 px-1.5 text-primary">
            {release.certification}
          </strong>
        </>
      )}
      {metadata && <> · {metadata}</>}
    </>
  );
}

async function HeroRating({
  stats,
  locale,
}: {
  stats: Promise<MovieStats>;
  locale: string;
}) {
  const result = await stats;
  if (!result || !Number(result.review_count)) return null;
  return (
    <span className="inline-flex items-center gap-2 border-l border-border pl-3">
      <FilmgramRating value={Number(result.average_rating)} locale={locale} />
      <span className="font-medium">Filmgram</span>
    </span>
  );
}

async function MovieActions({
  item,
  locale,
  db,
  user,
}: {
  item: Title;
  locale: string;
  db: ReturnType<typeof supabase>;
  user: ReturnType<typeof currentUser>;
}) {
  const [client, viewer] = await Promise.all([db, user]);
  const { states, playlists } = await getTitleActionsData(
    client,
    "movie",
    item.id,
    viewer?.id,
  );
  return (
    <TitleActions
      item={item}
      locale={locale}
      user={!!viewer}
      states={states}
      playlists={playlists}
    />
  );
}

async function TitleLikeCount({
  db,
  id,
  locale,
}: {
  db: ReturnType<typeof supabase>;
  id: number;
  locale: string;
}) {
  const result = await (
    await db
  )?.rpc("title_like_count", {
    p_media_type: "movie",
    p_tmdb_id: id,
  });
  return (
    <span className="font-medium text-cast-foreground">
      ♡ {Number(result?.data || 0)} {messages(locale).likes}
    </span>
  );
}

async function CommunityReviews({
  item,
  locale,
  review,
  stats,
  user,
  preview,
  reviewsHref,
  country,
}: {
  preview?: boolean;
  reviewsHref?: string;
  country?: string;
  item: Title;
  locale: string;
  review: string | undefined;
  stats: Promise<MovieStats>;
  user: ReturnType<typeof currentUser>;
}) {
  const [viewer, aggregate] = await Promise.all([user, stats]);
  return (
    <div data-movie-reviews-target={movieReviewId(review) || ""}>
      <MovieReviews
        preview={preview}
        reviewsHref={reviewsHref}
        locale={locale}
        tmdbId={item.id}
        reviewId={movieReviewId(review)}
        title={titleName(item)}
        year={year(item)}
        posterUrl={imageUrl(item.poster_path) ?? null}
        backdropUrl={imageUrl(item.backdrop_path, "w780") ?? null}
        titleHref={movieHref("/" + locale + "/title/movie/" + item.id, {
          country,
        })}
        average={Number(aggregate?.average_rating || 0)}
        count={Number(aggregate?.review_count || 0)}
        userId={viewer?.id ?? null}
      />
    </div>
  );
}

export function MovieDetail({
  item,
  locale,
  country,
  tab,
  review,
  media,
}: {
  media?: string;
  item: Title;
  locale: string;
  country: string | undefined;
  tab: string | undefined;
  review: string | undefined;
}) {
  const t = messages(locale);
  const text = labels[locale as keyof typeof labels] || labels.en;
  const db = supabase();
  const user = currentUser();
  const stats = db.then(async (client) => {
    const response = await client
      ?.rpc("title_review_stats", { p_media_type: "movie", p_tmdb_id: item.id })
      .single();
    return response?.data ?? null;
  });
  const videos = getMovieVideos(locale, item.id);
  const base = "/" + locale + "/title/movie/" + item.id;
  const href = (nextTab?: string, category?: string) =>
    movieHref(base, { country, tab: nextTab, media: category });
  const { active } = resolveMovieLocation({ tab, review });
  const category =
    media === "posters" || media === "images" || media === "extras"
      ? media
      : undefined;
  const tabs =
    locale === "pt-BR"
      ? ["Visão geral", "Informações", "Resenhas", "Galeria"]
      : locale === "es"
        ? ["Resumen", "Información", "Reseñas", "Galería"]
        : ["Overview", "Info", "Reviews", "Gallery"];
  const backdrop = imageUrl(item.backdrop_path, "original");
  const genres = item.genres?.map((genre) => genre.name) || [];
  const runtime = item.runtime
    ? Math.floor(item.runtime / 60) + "h " + (item.runtime % 60) + "m"
    : "";
  const metadata = [runtime, ...genres].filter(Boolean).join(" · ");

  return (
    <main>
      <MovieSectionNavigation key={item.id} legacyTab={tab} review={review} />
      <div
        className="bg-background bg-cover bg-[position:50%_38%]"
        style={{
          backgroundImage: [
            "linear-gradient(0deg, var(--background), transparent 52%)",
            "linear-gradient(90deg, #100e0dcf, #100e0d4d)",
            backdrop && "url(" + backdrop + ")",
          ]
            .filter(Boolean)
            .join(","),
        }}
      >
        <div
          className={cn(
            container,
            "grid gap-6 pt-8 pb-12 min-[801px]:min-h-[28rem] min-[801px]:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] min-[801px]:gap-8 min-[801px]:pt-10 min-[801px]:pb-10",
          )}
        >
          <div className="min-w-0 space-y-3 min-[801px]:self-end">
            <p className={eyebrow}>{t.film}</p>
            <h1 className="font-display text-[clamp(2.6rem,6.3vw,5.25rem)] leading-none font-bold tracking-[-.025em] [overflow-wrap:anywhere]">
              {titleName(item)}
            </h1>
            {item.original_title && item.original_title !== titleName(item) && (
              <p className="text-sm text-detail-meta">
                {locale === "pt-BR"
                  ? "Título original"
                  : locale === "es"
                    ? "Título original"
                    : "Original title"}{" "}
                · {item.original_title}
              </p>
            )}
            <p className="text-sm text-detail-meta">
              <Suspense fallback={metadata || null}>
                <ReleaseMetadata
                  locale={locale}
                  id={item.id}
                  country={country}
                  originalDate={item.release_date}
                  metadata={metadata}
                />
              </Suspense>
            </p>
            <p className="max-w-[52ch] leading-relaxed text-title-overview">
              {item.overview || t.noOverview}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="text-primary">
                  ★
                </span>
                <strong>
                  {typeof item.vote_average === "number"
                    ? new Intl.NumberFormat(locale, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      }).format(item.vote_average) + "/10"
                    : "—"}
                </strong>
                <span className="font-medium">TMDB</span>
              </span>
              <Suspense fallback={null}>
                <HeroRating stats={stats} locale={locale} />
              </Suspense>
              <Suspense fallback={null}>
                <TitleLikeCount db={db} id={item.id} locale={locale} />
              </Suspense>
            </div>
            <Suspense fallback={null}>
              <MovieActions item={item} locale={locale} db={db} user={user} />
            </Suspense>
          </div>
          <div
            id="videos"
            className="w-full min-w-0 scroll-mt-4 min-[801px]:max-w-[28.75rem] min-[801px]:justify-self-end"
          >
            <Suspense
              fallback={
                <div
                  role="status"
                  className="grid aspect-video place-items-center rounded-xl border border-border bg-card"
                >
                  {text.loading}
                </div>
              }
            >
              <MovieHeroTrailers
                item={item}
                locale={locale}
                videos={videos}
                galleryHref={href("gallery") + "#gallery"}
              />
            </Suspense>
          </div>
        </div>
      </div>
      <nav
        aria-label={
          locale === "pt-BR"
            ? "Seções do filme"
            : locale === "es"
              ? "Secciones de la película"
              : "Movie sections"
        }
        className={cn(
          container,
          "grid grid-cols-4 gap-2 border-y border-border sm:gap-5",
        )}
      >
        {["overview", "info", "reviews", "gallery"].map((section, index) => (
          <Link
            key={section}
            href={href(section === "overview" ? undefined : section)}
            aria-current={active === section ? "page" : undefined}
            className={cn(
              "w-fit min-w-0 border-b-2 py-4 font-display text-base leading-tight font-semibold sm:text-xl",
              active === section
                ? "border-primary text-foreground"
                : "border-transparent text-subtle hover:text-foreground",
            )}
          >
            {tabs[index]}
          </Link>
        ))}
      </nav>
      <div className={cn(container, "space-y-10 pt-8 pb-28")}>
        {(active === "overview" || active === "info") && (
          <>
            <div className="grid gap-8 min-[801px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div id="cast-and-crew" className="min-w-0 scroll-mt-4">
                <MovieCrew
                  cast={item.credits?.cast || []}
                  crew={item.credits?.crew || []}
                  locale={locale}
                  preview={active === "overview"}
                  infoHref={href("info") + "#cast-and-crew"}
                />
              </div>
              <div className="min-w-0 space-y-8 min-[801px]:border-l min-[801px]:border-border min-[801px]:pl-8">
                <MovieExtraPanel
                  id={item.id}
                  locale={locale}
                  country={country}
                  loading={text.loading}
                  watchOnly={active === "overview"}
                />
                {active === "overview" ? (
                  <Link
                    href={href("info") + "#where-to-watch"}
                    className="inline-block text-sm font-semibold text-primary hover:underline"
                  >
                    {text.watchDetails} <span aria-hidden>→</span>
                  </Link>
                ) : (
                  <div
                    id="film-details"
                    className="scroll-mt-4 border-t border-border pt-4"
                  >
                    <MovieOverview item={item} locale={locale} />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {(active === "overview" || active === "reviews") && (
          <section
            id="reviews"
            aria-label={text.reviews}
            className="scroll-mt-4 border-t border-border pt-5"
          >
            <Suspense
              fallback={
                <p role="status" className="text-sm text-subtle">
                  {text.loading}
                </p>
              }
            >
              <CommunityReviews
                item={item}
                locale={locale}
                country={country}
                review={review}
                stats={stats}
                user={user}
                preview={active === "overview"}
                reviewsHref={href("reviews") + "#reviews"}
              />
            </Suspense>
          </section>
        )}
        {(active === "overview" || active === "gallery") && (
          <div id="gallery" className="scroll-mt-4">
            <MovieGallery
              locale={locale}
              item={item}
              videos={videos}
              category={category}
              variant={active === "overview" ? "preview" : "full"}
              galleryHref={href("gallery") + "#gallery"}
              categoryHref={(value: "posters" | "images" | "extras") =>
                href("gallery", value) + "#gallery"
              }
            />
          </div>
        )}
      </div>
    </main>
  );
}
