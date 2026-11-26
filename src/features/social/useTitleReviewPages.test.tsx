import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { loadTitleReviewPage } from "./title-review-page";
import { useTitleReviewPages } from "./useTitleReviewPages";

vi.mock("./title-review-page", () => ({ loadTitleReviewPage: vi.fn() }));
const load = vi.mocked(loadTitleReviewPage);
type Page = Awaited<ReturnType<typeof loadTitleReviewPage>>;
const cursor = {
  id: "00000000-0000-4000-8000-000000000001",
  followed: false,
  createdAt: "2025-01-01T00:00:00Z",
};
const page = (ids: string[], next: Page["next"] = cursor): Page => ({
  reviews: ids.map((id) => ({ id }) as Page["reviews"][number]),
  summaries: {},
  next,
  selectedOutsidePage: false,
});

beforeEach(() => load.mockReset());

it("discards old pages and in-flight responses even when the refreshed first page is unchanged", async () => {
  const initial = page(["first"]);
  const { result } = renderHook(() => useTitleReviewPages(initial, 1, null));
  load.mockResolvedValueOnce(page(["extra"]));
  await act(async () => {
    await result.current.loadMore();
  });
  expect(result.current.page.reviews.map((row) => row.id)).toEqual([
    "first",
    "extra",
  ]);
  let resolveOld!: (value: Page) => void;
  load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  let old!: Promise<void>;
  act(() => {
    old = result.current.loadMore();
  });
  let resolveFresh!: (value: Page) => void;
  load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveFresh = resolve;
      }),
  );
  let refreshing!: Promise<void>;
  act(() => {
    refreshing = result.current.refresh();
  });
  expect(result.current.pending).toBe(true);
  expect(result.current.page.reviews.map((row) => row.id)).toEqual([
    "first",
    "extra",
  ]);
  await act(async () => {
    resolveOld(page(["stale"]));
    await old;
  });
  expect(result.current.pending).toBe(true);
  await act(async () => {
    resolveFresh(page(["first"]));
    await refreshing;
  });
  expect(result.current.page.reviews.map((row) => row.id)).toEqual(["first"]);
});

it("keeps pagination blocked after a failed refresh until retry succeeds", async () => {
  const initial = page(["first"]);
  const { result } = renderHook(() => useTitleReviewPages(initial, 1, null));
  load.mockResolvedValueOnce(page(["extra"]));
  await act(async () => {
    await result.current.loadMore();
  });
  load.mockRejectedValueOnce(new Error("offline"));
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.error).toBe("refresh");
  expect(result.current.page.reviews.map((row) => row.id)).toEqual(["first"]);
  await act(async () => {
    await result.current.loadMore();
  });
  expect(load).toHaveBeenCalledTimes(2);
  load.mockResolvedValueOnce(page(["new"]));
  await act(async () => {
    await result.current.refresh();
  });
  await waitFor(() => expect(result.current.error).toBeNull());
  expect(result.current.page.reviews[0]?.id).toBe("new");
});

it("loads series pages with the shared ranking cursor", async () => {
  const initial = page(["first"]);
  const { result } = renderHook(() =>
    useTitleReviewPages(initial, 42, null, false, "tv"),
  );
  load.mockResolvedValueOnce(page(["second"], null));
  await act(async () => {
    await result.current.loadMore();
  });
  expect(load).toHaveBeenCalledWith("tv", 42, null, cursor, false);
  expect(result.current.page.reviews.map((row) => row.id)).toEqual([
    "first",
    "second",
  ]);
});
