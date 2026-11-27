import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  trending: vi.fn(),
  topRated: vi.fn(),
  popular: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/integrations/tmdb", () => ({
  getTrending: mocks.trending,
  getTopRated: mocks.topRated,
  getPopular: mocks.popular,
  getDetail: vi.fn(),
}));
vi.mock("@/integrations/supabase", () => ({
  currentUser: vi.fn().mockResolvedValue(null),
  supabase: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/features/profile/queries", () => ({
  getRecentViewingTitles: vi.fn(),
}));
vi.mock("@/features/catalog/Hero", () => ({ Hero: () => <div>Hero</div> }));
vi.mock("@/features/catalog/Cards", () => ({
  Shelf: ({ title, items }: { title: string; items: unknown[] }) => (
    <div>
      {title}: {items.length}
    </div>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import Discover from "./page";

const film = { id: 1, media_type: "movie", title: "Film" };
async function show() {
  render(
    await Discover({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ type: "movie" }),
    }),
  );
}
describe("discover catalog states", () => {
  beforeEach(() => {
    mocks.trending.mockResolvedValue([film]);
    mocks.topRated.mockResolvedValue([film]);
    mocks.popular.mockResolvedValue([film]);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps successful sections and refreshes the current filter after a failure", async () => {
    mocks.trending.mockRejectedValue(new Error("unavailable"));
    await show();
    expect(screen.getByText("Hero")).toBeInTheDocument();
    expect(screen.getByText(/Top Rated: 1/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Try again" })[0]!);
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.topRated).toHaveBeenCalledWith("en", "movie");
  });

  it("distinguishes an unavailable catalog from an empty one and retains history", async () => {
    mocks.trending.mockRejectedValue(new Error());
    mocks.topRated.mockRejectedValue(new Error());
    mocks.popular.mockRejectedValue(new Error());
    await show();
    expect(
      screen.getByText("The catalog is temporarily unavailable."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Recently Watched: 0/i)).toBeInTheDocument();
    cleanup();
    mocks.trending.mockResolvedValue([]);
    mocks.topRated.mockResolvedValue([]);
    mocks.popular.mockResolvedValue([]);
    await show();
    expect(screen.getByText("No films are available yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute(
      "href",
      "/en/discover",
    );
  });

  it("keeps trending and history when top rated and popular fail", async () => {
    mocks.topRated.mockRejectedValue(new Error());
    mocks.popular.mockRejectedValue(new Error());
    await show();
    expect(screen.getByText(/Trending now: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Recently Watched: 0/i)).toBeInTheDocument();
    expect(
      screen.getAllByText("This section is temporarily unavailable."),
    ).toHaveLength(2);
  });
});
