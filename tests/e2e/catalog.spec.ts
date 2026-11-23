import { expect, test } from "@playwright/test";

test("@smoke guest discovers a title, opens its public URL, and returns to the same list", async ({
  page,
}) => {
  await page.goto("/en/discover?type=movie");
  const title = page.locator('a[href*="/title/movie/1726"]').first();
  await expect(title).toBeVisible();
  await title.focus();
  await expect(title).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/en\/title\/movie\/1726(?:[?#].*)?$/);
  await expect(
    page.getByRole("heading", { name: "Iron Man", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Iron Man", exact: true }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/en\/discover\?type=movie$/);
  await expect(
    page.locator('a[href*="/title/movie/1726"]').first(),
  ).toBeVisible();
});

test("series filter shows only series links and remains shareable", async ({
  page,
}) => {
  await page.goto("/en/discover");
  await page.getByRole("link", { name: "Series", exact: true }).click();
  await expect(page).toHaveURL(/type=tv/);
  await expect(page.locator('a[href*="/title/tv/1434"]').first()).toBeVisible();
  await expect(page.locator('a[href*="/title/movie/"]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('a[href*="/title/tv/1434"]').first()).toBeVisible();
});

test("title route resolves in all three locales", async ({ page }) => {
  for (const locale of ["en", "pt-BR", "es"]) {
    await page.goto(`/${locale}/title/movie/1726`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(
      page.getByRole("heading", { name: "Iron Man", exact: true }),
    ).toBeVisible();
  }
});

test("language selection keeps the current film", async ({ page }) => {
  await page.goto("/en/title/movie/1726");
  await page.getByRole("combobox", { name: "Language", exact: true }).click();
  await page
    .getByRole("option", { name: "Português (Brasil)", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pt-BR\/title\/movie\/1726$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
});

test("missing poster has a readable fallback", async ({ page }) => {
  await page.goto("/en/discover?type=movie");
  const card = page
    .getByRole("region", { name: "Trending now" })
    .last()
    .locator('a[href*="/title/movie/1726"]')
    .first();
  await expect(card.getByText(/poster unavailable|no poster/i)).toBeVisible();
  await card.click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("unknown catalog title fails as a not-found page", async ({ page }) => {
  await page.goto("/en/title/movie/999999999");
  await expect(
    page.getByRole("heading", { name: /not found|could not be found/i }),
  ).toBeVisible();
});
