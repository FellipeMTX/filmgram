"use server";

import {
  loadTitleReviewPage,
  type TitleReviewCursor,
} from "./title-review-page";

export type MovieReviewCursor = TitleReviewCursor;

export async function loadMovieReviewPage(
  tmdbId: number,
  selectedId: string | null,
  cursor?: MovieReviewCursor,
  preview = false,
) {
  return loadTitleReviewPage("movie", tmdbId, selectedId, cursor, preview);
}
