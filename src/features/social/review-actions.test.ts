import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert, update, eq, select, maybeSingle, getUser } = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/integrations/supabase", () => ({
  supabase: async () => ({
    auth: { getUser },
    from: () => ({ insert, update }),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { submitReviewFromModal } from "./actions";

function form(id?: string) {
  const value = new FormData();
  value.set("media_type", "movie");
  value.set("tmdb_id", "42");
  value.set("rating", "0");
  value.set("body", "A review");
  if (id) value.set("review_id", id);
  return value;
}

describe("review writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
    insert.mockResolvedValue({ error: null });
    update.mockReturnValue({ eq });
    eq.mockReturnValue({ eq, select });
    select.mockReturnValue({ maybeSingle });
    maybeSingle.mockResolvedValue({ data: { id: "review" }, error: null });
  });
  it("inserts a new review, including a zero rating", async () => {
    await submitReviewFromModal(form());
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "owner",
        media_type: "movie",
        tmdb_id: 42,
        rating: 0,
      }),
    );
    expect(update).not.toHaveBeenCalled();
  });
  it("updates only the identified review owned by this user for this title", async () => {
    await submitReviewFromModal(form("review"));
    expect(eq.mock.calls).toEqual([
      ["id", "review"],
      ["user_id", "owner"],
      ["media_type", "movie"],
      ["tmdb_id", 42],
    ]);
    expect(insert).not.toHaveBeenCalled();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(submitReviewFromModal(form("missing"))).rejects.toThrow(
      "Review not found",
    );
  });
  it("does not overwrite an existing review when insertion conflicts", async () => {
    insert.mockResolvedValue({ error: { code: "23505" } });
    await expect(submitReviewFromModal(form())).rejects.toEqual({
      code: "23505",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
