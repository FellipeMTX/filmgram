import { container, eyebrow } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
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
import { submitReview, deleteReview } from "@/features/social/actions";
import { TitleActions } from "@/features/catalog/TitleActions";
import { Rail } from "@/features/catalog/Rail";
import { MediaImage } from "@/features/catalog/MediaImage";
import { PersonCard } from "@/features/people/PersonCard";
import { ReviewDiscussion } from "@/features/social/ReviewDiscussion";
import { ReviewPost } from "@/components/ReviewPost";
import { getReviewLikeSummaries } from "@/features/social/review-discussion-queries";

export default async function Detail({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; mediaType: string; id: string }>;
  searchParams: Promise<{ review?: string }>;
}) {
  const { locale, mediaType, id } = await params;
  if (!["movie", "tv"].includes(mediaType) || !/^\d+$/.test(id)) notFound();
  const { review } = await searchParams;
  const item = await getDetail(locale, mediaType as MediaType, Number(id));
  if (!item) notFound();
  const t = messages(locale),
    user = await currentUser(),
    db = await supabase();
  let reviews: {
    id: string;
    rating: number;
    body: string | null;
    youtube_video_id: string | null;
    user_id: string;
    created_at: string;
    profiles: {
      display_name: string;
      handle: string;
      avatar_url: string | null;
    } | null;
  }[] = [];
  let myReview: Pick<
    (typeof reviews)[number],
    "id" | "rating" | "body" | "youtube_video_id"
  > | null = null;
  let playlists: { id: string; name: string }[] = [];
  const states: Record<string, boolean> = {};
  let likes = 0;
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
    const [reviewsResult, countResult, ownReviewResult] = await Promise.all([
      db.rpc("title_reviews_followed_first", {
        p_media_type: mediaType,
        p_tmdb_id: Number(id),
        p_highlighted_review_id: highlightedReview,
        p_limit: 1000,
      }),
      db.rpc("title_like_count", {
        p_media_type: mediaType,
        p_tmdb_id: Number(id),
      }),
      user
        ? db
            .from("reviews")
            .select("id,rating,body,youtube_video_id")
            .eq("media_type", mediaType)
            .eq("tmdb_id", Number(id))
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (reviewsResult.error) throw reviewsResult.error;
    if (ownReviewResult.error) throw ownReviewResult.error;
    myReview = ownReviewResult.data;
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
          "id,rating,body,youtube_video_id,user_id,created_at,profiles!reviews_user_id_fkey(display_name,handle,avatar_url)",
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
        db.from("playlists").select("id,name").eq("user_id", user.id),
      ]);
      states.favorites = !!f.data;
      states.watched = !!w.data;
      states.title_likes = !!l.data;
      playlists = (p.data || []) as unknown as typeof playlists;
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
              <span>★</span> {item.vote_average?.toFixed(1) || "—"}{" "}
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
      {directors.length > 0 && (
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
      <div
        className={cn(
          container,
          "grid grid-cols-2 gap-[60px] pt-[35px] pb-20 mobile:grid-cols-1 mobile:gap-[35px] mobile:pt-[30px] [&_section]:min-w-0 [&_h2]:mt-0 [&_h2]:mb-5 [&_h2]:font-display [&_h2]:text-[26px] [&_h2]:font-semibold",
        )}
      >
        <section>
          <h2>{t.yourRating}</h2>
          {user ? (
            <form
              action={submitReview}
              className="flex flex-col gap-4 [&_[data-slot=native-select-wrapper]]:w-full [&_label]:flex [&_label]:flex-col [&_label]:gap-[9px] [&_label]:font-bold [&_button]:self-start"
            >
              <input type="hidden" name="media_type" value={mediaType} />
              <input type="hidden" name="tmdb_id" value={id} />
              <label>
                {t.yourRating}
                <NativeSelect
                  name="rating"
                  required
                  defaultValue={myReview?.rating || ""}
                >
                  <option value="" disabled>
                    ☆ ☆ ☆ ☆ ☆
                  </option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {"★".repeat(n)} ({n}/5)
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label>
                {t.writeReview}
                <Textarea
                  name="body"
                  rows={4}
                  defaultValue={myReview?.body || ""}
                  placeholder={t.writeReview}
                />
              </label>
              <label>
                {t.addVideo}
                <Input
                  name="youtube"
                  type="url"
                  defaultValue={
                    myReview?.youtube_video_id
                      ? `https://www.youtube.com/watch?v=${myReview.youtube_video_id}`
                      : ""
                  }
                  placeholder="https://youtube.com/watch?v=…"
                />
              </label>
              <Button type="submit">{t.publish}</Button>
            </form>
          ) : (
            <p className="text-muted-foreground">{t.signInPrompt}</p>
          )}
        </section>
        <section>
          <h2>{t.communityReviews}</h2>
          {reviews.length ? (
            reviews.map((r) => (
              <div className="mb-6" key={r.id}>
                <ReviewPost
                  reviewId={r.id}
                  tmdbId={Number(id)}
                  locale={locale}
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
                      {user?.id === r.user_id && (
                        <form action={deleteReview} className="mt-3">
                          <input type="hidden" name="id" value={r.id} />
                          <Button type="submit" variant="outline">
                            {t.deleteReview}
                          </Button>
                        </form>
                      )}
                    </>
                  }
                />
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">{t.noReviews}</p>
          )}
        </section>
      </div>
    </main>
  );
}
