import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  user: vi.fn(),
  title: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/integrations/supabase", () => ({
  supabase: async () => ({ auth: { getUser: mocks.user }, rpc: mocks.rpc }),
}));
vi.mock("@/integrations/tmdb", () => ({ getFeedTitle: mocks.title }));
import { getFeed } from "./feed";
const rows = Array.from({ length: 13 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  media_type: "movie",
  tmdb_id: 1,
  rating: 5,
  body: `Review ${i}`,
  youtube_video_id: null,
  created_at: "2024-01-01T00:00:00+00:00",
  display_name: "Author",
  handle: "author",
  avatar_url: null,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ data: { user: { id: "viewer" } } });
  mocks.rpc.mockResolvedValue({ data: rows, error: null });
  mocks.title.mockRejectedValue(new Error("offline"));
});
it("preserves reviews when metadata fails and returns a stable cursor", async () => {
  const page = await getFeed("en");
  expect(page.items).toHaveLength(12);
  expect(page.items[0].body).toBe("Review 0");
  expect(page.items[0].title).toBeNull();
  expect(page.next).toEqual({
    createdAt: rows[11].created_at,
    id: rows[11].id,
  });
  expect(mocks.title).toHaveBeenCalledTimes(1);
});
it("rechecks the session and passes a validated cursor", async () => {
  const cursor = { createdAt: rows[11].created_at, id: rows[11].id };
  await getFeed("pt-BR", cursor);
  expect(mocks.rpc).toHaveBeenCalledWith("following_feed", {
    p_before_created_at: cursor.createdAt,
    p_before_id: cursor.id,
  });
  mocks.user.mockResolvedValue({ data: { user: null } });
  await expect(getFeed("en")).rejects.toThrow("Authentication required");
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
