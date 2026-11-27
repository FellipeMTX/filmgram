import { expect, test } from "@playwright/test";

test("missing titles and unmatched routes use the localized 404", async ({
  page,
}) => {
  for (const [locale, heading, action] of [
    ["en", "Page not found", "Back to Discover"],
    ["pt-BR", "Página não encontrada", "Voltar para Descobrir"],
    ["es", "Página no encontrada", "Volver a Descubrir"],
  ]) {
    for (const path of ["title/movie/99999999", "unknown-page"]) {
      const response = await page.goto(`/${locale}/${path}`);
      expect(response?.status()).toBe(404);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("main").getByRole("link", { name: action, exact: true }),
      ).toHaveAttribute("href", `/${locale}/discover`);
    }
  }
});

test("a malformed playlist URL keeps the playlist return action", async ({
  page,
}) => {
  const response = await page.goto("/en/playlists/not-a-uuid");
  expect(response?.status()).toBe(404);
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "View playlists", exact: true }),
  ).toHaveAttribute("href", "/en/playlists");
});

test("uses the branded fallback outside supported locale routes", async ({
  page,
}) => {
  const response = await page.goto("/de/not-a-real-route");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: "Back to Discover", exact: true }),
  ).toHaveAttribute("href", "/en/discover");
});
