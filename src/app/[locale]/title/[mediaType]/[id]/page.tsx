import { container, eyebrow } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";
import {
  getDetail,
  imageUrl,
  titleName,
  year,
  type MediaType,
} from "@/integrations/tmdb";
import { messages } from "@/i18n/messages";
import { supabase, currentUser } from "@/integrations/supabase";
import { TitleReviewContext } from "@/features/social/TitleReviewContext";
import { TitleActions } from "@/features/catalog/TitleActions";
import { Rail } from "@/features/catalog/Rail";
import { MediaImage } from "@/features/catalog/MediaImage";
import { PersonCard } from "@/features/people/PersonCard";
import { ReviewDiscussion } from "@/features/social/ReviewDiscussion";
import { ReviewPost } from "@/components/ReviewPost";
import { getReviewLikeSummaries } from "@/features/social/review-discussion-queries";
import type { Json } from "@/types/database.generated";
import Link from "next/link";
import { Suspense } from "react";
import { FilmgramRating } from "@/components/FilmgramRating";
import { MovieOverview } from "@/features/catalog/MovieOverview";
import { MovieCrew } from "@/features/catalog/MovieCrew";
import { MovieExtraPanel } from "@/features/catalog/MovieExtraPanel";

const movieTabs = {
  en: {
    label: "Title sections",
    overview: "Overview",
    crew: "Cast and crew",
    releases: "Releases",
    videos: "Videos",
    watch: "Where to watch",
    reviews: "Reviews",
  },
  "pt-BR": {
    label: "Seções da ficha",
    overview: "Visão geral",
    crew: "Elenco e equipe",
    releases: "Lançamentos",
    videos: "Vídeos",
    watch: "Onde assistir",
    reviews: "Resenhas",
  },
  es: {
    label: "Secciones de la ficha",
    overview: "Vista general",
    crew: "Reparto y equipo",
    releases: "Estrenos",
    videos: "Vídeos",
    watch: "Dónde ver",
    reviews: "Reseñas",
  },
};

export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; mediaType: string; id: string }>;
  searchParams: Promise<{
    review?: string | string[];
    tab?: string | string[];
    country?: string | string[];
  }>;
}) {
  const { locale, mediaType, id } = await params;
  if (!["movie", "tv"].includes(mediaType) || !/^\d+$/.test(id)) notFound();
  const query = await searchParams;
  const review =
    typeof query.review === "string" &&
    /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(query.review)
      ? query.review
      : undefined;
  const tab = typeof query.tab === "string" ? query.tab : undefined;
  const country = typeof query.country === "string" ? query.country : undefined;
  const allowedTabs = [
    "overview",
    "crew",
    "releases",
    "videos",
    "watch",
    "reviews",
  ] as const;
  type MovieTab = (typeof allowedTabs)[number];
  const activeTab: MovieTab = review
    ? "reviews"
    : allowedTabs.includes(tab as MovieTab)
      ? (tab as MovieTab)
      : "overview";
  const tabLabels = movieTabs[locale as keyof typeof movieTabs] || movieTabs.en;
  const item = await getDetail(locale, mediaType as MediaType, Number(id));
  if (!item) notFound();
  const t = messages(locale),
    user = await currentUser(),
    db = await supabase();
  let reviews: {
    id: string;
    rating: number;
    body: string | null;
    body_document: Json | null;
    youtube_video_id: string | null;
    user_id: string;
    created_at: string;
    profiles: {
      display_name: string;
      handle: string;
      avatar_url: string | null;
    } | null;
  }[] = [];
  let playlists: { id: string; name: string; contains: boolean }[] = [];
  let followedAuthors: string[] = [];
  const states: Record<string, boolean> = {};
  let likes = 0;
  let filmgramStats: { review_count: number; average_rating: number } | null =
    null;
  let reviewLikes: Record<
    string,
    { count: number; liked: boolean; commentCount: number }
  > = {};
  if (db) {
    const highlightedReview =
      typeof review === "string" &&
      /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(review)
        ? review
        : null;
    const [reviewsResult, countResult, statsResult] = await Promise.all([
      mediaType === "tv" || activeTab === "reviews"
        ? db.rpc("title_reviews_followed_first", {
            p_media_type: mediaType,
            p_tmdb_id: Number(id),
            p_highlighted_review_id: highlightedReview,
            p_limit: 1000,
          })
        : Promise.resolve({ data: [], error: null }),
      db.rpc("title_like_count", {
        p_media_type: mediaType,
        p_tmdb_id: Number(id),
      }),
      db
        .rpc("title_review_stats", {
          p_media_type: mediaType,
          p_tmdb_id: Number(id),
        })
        .single(),
    ]);
    if (reviewsResult.error) throw reviewsResult.error;
    if (statsResult.error) throw statsResult.error;
    filmgramStats = statsResult.data;
    reviews = reviewsResult.data.map((row) => ({
      ...row,
      profiles:
        row.handle && row.display_name
          ? {
              display_name: row.display_name,
              handle: row.handle,
              avatar_url: row.avatar_url,
            }
          : null,
    }));
    // PostgREST can truncate the extra deep-link row after the usual 1,000.
    if (
      highlightedReview &&
      !reviews.some((row) => row.id === highlightedReview)
    ) {
      const target = await db
        .from("reviews")
        .select(
          "id,rating,body,body_document,youtube_video_id,user_id,created_at,profiles!reviews_user_id_fkey(display_name,handle,avatar_url)",
        )
        .eq("media_type", mediaType)
        .eq("tmdb_id", Number(id))
        .eq("id", highlightedReview)
        .maybeSingle();
      if (target.error) throw target.error;
      if (target.data) reviews.push(target.data);
    }
    reviewLikes = await getReviewLikeSummaries(
      db,
      reviews.map((review) => review.id),
    );
    likes = Number(countResult.data || 0);
    if (user) {
      const followedResult =
        mediaType === "tv" || activeTab === "reviews"
          ? await db
              .from("follows")
              .select("following_id")
              .eq("follower_id", user.id)
          : { data: [], error: null };
      if (followedResult.error) throw followedResult.error;
      followedAuthors = followedResult.data.map((row) => row.following_id);
      const [f, w, l, p] = await Promise.all([
        db
          .from("favorites")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("media_type", mediaType)
          .eq("tmdb_id", Number(id))
          .maybeSingle(),
        db
          .from("watched")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("media_type", mediaType)
          .eq("tmdb_id", Number(id))
          .maybeSingle(),
        db
          .from("title_likes")
          .select("user_id")
          .eq("user_id", user.id)
          .eq("media_type", mediaType)
          .eq("tmdb_id", Number(id))
          .maybeSingle(),
        db
          .from("playlists")
          .select("id,name,playlist_items(id)")
          .eq("user_id", user.id)
          .eq("playlist_items.media_type", mediaType)
          .eq("playlist_items.tmdb_id", Number(id))
          .order("name")
          .order("id"),
      ]);
      states.favorites = !!f.data;
      states.watched = !!w.data;
      states.title_likes = !!l.data;
      if (f.error) throw f.error;
      if (p.error) throw p.error;
      playlists = p.data.map((row) => ({
        id: row.id,
        name: row.name,
        contains: row.playlist_items.length > 0,
      }));
    }
  }
  const poster = imageUrl(item.poster_path);
  const directors =
    mediaType === "movie"
      ? [
          ...new Map(
            (item.credits?.crew || [])
              .filter(
                (person) =>
                  person.job === "Director" &&
                  Number.isSafeInteger(person.id) &&
                  person.id > 0,
              )
              .map((person) => [person.id, person]),
          ).values(),
        ]
      : [];
  return (
    <main>
      <div
        className="flex min-h-[520px] items-center bg-cover bg-center mobile:min-h-[480px] mobile:items-end mobile:bg-[position:60%_center]"
        style={{
          backgroundImage: `linear-gradient(90deg,#100e0d 4%,#100e0ddd 38%,#100e0d33),linear-gradient(0deg,#100e0d,transparent 55%),url(${imageUrl(item.backdrop_path, "original") || ""})`,
        }}
      >
        <div
          className={cn(
            container,
            "flex items-end gap-9 py-[55px] min-[701px]:items-stretch mobile:py-[110px_25px]",
          )}
        >
          <div className="grid aspect-[2/3] w-[220px] shrink-0 place-items-center overflow-hidden rounded-[5px] bg-title-placeholder text-title-muted mobile:hidden min-[701px]:relative min-[701px]:min-h-[clamp(315px,29vw,410px)] min-[701px]:w-[clamp(180px,21vw,300px)] [&_img]:h-full [&_img]:w-full [&_img]:object-cover min-[701px]:[&_img]:absolute min-[701px]:[&_img]:inset-0">
            <MediaImage
              src={poster}
              alt={`${titleName(item)} poster`}
              fallback={t.noPoster}
            />
          </div>
          <div className="min-w-0 max-w-[700px] [&_h1]:my-[15px] [&_h1]:font-display [&_h1]:text-[clamp(48px,6vw,84px)] [&_h1]:leading-none [&_h1]:font-bold [&_h1]:tracking-[-2px] [&_h1]:[overflow-wrap:anywhere] mobile:[&_h1]:text-[51px]">
            <p className={eyebrow}>
              {item.media_type === "movie" ? t.film : t.seriesOne} &nbsp; /
              &nbsp; {year(item)}
            </p>
            <h1>{titleName(item)}</h1>
            <p className="text-title-overview">
              {year(item)} {item.genres?.map((g) => ` · ${g.name}`).join("")}
              {item.runtime
                ? ` · ${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m`
                : ""}
            </p>
            <p className="text-xl font-bold [&_span]:text-primary [&_small]:text-xs [&_small]:font-medium [&_small]:text-cast-foreground">
              <span>★</span> {item.vote_average?.toFixed(1) || "—"}/10{" "}
              <small>TMDB</small>{" "}
              <small>
                {" "}
                &nbsp; · &nbsp; ♡ {likes} {t.likes}
              </small>
            </p>
            {mediaType === "movie" &&
              filmgramStats &&
              Number(filmgramStats.review_count) > 0 && (
                <p className="mt-2 text-sm">
                  <FilmgramRating
                    value={Number(filmgramStats.average_rating)}
                    locale={locale}
                  />{" "}
                  Filmgram · {filmgramStats.review_count}{" "}
                  {locale === "pt-BR"
                    ? "avaliações"
                    : locale === "es"
                      ? "valoraciones"
                      : "ratings"}
                </p>
              )}
            <p className="max-w-[550px] leading-[1.6] text-detail-meta mobile:text-sm">
              {item.overview || t.noOverview}
            </p>
            <TitleActions
              item={item}
              locale={locale}
              user={!!user}
              states={states}
              playlists={playlists}
            />
          </div>
        </div>
      </div>
      {mediaType === "movie" && (
        <div className={cn(container, "pt-6")}>
          <nav
            aria-label={tabLabels.label}
            className="flex flex-wrap gap-x-5 border-b border-border"
          >
            {allowedTabs.map((key) => (
              <Link
                key={key}
                scroll={false}
                href={
                  key === "overview"
                    ? `/${locale}/title/movie/${id}`
                    : `/${locale}/title/movie/${id}?tab=${key}`
                }
                aria-current={activeTab === key ? "page" : undefined}
                className="inline-flex min-h-11 items-center border-b-2 border-transparent py-2 text-sm font-bold text-subtle hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:text-foreground"
              >
                {tabLabels[key]}
              </Link>
            ))}
          </nav>
          <div className="pt-6 pb-6">
            {activeTab === "overview" && (
              <MovieOverview
                item={item}
                locale={locale}
                titleHref={`/${locale}/title/movie/${id}`}
              />
            )}
            {activeTab === "crew" && (
              <MovieCrew
                cast={item.credits?.cast || []}
                crew={item.credits?.crew || []}
                locale={locale}
              />
            )}
            {(activeTab === "releases" ||
              activeTab === "videos" ||
              activeTab === "watch") && (
              <Suspense
                key={activeTab}
                fallback={
                  <p role="status" className="text-subtle">
                    {locale === "pt-BR"
                      ? "Carregando…"
                      : locale === "es"
                        ? "Cargando…"
                        : "Loading…"}
                  </p>
                }
              >
                <MovieExtraPanel
                  tab={activeTab}
                  locale={locale}
                  id={Number(id)}
                  country={country}
                />
              </Suspense>
            )}
          </div>
        </div>
      )}
      {mediaType === "tv" && directors.length > 0 && (
        <section
          className={cn(container, "pt-[35px] mobile:pt-[30px]")}
          aria-labelledby="directors-heading"
        >
          <h2
            id="directors-heading"
            className="mt-0 mb-5 font-display text-[26px] font-semibold"
          >
            {t.directors}
          </h2>
          <div className="flex flex-wrap gap-[22px]">
            {directors.map((person) => (
              <div key={person.id} className="w-[120px] mobile:w-[88px]">
                <PersonCard
                  id={person.id}
                  name={person.name}
                  profilePath={person.profile_path}
                  role={t.roleDirector}
                  locale={locale}
                />
              </div>
            ))}
          </div>
        </section>
      )}
      {mediaType === "tv" && (
        <section
          className={cn(
            container,
            "pt-[35px] mobile:pt-[30px] [&_h2]:mt-0 [&_h2]:mb-5 [&_h2]:font-display [&_h2]:text-[26px] [&_h2]:font-semibold",
          )}
        >
          <h2>{t.cast}</h2>
          {item.credits?.cast?.length ? (
            <Rail
              variant="cast"
              label={t.cast}
              previous={t.previous}
              next={t.next}
            >
              {item.credits.cast.slice(0, 6).map((c) => (
                <PersonCard
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  profilePath={c.profile_path}
                  role={c.character}
                  locale={locale}
                />
              ))}
            </Rail>
          ) : (
            <p className="text-muted-foreground">{t.noCast}</p>
          )}
        </section>
      )}
      {(mediaType === "tv" || activeTab === "reviews") && (
        <div className={cn(container, "pt-[35px] pb-20 mobile:pt-[30px]")}>
          <TitleReviewContext
            locale={locale}
            mediaType={mediaType as MediaType}
            tmdbId={Number(id)}
            reviewId={null}
            titleHref={`/${locale}/title/${mediaType}/${id}`}
            onTitlePage
          >
            {reviews.length ? (
              reviews.map((r) => (
                <div className="mb-6" key={r.id}>
                  <ReviewPost
                    reviewId={r.id}
                    tmdbId={Number(id)}
                    locale={locale}
                    authorId={r.user_id}
                    viewerId={user?.id || null}
                    followed={followedAuthors.includes(r.user_id)}
                    placement="title"
                    mediaType={mediaType as MediaType}
                    author={{
                      name: r.profiles?.display_name || t.member,
                      href: r.profiles?.handle
                        ? `/${locale}/profile/${r.profiles.handle}`
                        : undefined,
                      avatarUrl: r.profiles?.avatar_url,
                    }}
                    date={new Date(r.created_at).toLocaleDateString(locale)}
                    title={titleName(item)}
                    year={year(item)}
                    rating={r.rating}
                    text={r.body || ""}
                    content={r.body_document}
                    titleHref={`/${locale}/title/${mediaType}/${id}`}
                    backdropUrl={imageUrl(item.backdrop_path, "w780")}
                    posterUrl={poster}
                    trailerUrl={
                      r.youtube_video_id
                        ? `https://www.youtube.com/watch?v=${r.youtube_video_id}`
                        : null
                    }
                    interaction={
                      <>
                        <ReviewDiscussion
                          reviewId={r.id}
                          locale={locale}
                          userId={user?.id || null}
                          initialCount={reviewLikes[r.id]?.count}
                          initialCommentCount={reviewLikes[r.id]?.commentCount}
                          initialLiked={reviewLikes[r.id]?.liked}
                        />
                      </>
                    }
                  />
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">{t.noReviews}</p>
            )}
          </TitleReviewContext>
        </div>
      )}
    </main>
  );
}
