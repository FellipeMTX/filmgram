import React from "react";
import { renderToReadableStream } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MovieVideo, Title } from "@/integrations/tmdb";

const images = vi.fn();
vi.mock("@/integrations/tmdb", () => ({
  getMovieImages: (...args: unknown[]) => images(...args),
}));
vi.mock("next/link", () => ({
  default: (props: React.ComponentPropsWithoutRef<"a">) => <a {...props} />,
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("./MovieMediaClient", () => ({
  VideoCards: ({ videos }: { videos: MovieVideo[] }) => (
    <div>
      {videos.map((v) => (
        <span key={v.id}>{v.name}</span>
      ))}
    </div>
  ),
  ImageGrid: () => <div>IMAGE GRID</div>,
}));
import { MovieHeroTrailers } from "./MovieHeroTrailers";
import { MovieGallery } from "./MovieGallery";

const item = {
  id: 1,
  backdrop_path: "/back.jpg",
  poster_path: null,
  title: "Film",
} as Title;
const video = (index: number, type = "Trailer"): MovieVideo => ({
  id: String(index),
  key: String(index),
  name: `Video ${index}`,
  type,
  official: true,
  iso_639_1: "en",
  published_at: null,
});
const href = (category: string) => `/?media=${category}`;
async function html(element: React.ReactElement) {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return await new Response(stream).text();
}

describe("movie media", () => {
  beforeEach(() => {
    images.mockReset().mockResolvedValue({
      posters: [{ file_path: "/poster.jpg" }],
      backdrops: [],
    });
  });
  for (const count of [0, 1, 3, 4]) {
    it(`shows at most three hero trailers and the all link only above three (${count})`, async () => {
      const result = await html(
        <MovieHeroTrailers
          locale="en"
          item={item}
          videos={Promise.resolve(
            Array.from({ length: count }, (_, i) => video(i)),
          )}
          galleryHref="/gallery"
          trailersHref="/trailers"
        />,
      );
      expect(result.includes("View all trailers")).toBe(count > 3);
      expect(result.includes("View gallery")).toBe(true);
      expect(result.includes("Video 3")).toBe(false);
      if (count) expect(result).toContain("Video 0");
    });
  }
  it("shows all trailers separately from teasers", async () => {
    images.mockResolvedValue({ posters: [], backdrops: [] });
    const result = await html(
      <MovieGallery
        locale="en"
        item={item}
        variant="full"
        category="trailers"
        videos={Promise.resolve([
          video(0),
          video(1),
          video(2),
          video(3),
          video(4, "Teaser"),
        ])}
        galleryHref="/gallery"
        categoryHref={href}
      />,
    );
    expect(result).toContain("Video 3");
    expect(result).not.toContain("Video 4");
    expect(result).toContain("Trailers");
  });
  it("handles unavailable direct trailer categories", async () => {
    images.mockResolvedValue({ posters: [], backdrops: [] });
    const result = await html(
      <MovieGallery
        locale="en"
        item={item}
        variant="full"
        category="trailers"
        videos={Promise.resolve([video(0)])}
        galleryHref="/gallery"
        categoryHref={href}
      />,
    );
    expect(result).toContain("No media available in this category.");
    expect(result).not.toContain('href="/?media=trailers"');
  });
  it("renders a requested video category when images never resolve", async () => {
    images.mockReturnValue(new Promise(() => {}));
    const stream = await renderToReadableStream(
      <MovieGallery
        locale="en"
        item={item}
        variant="full"
        category="extras"
        videos={Promise.resolve([video(0, "Teaser")])}
        galleryHref="/gallery"
        categoryHref={href}
      />,
    );
    const result = await new Response(stream).text();
    expect(result).toContain("Video 0");
  });
  it("renders a requested image category when videos never resolve", async () => {
    images.mockResolvedValue({
      posters: [{ file_path: "/a.jpg" }],
      backdrops: [],
    });
    let resolveVideos!: (videos: MovieVideo[]) => void;
    const delayedVideos = new Promise<MovieVideo[]>((resolve) => {
      resolveVideos = resolve;
    });
    const stream = await renderToReadableStream(
      <MovieGallery
        locale="en"
        item={item}
        variant="full"
        category="posters"
        videos={delayedVideos}
        galleryHref="/gallery"
        categoryHref={href}
      />,
    );
    const reader = stream.getReader();
    let output = "";
    while (!output.includes("IMAGE GRID")) {
      const chunk = await reader.read();
      if (chunk.done) break;
      output += new TextDecoder().decode(chunk.value);
    }
    expect(output).toContain("IMAGE GRID");
    resolveVideos([]);
    while (!(await reader.read()).done) {
      /* finish the stream */
    }
  });
  it("keeps gallery navigation available before the default category resolves", async () => {
    let resolveImages!: (result: { posters: []; backdrops: [] }) => void;
    images.mockReturnValue(
      new Promise((resolve) => {
        resolveImages = resolve;
      }),
    );
    const stream = await renderToReadableStream(
      <MovieGallery
        locale="en"
        item={item}
        variant="full"
        videos={Promise.resolve([video(0, "Teaser")])}
        galleryHref="/gallery"
        categoryHref={href}
      />,
    );
    const reader = stream.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toContain('href="/?media=extras"');
    resolveImages({ posters: [], backdrops: [] });
    let output = first;
    for (
      let chunk = await reader.read();
      !chunk.done;
      chunk = await reader.read()
    ) {
      output += new TextDecoder().decode(chunk.value);
    }
    expect(output).toContain('href="/?media=extras" aria-current="page"');
  });
  it("streams preview images before delayed videos", async () => {
    images.mockResolvedValue({
      posters: [{ file_path: "/a.jpg" }],
      backdrops: [],
    });
    let resolveVideos!: (videos: MovieVideo[]) => void;
    const delayedVideos = new Promise<MovieVideo[]>((resolve) => {
      resolveVideos = resolve;
    });
    const stream = await renderToReadableStream(
      <MovieGallery
        locale="en"
        item={item}
        variant="preview"
        videos={delayedVideos}
        galleryHref="/gallery"
        categoryHref={href}
      />,
    );
    const reader = stream.getReader();
    let output = "";
    while (!output.includes("/?media=posters")) {
      const chunk = await reader.read();
      if (chunk.done) break;
      output += new TextDecoder().decode(chunk.value);
    }
    expect(output).toContain("/?media=posters");
    resolveVideos([]);
    while (!(await reader.read()).done) {
      /* finish the stream */
    }
  });
  it("keeps videos available when images fail", async () => {
    images.mockRejectedValue(new Error("failed"));
    const result = await html(
      <MovieGallery
        locale="en"
        item={item}
        variant="preview"
        videos={Promise.resolve([video(0, "Teaser")])}
        galleryHref="/gallery"
        categoryHref={href}
      />,
    );
    expect(result).toContain("Gallery is temporarily unavailable.");
    expect(result).toContain("/?media=extras");
  });
  it("distinguishes failed video loading from an empty category", async () => {
    images.mockResolvedValue({ posters: [], backdrops: [] });
    const result = await html(
      <MovieGallery
        locale="en"
        item={item}
        variant="full"
        category="extras"
        videos={Promise.reject(new Error("failed"))}
        galleryHref="/gallery"
        categoryHref={href}
      />,
    );
    expect(result).toContain("Gallery is temporarily unavailable.");
    expect(result).not.toContain("No media available in this category.");
  });
});
