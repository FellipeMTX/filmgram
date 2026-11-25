import { expect, test } from "@playwright/test";

test("movie sections share a responsive layout and retain credits", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726");
  await expect(
    page.getByRole("heading", { level: 1, name: "Iron Man" }),
  ).toBeVisible();
  const reviews = page.locator("#reviews");
  const watch = page.locator("#where-to-watch");
  await expect(
    reviews.getByRole("heading", { name: "Community reviews", exact: true }),
  ).toBeVisible();
  await expect(
    watch.getByRole("heading", { name: "Where to watch", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#releases")
      .getByRole("heading", { name: "Release dates", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Robert Downey Jr/ }).first(),
  ).toHaveAttribute("href", "/en/person/3223");
  await expect(
    page.getByRole("link", { name: /Jon Favreau/ }).first(),
  ).toHaveAttribute("href", "/en/person/15277");
  await expect(
    page.getByRole("navigation", { name: "Title sections" }),
  ).toHaveCount(0);
  const watchBox = await watch.boundingBox();
  const reviewsBox = await reviews.boundingBox();
  expect(watchBox).not.toBeNull();
  expect(reviewsBox).not.toBeNull();
  if (page.viewportSize()!.width >= 1024)
    expect(reviewsBox!.x).toBeGreaterThan(watchBox!.x);
  else expect(reviewsBox!.y).toBeGreaterThan(watchBox!.y);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
});

test("one country updates releases and providers together", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726");
  await expect(page.getByText("May 2, 2008")).toBeVisible();
  await expect(page.getByText("Apple TV", { exact: true })).toBeVisible();
  const country = page.getByRole("combobox", {
    name: "Availability and release country",
  });
  await country.focus();
  await country.selectOption("BR");
  await expect(page).toHaveURL(/country=BR/);
  await expect(page.getByText("April 30, 2008")).toBeVisible();
  await expect(page.getByText("Disney Plus", { exact: true })).toBeVisible();
  await expect(page.getByText(/provided by JustWatch/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /See availability on TMDB/ }),
  ).toHaveAttribute("href", /themoviedb\.org/);
  await expect(country).toBeFocused();
});

for (const [tab, anchor] of Object.entries({
  overview: "film-details",
  crew: "cast-and-crew",
  releases: "releases",
  videos: "videos",
  watch: "where-to-watch",
  reviews: "reviews",
})) {
  test(`legacy ${tab} links resolve to their section after navigation and reload`, async ({
    page,
  }) => {
    await page.goto(`/en/title/movie/1726?tab=${tab}`);
    await expect(page).toHaveURL(new RegExp(`#${anchor}$`));
    await expect(page.locator(`#${anchor}`)).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`#${anchor}$`));
    await expect(page.locator(`#${anchor}`)).toBeVisible();
  });
}

test("explicit fragments take priority over legacy tabs", async ({ page }) => {
  await page.goto("/en/title/movie/1726?tab=crew#releases");
  await expect(page).toHaveURL(/#releases$/);
  await expect(page.locator("#releases")).toBeVisible();
});

test("video embed is created only after play", async ({ page }) => {
  await page.goto("/en/title/movie/1726?tab=videos");
  const section = page.locator("#videos");
  await expect(section.locator("iframe")).toHaveCount(0);
  await section.getByRole("button", { name: "Play: Official Trailer" }).click();
  const player = section.locator("iframe");
  await expect(player).toHaveCount(1);
  await expect(player).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed\/8ugaeA-nMTc/,
  );
  await expect(player).toHaveAttribute("title", /Official Trailer/);
  await expect(
    section.getByRole("link", { name: /Watch on YouTube/ }),
  ).toHaveAttribute("href", /youtube\.com\/watch\?v=8ugaeA-nMTc/);
});

test("series retains its existing layout", async ({ page }) => {
  await page.goto("/en/title/tv/42009");
  const cast = await page
    .getByRole("heading", { name: "Cast", exact: true })
    .boundingBox();
  const reviews = await page
    .getByRole("heading", { name: "Community reviews", exact: true })
    .boundingBox();
  expect(cast).not.toBeNull();
  expect(reviews).not.toBeNull();
  expect(cast!.y).toBeLessThan(reviews!.y);
});
test("country options unite releases and providers with independent empty states", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726");
  const country = page.getByRole("combobox", {
    name: "Availability and release country",
  });
  await country.selectOption("ES");
  await expect(
    page.locator("#releases").getByText("April 30, 2008"),
  ).toBeVisible();
  await expect(
    page
      .locator("#where-to-watch")
      .getByText("No streaming information is available for this country."),
  ).toBeVisible();
  await country.selectOption("PT");
  await expect(
    page.locator("#where-to-watch").getByText("Disney Plus", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#releases")
      .getByText("No release dates are available for this country."),
  ).toBeVisible();
});

test("switching videos removes the old embed and keeps focus on the selector", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726");
  const section = page.locator("#videos");
  const selector = section.getByRole("combobox", { name: "Choose a video" });
  await section.getByRole("button", { name: "Play: Official Trailer" }).click();
  await expect(section.locator("iframe")).toHaveAttribute("src", /8ugaeA-nMTc/);
  await selector.focus();
  await selector.selectOption("iron-man-teaser-pt");
  await expect(selector).toBeFocused();
  await expect(section.locator("iframe")).toHaveCount(0);
  await section.getByRole("button", { name: "Play: Teaser" }).click();
  await expect(section.locator("iframe")).toHaveAttribute("src", /Ke1Y3P9D0Bc/);
});
