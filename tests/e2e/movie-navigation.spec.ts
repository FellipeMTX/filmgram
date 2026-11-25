import { expect, test } from "@playwright/test";

test("hero shows the selected country's release and classification", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726?country=US&tab=info");
  const hero = page.locator("main > div").first();
  await expect(hero.locator("time")).toHaveAttribute("datetime", "2008-05-02");
  await expect(hero.getByText("PG-13", { exact: true })).toBeVisible();
  const country = page.getByRole("combobox", {
    name: "Availability and release country",
  });
  await country.selectOption("BR");
  await expect(hero.locator("time")).toHaveAttribute("datetime", "2008-04-30");
  await expect(hero.getByText("12", { exact: true })).toBeVisible();
  await page.goto("/en/title/movie/1726?country=CY&tab=info");
  await expect(hero.getByText(/Original release:/)).toBeVisible();
  await expect(hero.getByText("PG-13", { exact: true })).toHaveCount(0);
  await expect(hero.getByText("12", { exact: true })).toHaveCount(0);
});

test("country survives gallery and legacy section navigation", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726?country=BR#releases");
  await expect(page).toHaveURL(/country=BR.*tab=info.*#releases/);
  await page.getByRole("link", { name: "Gallery", exact: true }).click();
  await expect(page).toHaveURL(/country=BR.*tab=gallery/);
});
