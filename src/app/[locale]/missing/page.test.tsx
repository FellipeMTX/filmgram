import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: mocks.get }) }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
import Missing from "./page";

describe("internal missing page", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects direct requests", async () => {
    mocks.get.mockReturnValue(null);
    await expect(
      Missing({
        params: Promise.resolve({ locale: "en" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("not found");
  });
  it("allows marked rewrites", async () => {
    mocks.get.mockReturnValue("1");
    const page = await Missing({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ playlist: "1" }),
    });
    expect(page.props).toMatchObject({ locale: "en", playlist: true });
  });
});
