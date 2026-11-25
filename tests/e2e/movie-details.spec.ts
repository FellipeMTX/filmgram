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
    page.getByRole("link", { name: /Robert Downey Jr/ }).first(),
  ).toHaveAttribute("href", "/en/person/3223");
  await expect(
    page.getByRole("navigation", { name: "Movie sections" }),
  ).toBeVisible();
  expect(await reviews.locator("article").count()).toBeLessThanOrEqual(2);
  await expect(
    reviews.getByRole("button", { name: "Write review" }),
  ).toHaveCount(0);
  await reviews.getByRole("link", { name: "View all reviews" }).click();
  await expect(page).toHaveURL(/\?tab=reviews/);
  await expect(
    page.getByRole("button", { name: "Write review" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Info", exact: true }).click();
  await expect(
    page
      .locator("#releases")
      .getByRole("heading", { name: "Release dates", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Jon Favreau/ }).first(),
  ).toHaveAttribute("href", "/en/person/15277");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  const watchBox = await watch.boundingBox();
  const reviewsBox = await reviews.boundingBox();
  expect(watchBox).not.toBeNull();
  expect(reviewsBox).not.toBeNull();
  expect(reviewsBox!.y).toBeGreaterThan(watchBox!.y);
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
  await page.goto("/en/title/movie/1726?tab=info");
  await expect(
    page.locator("#releases").getByText("May 2, 2008"),
  ).toBeVisible();
  await expect(page.getByText("Apple TV", { exact: true })).toBeVisible();
  const country = page.getByRole("combobox", {
    name: "Availability and release country",
  });
  await country.focus();
  await country.selectOption("BR");
  await expect(page).toHaveURL(/country=BR/);
  await expect(
    page.locator("#releases").getByText("April 30, 2008"),
  ).toBeVisible();
  await expect(page.getByText("Disney Plus", { exact: true })).toBeVisible();
  await expect(page.getByText(/provided by JustWatch/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /See availability on TMDB/ }),
  ).toHaveCount(0);
  await expect(country).toBeFocused();
});

for (const [tab, anchor] of Object.entries({
  overview: "film-details",
  crew: "cast-and-crew",
  releases: "releases",
  videos: "videos",
  watch: "where-to-watch",
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
  const player = page.getByRole("dialog").locator("iframe");
  await expect(player).toHaveCount(1);
  await expect(player).toHaveAttribute(
    "src",
    /youtube-nocookie\.com\/embed\/8ugaeA-nMTc/,
  );
  await expect(player).toHaveAttribute("title", /Official Trailer/);
  const close = page.getByRole("dialog").getByRole("button", { name: "Close" });
  if (page.viewportSize()!.width >= 1024) {
    await page.setViewportSize({ width: 1024, height: 500 });
    await expect(close).toBeInViewport();
  }
  await close.click();
  await expect(player).toHaveCount(0);
  await expect(
    section.getByRole("button", { name: "Play: Official Trailer" }),
  ).toBeFocused();
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
  await page.goto("/en/title/movie/1726?tab=info");
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

test("gallery categories open images and extras independently of hero trailers", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726");
  const gallery = page.getByRole("region", { name: "Gallery" });
  await gallery.getByRole("link", { name: /View gallery/ }).click();
  await expect(page).toHaveURL(/tab=gallery/);
  await page
    .getByRole("button", { name: /View image: Iron Man/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await page
    .getByRole("navigation", { name: "Gallery" })
    .getByRole("link", { name: "Extra videos" })
    .click();
  await expect(page).toHaveURL(/media=extras/);
  await expect(
    page.getByRole("button", { name: "Play: Teaser" }),
  ).toBeVisible();
  await expect(
    page.locator("#videos").getByRole("button", { name: "Play: Teaser" }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Gallery" })
      .getByRole("button", { name: "Play: Official Trailer" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Play: Teaser" }).click();
  await expect(page.getByRole("dialog").locator("iframe")).toHaveAttribute(
    "src",
    /Ke1Y3P9D0Bc/,
  );
});

test("a single trailer keeps the gallery link and a direct unavailable trailers category is empty", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726");
  await expect(
    page.getByRole("link", { name: "View all trailers" }),
  ).toHaveCount(0);
  await page.goto("/en/title/movie/1726?tab=gallery&media=trailers");
  const gallery = page.getByRole("region", { name: "Gallery" });
  await expect(
    gallery.getByText("No media available in this category."),
  ).toBeVisible();
  await expect(
    gallery.getByRole("link", { name: "Trailers", exact: true }),
  ).toHaveCount(0);
  await gallery.getByRole("link", { name: "Extra videos" }).click();
  await expect(
    gallery.getByRole("button", { name: "Play: Teaser" }),
  ).toBeVisible();
});
