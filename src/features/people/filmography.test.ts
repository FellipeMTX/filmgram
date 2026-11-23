import { describe, expect, it } from "vitest";
import {
  filterAndPaginateWorks,
  normalizePersonWorks,
  validCreditDate,
} from "./filmography";
import type { PersonWork } from "./filmography";

describe("filmography", () => {
  it("merges cast and crew without splitting roles, separates types, enriches and sorts", () => {
    const cast = [
      {
        id: 1,
        media_type: "movie",
        title: "Example",
        character: "A / B",
        release_date: null,
        poster_path: null,
      },
      {
        id: 1,
        media_type: "movie",
        title: "Example",
        character: "A / B",
        release_date: "2020-02-01",
        poster_path: "/poster",
      },
      { id: 1, media_type: "movie", title: "Example", character: "C" },
      {
        id: 1,
        media_type: "tv",
        name: "Series",
        character: null,
        first_air_date: "2024-01-01",
      },
      {
        id: 2,
        media_type: "movie",
        title: "Unknown date",
        release_date: "2024-02-30",
      },
      { id: 0, media_type: "movie", title: "Invalid id" },
      { id: 3, media_type: "person", name: "Invalid type" },
      { id: 4, media_type: "tv", name: " " },
      { id: 1, media_type: "movie", character: "Role without repeated title" },
    ];
    const crew = [
      { id: 1, media_type: "movie", title: "Example", job: "Director" },
      {
        id: 1,
        media_type: "movie",
        title: "Example",
        job: "Executive Producer",
      },
      { id: 1, media_type: "movie", title: "Example", job: "Director" },
      {
        id: 5,
        media_type: "movie",
        title: "Crew only",
        job: "Assistant Director",
        release_date: "2025-01-01",
      },
    ];
    const works = normalizePersonWorks(cast, crew);
    expect(works.map((work) => [work.media_type, work.id])).toEqual([
      ["movie", 5],
      ["tv", 1],
      ["movie", 1],
      ["movie", 2],
    ]);
    expect(works[2]).toMatchObject({
      acting: true,
      directing: true,
      characters: ["A / B", "C", "Role without repeated title"],
      jobs: ["Director", "Executive Producer"],
      poster_path: "/poster",
      release_date: "2020-02-01",
    });
    expect(works[0]).toMatchObject({
      acting: false,
      directing: false,
      jobs: ["Assistant Director"],
    });
    expect(validCreditDate("2024-02-30")).toBe("");
  });

  it("does not create an entry from a crew credit without a job", () => {
    const works = normalizePersonWorks(
      [],
      [
        { id: 6, media_type: "movie", title: "No job", job: null },
        { id: 7, media_type: "movie", title: "Empty job", job: "  " },
      ],
    );
    expect(works).toEqual([]);
  });

  it("filters before pagination, clamps pages, and handles invalid and array query values", () => {
    const works: PersonWork[] = Array.from({ length: 51 }, (_, i) => ({
      id: i + 1,
      media_type: i < 30 ? "movie" : "tv",
      title: "Work",
      characters: [],
      jobs: [],
      acting: i % 2 === 0,
      directing: i % 3 === 0,
    }));
    const result = filterAndPaginateWorks(works, {
      type: "movie",
      activity: "acting",
      page: "2",
    });
    expect(result).toMatchObject({
      total: 15,
      totalPages: 1,
      page: 1,
      type: "movie",
      activity: "acting",
    });
    expect(result.works).toHaveLength(15);
    const second = filterAndPaginateWorks(works, { page: "2" });
    expect(second).toMatchObject({ total: 51, page: 2, totalPages: 3 });
    expect(second.works).toHaveLength(24);
    expect(
      filterAndPaginateWorks(works, {
        type: ["tv"],
        activity: ["acting"],
        page: ["2"],
      }),
    ).toMatchObject({ type: "all", activity: "all", page: 1 });
    expect(filterAndPaginateWorks([], { page: "999" })).toMatchObject({
      total: 0,
      page: 1,
      totalPages: 1,
    });
  });
});
