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

import { TitleActions } from "@/features/catalog/TitleActions";
import { Rail } from "@/features/catalog/Rail";
import { MediaImage } from "@/features/catalog/MediaImage";
import { PersonCard } from "@/features/people/PersonCard";

import { movieReviewId } from "@/features/catalog/movie-section-links";
import { MovieReviews } from "@/features/social/MovieReviews";
import { MovieDetail } from "@/features/catalog/MovieDetail";
import { getTitleActionsData } from "@/features/catalog/title-actions-data";
export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; mediaType: string; id: string }>;
  searchParams: Promise<{
    review?: string | string[];
    tab?: string | string[];
    country?: string | string[];
    media?: string | string[];
  }>;
}) {
  const { locale, mediaType, id } = await params;
  if (!["movie", "tv"].includes(mediaType) || !/^\d+$/.test(id)) notFound();
  const query = await searchParams;
  const reviewParam =
    typeof query.review === "string" ? query.review : undefined;
  const item = await getDetail(locale, mediaType as MediaType, Number(id));
  if (!item) notFound();
  if (mediaType === "movie") {
    return (
      <MovieDetail
        item={item}
        locale={locale}
        review={Array.isArray(query.review) ? query.review[0] : reviewParam}
        country={typeof query.country === "string" ? query.country : undefined}
        tab={typeof query.tab === "string" ? query.tab : undefined}
        media={typeof query.media === "string" ? query.media : undefined}
      />
    );
  }
  const review = movieReviewId(reviewParam);
  const t = messages(locale),
    user = await currentUser(),
    db = await supabase();
  const { states, playlists } = await getTitleActionsData(
    db,
    "tv",
    Number(id),
    user?.id,
  );
  const [countResult, statsResult] = db
    ? await Promise.all([
        db.rpc("title_like_count", {
          p_media_type: "tv",
          p_tmdb_id: Number(id),
        }),
        db
          .rpc("title_review_stats", {
            p_media_type: "tv",
            p_tmdb_id: Number(id),
          })
          .single(),
      ])
    : [null, null];
  const likes = Number(countResult?.data || 0);
  const stats = statsResult?.data;
  const poster = imageUrl(item.poster_path);
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

      <div className={cn(container, "pt-[35px] pb-20 mobile:pt-[30px]")}>
        <MovieReviews
          mediaType="tv"
          locale={locale}
          tmdbId={Number(id)}
          reviewId={review}
          title={titleName(item)}
          year={year(item)}
          posterUrl={poster ?? null}
          backdropUrl={imageUrl(item.backdrop_path, "w780") ?? null}
          titleHref={`/${locale}/title/tv/${id}`}
          average={Number(stats?.average_rating || 0)}
          count={Number(stats?.review_count || 0)}
          userId={user?.id ?? null}
        />
      </div>
    </main>
  );
}
