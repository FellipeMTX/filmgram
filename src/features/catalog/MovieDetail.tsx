import { Suspense } from "react";
import { FilmgramRating } from "@/components/FilmgramRating";
import { MovieReviews } from "@/features/social/MovieReviews";
import { messages } from "@/i18n/messages";
import { currentUser, supabase } from "@/integrations/supabase";
import {
  getMovieVideos,
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
import { movieReviewId } from "./movie-section-links";
import { MovieVideos } from "./MovieVideos";
import { TitleActions } from "./TitleActions";
import { getTitleActionsData } from "./title-actions-data";

const labels = {
  en: {
    loading: "Loading…",
    videoError: "The video list is temporarily unavailable.",
    reviews: "Community reviews",
  },
  "pt-BR": {
    loading: "Carregando…",
    videoError: "A lista de vídeos está temporariamente indisponível.",
    reviews: "Resenhas da comunidade",
  },
  es: {
    loading: "Cargando…",
    videoError: "La lista de vídeos no está disponible temporalmente.",
    reviews: "Reseñas de la comunidad",
  },
};

type MovieLabels = (typeof labels)[keyof typeof labels];
type MovieStats = { average_rating: number; review_count: number } | null;

async function HeroVideos({
  locale,
  item,
  text,
}: {
  locale: string;
  item: Title;
  text: MovieLabels;
}) {
  const result = await getMovieVideos(locale, item.id).then(
    (videos) => ({ videos, failed: false }),
    () => ({ videos: [], failed: true }),
  );
  return (
    <MovieVideos
      key={item.id}
      videos={result.videos}
      locale={locale}
      backdropPath={item.backdrop_path}
      unavailableMessage={result.failed ? text.videoError : undefined}
    />
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
      <small className="font-medium">Filmgram</small>
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
    <small className="font-medium text-cast-foreground">
      ♡ {Number(result?.data || 0)} {messages(locale).likes}
    </small>
  );
}

async function CommunityReviews({
  item,
  locale,
  review,
  stats,
  user,
}: {
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
        locale={locale}
        tmdbId={item.id}
        reviewId={movieReviewId(review)}
        title={titleName(item)}
        year={year(item)}
        posterUrl={imageUrl(item.poster_path) ?? null}
        backdropUrl={imageUrl(item.backdrop_path, "w780") ?? null}
        titleHref={"/" + locale + "/title/movie/" + item.id}
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
}: {
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
  const backdrop = imageUrl(item.backdrop_path, "original");
  const date = year(item);
  const genres = item.genres?.map((genre) => genre.name) || [];
  const runtime = item.runtime
    ? Math.floor(item.runtime / 60) + "h " + (item.runtime % 60) + "m"
    : "";
  const metadata = [...genres, runtime].filter(Boolean).join(" · ");

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
            "grid items-center gap-6 pt-8 pb-12 min-[801px]:grid-cols-2 min-[801px]:gap-8 min-[801px]:pt-12 min-[801px]:pb-16",
          )}
        >
          <div className="min-w-0 space-y-3">
            <p className={eyebrow}>
              {[t.film, date].filter(Boolean).join(" · ")}
            </p>
            <h1 className="font-display text-[clamp(2.6rem,6.3vw,5.25rem)] leading-none font-bold tracking-[-.025em] [overflow-wrap:anywhere]">
              {titleName(item)}
            </h1>
            {metadata && <p className="text-sm text-detail-meta">{metadata}</p>}
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
                <small className="font-medium">TMDB</small>
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
          <div id="videos" className="min-w-0 scroll-mt-4">
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
              <HeroVideos item={item} locale={locale} text={text} />
            </Suspense>
          </div>
        </div>
      </div>
      <div
        className={cn(
          container,
          "grid min-w-0 grid-cols-1 gap-y-8 pb-28 min-[801px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
        )}
      >
        <div className="min-w-0 space-y-5 min-[801px]:pr-6 lg:pr-8">
          <div id="cast-and-crew" className="scroll-mt-4">
            <MovieCrew
              cast={item.credits?.cast || []}
              crew={item.credits?.crew || []}
              locale={locale}
            />
          </div>
          <MovieExtraPanel
            id={item.id}
            locale={locale}
            country={country}
            loading={text.loading}
          />
          <div
            id="film-details"
            className="scroll-mt-4 border-t border-border pt-4"
          >
            <MovieOverview item={item} locale={locale} />
          </div>
        </div>
        <section
          id="reviews"
          aria-label={text.reviews}
          className="min-w-0 scroll-mt-4 border-t border-border pt-5 min-[801px]:border-t-0 min-[801px]:border-l min-[801px]:pt-0 min-[801px]:pl-6 lg:pl-8"
        >
          <Suspense
            fallback={
              <>
                <h2 className="font-display text-[clamp(1.65rem,3.2vw,2.5rem)] leading-tight font-bold">
                  {text.reviews}
                </h2>
                <p role="status" className="mt-3 text-sm text-subtle">
                  {text.loading}
                </p>
              </>
            }
          >
            <CommunityReviews
              item={item}
              locale={locale}
              review={review}
              stats={stats}
              user={user}
            />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
