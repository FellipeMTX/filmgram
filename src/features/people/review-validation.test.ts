import { describe, expect, it } from "vitest";
import {
  parseExpected,
  parsePersonId,
  parsePersonReview,
} from "./review-validation";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values = {
    person_id: "3223",
    rating: "5",
    body: " hello ",
    works: '[{"media_type":"movie","tmdb_id":1726}]',
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
describe("person review validation", () => {
  it("accepts optional text and stable work keys", () => {
    expect(parsePersonReview(form())).toEqual({
      personId: 3223,
      rating: 5,
      body: "hello",
      works: [{ media_type: "movie", tmdb_id: 1726 }],
      expected: null,
    });
    expect(
      parsePersonReview(form({ body: "  ", works: "[]" }))?.body,
    ).toBeNull();
    expect(
      parseExpected(
        form({ expected_updated_at: "2026-01-01T00:00:00.123456+00:00" }),
      ),
    ).toBe("2026-01-01T00:00:00.123456+00:00");
  });
  it.each(["0", "10"])(
    "accepts the ends of the popcorn scale (%s)",
    (rating) => {
      expect(parsePersonReview(form({ rating }))?.rating).toBe(Number(rating));
    },
  );

  it("rejects missing and unsafe IDs, rating, oversized body, duplicates and forged shapes", () => {
    expect(parsePersonId(form({ person_id: "9007199254740992" }))).toBeNull();
    expect(parsePersonReview(form({ rating: "" }))).toBeNull();
    expect(parsePersonReview(form({ rating: "3.5" }))).toBeNull();
    expect(parsePersonReview(form({ rating: "11" }))).toBeNull();
    expect(parsePersonReview(form({ rating: "-1" }))).toBeNull();
    expect(parsePersonReview(form({ body: "a".repeat(10001) }))).toBeNull();
    expect(
      parsePersonReview(
        form({
          works:
            '[{"media_type":"movie","tmdb_id":1},{"media_type":"movie","tmdb_id":1}]',
        }),
      ),
    ).toBeNull();
    expect(
      parsePersonReview(
        form({ works: '[{"media_type":"person","tmdb_id":1}]' }),
      ),
    ).toBeNull();
    expect(
      parsePersonReview(
        form({
          works: JSON.stringify(
            Array.from({ length: 11 }, (_, i) => ({
              media_type: "tv",
              tmdb_id: i + 1,
            })),
          ),
        }),
      ),
    ).toBeNull();
    expect(
      parsePersonReview(form({ expected_updated_at: "bogus" })),
    ).toBeNull();
  });
});
