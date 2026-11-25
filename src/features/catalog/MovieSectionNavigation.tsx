"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { resolveMovieLocation } from "./movie-section-links";

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
      const fragment = url.hash.slice(1);
      const {
        reviewId: id,
        target: initialTarget,
        tabReplacement,
        saveReviewQuery,
        legacyTarget,
      } = resolveMovieLocation({
        tab: url.searchParams.get("tab"),
        review: url.searchParams.get("review"),
        fragment,
      });
      if (saveReviewQuery || tabReplacement) {
        if (saveReviewQuery && id) url.searchParams.set("review", id);
        if (tabReplacement) {
          if (!fragment && legacyTarget) url.hash = legacyTarget;
          url.searchParams.set("tab", tabReplacement);
        }
        const href = url.pathname + url.search + url.hash;
        if (pendingQuery.current !== href) {
          pendingQuery.current = href;
          router.replace(href, { scroll: false });
        }
        return;
      }
      pendingQuery.current = null;

      let target = initialTarget;

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
