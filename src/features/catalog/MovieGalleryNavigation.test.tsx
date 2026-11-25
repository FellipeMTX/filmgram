import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MovieVideo } from "@/integrations/tmdb";
import { GalleryNavigation } from "./MovieGalleryNavigation";

vi.mock("next/link", () => ({
  default: (props: React.ComponentPropsWithoutRef<"a">) => <a {...props} />,
}));

const labels = {
  gallery: "Gallery",
  posters: "Posters",
  images: "Images",
  trailers: "Trailers",
  extras: "Extras",
};
const hrefs = {
  posters: "/posters",
  images: "/images",
  trailers: "/trailers",
  extras: "/extras",
};
const video = (id: number) =>
  ({ id: String(id), type: "Trailer" }) as MovieVideo;

describe("gallery navigation", () => {
  it("preserves focused links as category and trailers resolve", async () => {
    let resolveCategory!: (value: "extras") => void;
    let resolveVideos!: (value: MovieVideo[]) => void;
    const resolved = new Promise<"extras">((resolve) => {
      resolveCategory = resolve;
    });
    const videos = new Promise<MovieVideo[]>((resolve) => {
      resolveVideos = resolve;
    });
    render(
      <GalleryNavigation
        resolved={resolved}
        videos={videos}
        hrefs={hrefs}
        labels={labels}
      />,
    );
    const extras = screen.getByRole("link", { name: "Extras" });
    const posters = screen.getByRole("link", { name: "Posters" });
    extras.focus();
    await act(async () => {
      resolveVideos([0, 1, 2, 3].map(video));
    });
    const trailers = screen.getByRole("link", { name: "Trailers" });
    expect(document.activeElement).toBe(extras);
    await act(async () => {
      resolveCategory("extras");
    });
    expect(screen.getByRole("link", { name: "Extras" })).toBe(extras);
    expect(screen.getByRole("link", { name: "Posters" })).toBe(posters);
    expect(screen.getByRole("link", { name: "Trailers" })).toBe(trailers);
    expect(extras).toHaveAttribute("aria-current", "page");
    expect(document.activeElement).toBe(extras);
  });
  for (const count of [0, 1, 3, 4]) {
    it(`offers trailers only above three (${count})`, async () => {
      render(
        <GalleryNavigation
          category="posters"
          videos={Promise.resolve(
            Array.from({ length: count }, (_, i) => video(i)),
          )}
          hrefs={hrefs}
          labels={labels}
        />,
      );
      await waitFor(() =>
        expect(!!screen.queryByRole("link", { name: "Trailers" })).toBe(
          count > 3,
        ),
      );
      expect(screen.getByRole("link", { name: "Posters" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });
  }
});
