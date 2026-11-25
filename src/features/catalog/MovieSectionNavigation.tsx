"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { legacyMovieSection, movieReviewId } from "./movie-section-links";

export function MovieSectionNavigation({
  legacyTab,
  review,
}: {
  legacyTab?: string;
  review?: string;
}) {
  const router = useRouter();
  const lastTarget = useRef<string | null>(null);
  const pendingQuery = useRef<string | null>(null);

  useEffect(() => {
    function navigate() {
      const url = new URL(window.location.href);
      const query = url.searchParams.get("review");
      const fragment = url.hash.slice(1);
      const fragmentIsReview = fragment.startsWith("review-");
      const id = movieReviewId(
        query ?? (fragmentIsReview ? fragment.slice(7) : null),
      );

      // The server can't read a fragment. Bring a fragment-only review into the
      // query so the server can fetch it even when it's outside the first page.
      if (query === null && id && fragmentIsReview) {
        url.searchParams.set("review", id);
        const href = url.pathname + url.search + url.hash;
        if (pendingQuery.current !== href) {
          pendingQuery.current = href;
          router.replace(href, { scroll: false });
        }
        return;
      }
      pendingQuery.current = null;

      let target = id
        ? "review-" + id
        : query !== null || fragmentIsReview
          ? "reviews"
          : fragment || legacyMovieSection(url.searchParams.get("tab"));

      if (!target) {
        lastTarget.current = null;
        return;
      }
      const navigationKey = url.pathname + ":" + target;
      if (lastTarget.current === navigationKey) return;
      let element = document.getElementById(target);
      if (id) {
        const content = document.querySelector("[data-movie-reviews-target]");
        if (
          content?.getAttribute("data-movie-reviews-target") !== id ||
          !content.querySelector("[data-movie-reviews-ready]")
        )
          return;
        if (!element) {
          target = "reviews";
          element = document.getElementById(target);
        }
      }
      if (!element) return;

      lastTarget.current = navigationKey;
      const newFragment = "#" + target;
      if (url.hash !== newFragment) {
        const oldURL = url.href;
        url.hash = target;
        window.history.replaceState(window.history.state, "", url);
        window.dispatchEvent(
          new HashChangeEvent("hashchange", { oldURL, newURL: url.href }),
        );
      }
      element.scrollIntoView({ block: "start" });
    }

    let frame = 0;
    function schedule() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(navigate);
    }
    const main = document.querySelector("main");
    const observer = new MutationObserver(schedule);
    if (main)
      observer.observe(main, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-movie-reviews-target"],
      });
    window.addEventListener("hashchange", schedule);
    window.addEventListener("popstate", schedule);
    schedule();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("hashchange", schedule);
      window.removeEventListener("popstate", schedule);
    };
  }, [legacyTab, review, router]);

  return null;
}
