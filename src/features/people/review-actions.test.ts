import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  person: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/integrations/supabase", () => ({ supabase: mocks.db }));
vi.mock("@/integrations/tmdb", () => ({ getPersonDetails: mocks.person }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { savePersonReview } from "./review-actions";

function form(works = '[{"media_type":"movie","tmdb_id":1726}]') {
  const f = new FormData();
  f.set("person_id", "3223");
  f.set("rating", "5");
  f.set("body", "");
  f.set("works", works);
  return f;
}
describe("savePersonReview", () => {
  beforeEach(() => vi.resetAllMocks());
  it("requires an authenticated user before requesting credits or writing", async () => {
    const rpc = vi.fn();
    mocks.db.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      rpc,
    });
    expect(await savePersonReview({}, form())).toEqual({ error: "auth" });
    expect(mocks.person).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not mutate when upstream fails or a new reference is not a credit", async () => {
    const rpc = vi.fn();
    mocks.db.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "u" } }, error: null }),
      },
      rpc,
    });
    mocks.person
      .mockRejectedValueOnce(new Error("upstream unavailable"))
      .mockResolvedValueOnce({ works: [] });
    expect(await savePersonReview({}, form())).toEqual({
      error: "unavailable",
    });
    expect(await savePersonReview({}, form())).toEqual({ error: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("returns persisted token unchanged after a valid atomic write", async () => {
    const token = "2026-11-23T17:00:00.123456+00:00";
    const saved = {
      updated_at: token,
      rating: 5,
      body: null,
      person_review_works: [
        { media_type: "movie", tmdb_id: 1726, position: 1 },
      ],
    };
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: saved, error: null }),
    };
    const rpc = vi.fn().mockResolvedValue({ data: "review-id", error: null });
    mocks.db.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: "u" } }, error: null }),
      },
      rpc,
      from: vi.fn().mockReturnValue(chain),
    });
    mocks.person.mockResolvedValue({
      works: [{ media_type: "movie", id: 1726 }],
    });
    expect(await savePersonReview({}, form())).toEqual({
      success: true,
      updatedAt: token,
    });
    expect(rpc).toHaveBeenCalledWith(
      "save_person_review",
      expect.objectContaining({
        p_person_id: 3223,
        p_rating: 5,
        p_works: [{ media_type: "movie", tmdb_id: 1726 }],
      }),
    );
    expect(mocks.revalidate).toHaveBeenCalled();
  });
});
