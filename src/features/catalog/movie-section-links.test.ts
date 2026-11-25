import { describe, expect, it } from "vitest";
import {
  movieCategory,
  resolveMovieLocation,
  titleReviewHref,
} from "./movie-section-links";

const review = "A43E8B2B-2A2B-42A0-A687-A43BC5B3FB51";

describe("movie section links", () => {
  it("normalizes a fragment-only review and resolves it ahead of a legacy tab", () => {
    expect(
      resolveMovieLocation({ tab: "crew", fragment: "review-" + review }),
    ).toMatchObject({
      active: "reviews",
      target: "review-" + review.toLowerCase(),
      tabReplacement: "reviews",
      saveReviewQuery: true,
    });
  });

  it("lets an explicit information anchor override a legacy section target", () => {
    expect(
      resolveMovieLocation({ tab: "watch", fragment: "releases" }),
    ).toMatchObject({
      active: "info",
      target: "releases",
      tabReplacement: "info",
    });
  });

  it("preserves the selected country when constructing a direct review link", () => {
    const href = titleReviewHref(
      "/pt-BR/title/movie/1726?country=CY#gallery",
      review,
    );
    const url = new URL(href, "https://filmgram.local");
    expect(url.pathname).toBe("/pt-BR/title/movie/1726");
    expect(url.searchParams.get("country")).toBe("CY");
    expect(url.searchParams.get("review")).toBe(review);
    expect(url.hash).toBe("#review-" + review);
  });

  it("recognizes the all-trailers gallery URL", () => {
    expect(movieCategory("trailers")).toBe("trailers");
    expect(
      resolveMovieLocation({ tab: "gallery", fragment: "gallery" }),
    ).toMatchObject({
      active: "gallery",
      target: "gallery",
      tabReplacement: null,
    });
  });
});
