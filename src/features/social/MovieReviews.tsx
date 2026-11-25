import { supabase } from "@/integrations/supabase";
import { loadMovieReviewPage } from "./movie-review-page";
import { getReviewLikeSummaries } from "./review-discussion-queries";
import {
  MovieReviewsClient,
  type MovieReviewsProps,
} from "./MovieReviewsClient";

export async function MovieReviews(props: MovieReviewsProps) {
  let result: {
    page: Awaited<ReturnType<typeof loadMovieReviewPage>>;
    own: Awaited<
      ReturnType<typeof import("./title-review-context").loadTitleReviewContext>
    >["own"];
  } | null = null;
  try {
    const db = await supabase();
    if (!db) throw new Error("Database unavailable");
    const [page, own] = await Promise.all([
      loadMovieReviewPage(props.tmdbId, props.reviewId),
      props.userId
        ? db
            .from("reviews")
            .select(
              "id,rating,body,body_document,youtube_video_id,user_id,created_at,profiles!reviews_user_id_fkey(display_name,handle,avatar_url)",
            )
            .eq("media_type", "movie")
            .eq("tmdb_id", props.tmdbId)
            .eq("user_id", props.userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (own.error) throw own.error;
    const ownReview = own.data;
    if (
      !props.preview &&
      ownReview &&
      !page.reviews.some((row) => row.id === ownReview.id)
    ) {
      page.reviews.push({
        ...ownReview,
        display_name: ownReview.profiles?.display_name ?? null,
        handle: ownReview.profiles?.handle ?? null,
        avatar_url: ownReview.profiles?.avatar_url ?? null,
        followed: false,
      });
      Object.assign(
        page.summaries,
        await getReviewLikeSummaries(db, [ownReview.id]),
      );
    }
    result = { page, own: ownReview };
  } catch {}
  if (!result)
    return (
      <MovieReviewsClient
        key={props.tmdbId + ":error"}
        {...props}
        initialError
        initialPage={{ reviews: [], summaries: {}, next: null }}
        own={null}
      />
    );
  return (
    <MovieReviewsClient
      key={[
        props.locale,
        props.tmdbId,
        props.reviewId,
        props.userId,
        props.preview,
      ].join(":")}
      {...props}
      initialPage={result.page}
      own={result.own}
    />
  );
}
