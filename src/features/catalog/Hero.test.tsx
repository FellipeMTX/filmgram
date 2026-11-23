import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Hero } from "./Hero";

const items = [
  { id: 1, media_type: "movie" as const, title: "First" },
  { id: 2, media_type: "movie" as const, title: "Second" },
];
let now = 0;
let frame: FrameRequestCallback | undefined;
let hidden = false;
function advance(ms: number) {
  now += ms;
  const callback = frame;
  frame = undefined;
  act(() => callback?.(now));
}
beforeEach(() => {
  now = 0;
  frame = undefined;
  hidden = false;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frame = undefined;
  });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("featured carousel", () => {
  it("advances after six seconds, pauses while hidden, and resumes its progress", () => {
    render(<Hero items={items} locale="en" trendingKeys={[]} />);
    advance(3000);
    hidden = true;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    advance(10000);
    expect(screen.getByRole("heading", { name: "First" })).toBeInTheDocument();
    hidden = false;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    advance(2999);
    expect(screen.getByRole("heading", { name: "First" })).toBeInTheDocument();
    advance(1);
    expect(screen.getByRole("heading", { name: "Second" })).toBeInTheDocument();
  });
  it("does not autoplay when reduced motion is requested", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    render(<Hero items={items} locale="en" trendingKeys={[]} />);
    advance(12000);
    expect(screen.getByRole("heading", { name: "First" })).toBeInTheDocument();
    expect(frame).toBeUndefined();
  });
  it("resets the clock on manual navigation and keeps controls outside the link", () => {
    render(<Hero items={items} locale="en" trendingKeys={[]} />);
    advance(5000);
    const section = screen.getByRole("region", { name: /featured/i });
    fireEvent.keyDown(section, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "Second" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Second/i }).querySelector("button"),
    ).toBeNull();
    advance(1000);
    expect(screen.getByRole("heading", { name: "Second" })).toBeInTheDocument();
  });
  it("does not schedule autoplay for empty or single-item catalogs", () => {
    const { rerender } = render(
      <Hero items={[]} locale="en" trendingKeys={[]} />,
    );
    expect(frame).toBeUndefined();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<Hero items={[items[0]!]} locale="en" trendingKeys={[]} />);
    advance(12000);
    expect(screen.getByRole("heading", { name: "First" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(frame).toBeUndefined();
  });
  it("preserves explicit pause when focus leaves the banner", () => {
    render(<Hero items={items} locale="en" trendingKeys={[]} />);
    advance(2000);
    fireEvent.click(screen.getByRole("button", { name: "Pause highlights" }));
    const section = screen.getByRole("region", { name: /featured/i });
    fireEvent.focus(section);
    fireEvent.blur(section, { relatedTarget: document.body });
    advance(10000);
    expect(screen.getByRole("heading", { name: "First" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play highlights" }));
    advance(3999);
    expect(screen.getByRole("heading", { name: "First" })).toBeInTheDocument();
    advance(1);
    expect(screen.getByRole("heading", { name: "Second" })).toBeInTheDocument();
  });
});
