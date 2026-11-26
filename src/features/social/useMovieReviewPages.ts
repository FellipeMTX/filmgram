"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadTitleReviewPage } from "./title-review-page";

type Page = Awaited<ReturnType<typeof loadTitleReviewPage>>;

// The initial page and all its cursors belong to one ranking generation.
export function useMovieReviewPages(
  initialPage: Page,
  tmdbId: number,
  reviewId: string | null,
  preview = false,
  mediaType: "movie" | "tv" = "movie",
) {
  const [page, setPage] = useState(initialPage);
  const [first, setFirst] = useState(initialPage);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"refresh" | "more" | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const firstPage = useRef(initialPage);

  useEffect(() => {
    generation.current++;
    busy.current = false;
    firstPage.current = initialPage;
    // A server refresh replaces the entire cursor generation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(initialPage);
    setFirst(initialPage);
    setPending(false);
    setError(null);
  }, [initialPage]);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const fresh = await loadTitleReviewPage(
        mediaType,
        tmdbId,
        reviewId,
        undefined,
        preview,
      );
      if (current === generation.current) {
        firstPage.current = fresh;
        setFirst(fresh);
        setPage(fresh);
      }
    } catch {
      if (current === generation.current) {
        setPage(firstPage.current);
        setError("refresh");
      }
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setPending(false);
      }
    }
  }, [mediaType, tmdbId, reviewId, preview]);

  const loadMore = useCallback(async () => {
    if (!page.next || busy.current || error === "refresh") return;
    const current = generation.current;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const more = await loadTitleReviewPage(
        mediaType,
        tmdbId,
        reviewId,
        page.next,
        preview,
      );
      if (current !== generation.current) return;
      setPage((previous) => ({
        ...more,
        reviews: [
          ...new Map(
            [...previous.reviews, ...more.reviews].map((row) => [row.id, row]),
          ).values(),
        ],
        summaries: { ...previous.summaries, ...more.summaries },
        selectedOutsidePage: previous.selectedOutsidePage,
      }));
    } catch {
      if (current === generation.current) setError("more");
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setPending(false);
      }
    }
  }, [page.next, mediaType, tmdbId, reviewId, preview, error]);

  return { page, first, pending, error, refresh, loadMore };
}
