import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  range: vi.fn(),
  rpc: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/integrations/tmdb", () => ({ getFeedTitle: vi.fn() }));
vi.mock("@/integrations/supabase", () => ({
  supabase: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "viewer" } }, error: null }),
    },
    from: () => ({
      select: () => {
        const query = {
          eq: mocks.eq,
          order: () => query,
          range: mocks.range,
        };
        mocks.eq.mockReturnValue(query);
        return query;
      },
    }),
    rpc: mocks.rpc,
  }),
}));
import { getProfileLikedPage, getProfileViewingPage } from "./queries";

beforeEach(() => vi.clearAllMocks());

it("lets an out-of-range liked page fall back without losing the type filter", async () => {
  mocks.range.mockResolvedValue({
    data: null,
    error: { message: "range" },
    status: 416,
    count: null,
  });
  await expect(getProfileLikedPage("pt-BR", 99, "tv")).resolves.toEqual({
    items: [],
    total: 0,
  });
  expect(mocks.eq).toHaveBeenCalledWith("media_type", "tv");
  expect(mocks.range).toHaveBeenCalledWith(1176, 1187);
});

it("preserves real liked-query errors", async () => {
  const error = { message: "database unavailable" };
  mocks.range.mockResolvedValue({ data: null, error, status: 503 });
  await expect(getProfileLikedPage("pt-BR", 99, "movie")).rejects.toEqual(
    error,
  );
});

it("uses viewing events through the history RPC, including revisit counts", async () => {
  mocks.rpc.mockResolvedValue({
    data: [
      {
        media_type: "movie",
        tmdb_id: 42,
        media_title: "Film",
        poster_path: null,
        last_watched_at: "2026-11-25",
        watch_count: 2,
        total_count: 1,
      },
    ],
    error: null,
  });
  const result = await getProfileViewingPage("history", "all", 1, "movie");
  expect(mocks.rpc).toHaveBeenCalledWith("profile_viewing_titles", {
    p_period: "all",
    p_ranking: false,
    p_limit: 12,
    p_offset: 0,
    p_type: "movie",
  });
  expect(result.items[0]).toMatchObject({ tmdbId: 42, watchCount: 2 });
});
