import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
vi.mock("server-only", () => ({}));
import { Card } from "./Cards";
describe("title card", () => {
  it("links to the correct localized title and shows the missing-poster state", () => {
    render(
      <Card
        locale="pt-BR"
        item={{
          id: 42,
          media_type: "tv",
          name: "Example",
          poster_path: null,
          vote_average: 8.1,
        }}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/pt-BR/title/tv/42",
    );
    expect(screen.getByText("Pôster indisponível")).toBeInTheDocument();
    expect(screen.getByText("8.1")).toBeInTheDocument();
  });
  it("shows a fallback if the poster fails to load", () => {
    const { container } = render(
      <Card
        locale="en"
        item={{
          id: 7,
          media_type: "movie",
          title: "A film",
          poster_path: "/broken.jpg",
        }}
      />,
    );
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByText("Poster unavailable")).toBeInTheDocument();
  });
});
