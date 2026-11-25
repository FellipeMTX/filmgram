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
      />
    );
  }
  const review =
    reviewParam &&
    /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(reviewParam)
      ? reviewParam
      : null;
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
  const { states, playlists } = await getTitleActionsData(
    db,
    "tv",
    Number(id),
    user?.id,
  );
  let followedAuthors: string[] = [];
  let likes = 0;
  let reviewLikes: Record<
    string,
    { count: number; liked: boolean; commentCount: number }
  > = {};
  if (db) {
    const [reviewsResult, countResult] = await Promise.all([
      db.rpc("title_reviews_followed_first", {
        p_media_type: mediaType,
        p_tmdb_id: Number(id),
        p_highlighted_review_id: review,
        p_limit: 1000,
      }),
      db.rpc("title_like_count", {
        p_media_type: mediaType,
        p_tmdb_id: Number(id),
      }),
    ]);
    if (reviewsResult.error) throw reviewsResult.error;
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
    if (review && !reviews.some((row) => row.id === review)) {
      const target = await db
        .from("reviews")
        .select(
          "id,rating,body,body_document,youtube_video_id,user_id,created_at,profiles!reviews_user_id_fkey(display_name,handle,avatar_url)",
        )
        .eq("media_type", mediaType)
        .eq("tmdb_id", Number(id))
        .eq("id", review)
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
      const followed = await db
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);
      if (followed.error) throw followed.error;
      followedAuthors = followed.data.map((row) => row.following_id);
    }
  }
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
    </main>
  );
}
