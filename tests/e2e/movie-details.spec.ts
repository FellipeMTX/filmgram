import { expect, test } from "@playwright/test";

test("movie tabs filter credits and use the selected country for releases and providers", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726");
  await page
    .getByRole("link", { name: "Cast and crew", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/tab=crew/);
  await page
    .getByRole("combobox", { name: "Credits" })
    .selectOption("direction");
  await expect(
    page.getByRole("link", { name: /Jon Favreau/ }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Releases", exact: true }).click();
  await expect(page.getByText("May 2, 2008")).toBeVisible();
  await page.getByRole("combobox", { name: "Country" }).selectOption("BR");
  await expect(page).toHaveURL(/country=BR/);
  await expect(page.getByText("April 30, 2008")).toBeVisible();
  await page.getByRole("link", { name: "Where to watch", exact: true }).click();
  await expect(page.getByText("Apple TV", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Country" }).selectOption("BR");
  await expect(page.getByText("Disney Plus", { exact: true })).toBeVisible();
  await expect(page.getByText(/provided by JustWatch/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /See availability on TMDB/ }),
  ).toHaveAttribute("href", /themoviedb\.org/);
});

test("videos load only when selected and link to YouTube", async ({ page }) => {
  await page.goto("/en/title/movie/1726?tab=videos");
  await expect(page.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Play: Official Trailer" }).click();
  await expect(page.locator("iframe")).toHaveCount(1);
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed\/8ugaeA-nMTc/,
  );
  await expect(
    page.getByRole("link", { name: /Watch on YouTube/ }),
  ).toHaveAttribute("href", /youtube\.com\/watch\?v=8ugaeA-nMTc/);
});
