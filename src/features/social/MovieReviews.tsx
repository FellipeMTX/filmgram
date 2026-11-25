import { supabase } from "@/integrations/supabase";
import { loadMovieReviewPage } from "./movie-review-page";
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
            .select("id,rating,body,body_document,youtube_video_id")
            .eq("media_type", "movie")
            .eq("tmdb_id", props.tmdbId)
            .eq("user_id", props.userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (own.error) throw own.error;
    result = { page, own: own.data };
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
      key={[props.locale, props.tmdbId, props.reviewId, props.userId].join(":")}
      {...props}
      initialPage={result.page}
      own={result.own}
    />
  );
}
