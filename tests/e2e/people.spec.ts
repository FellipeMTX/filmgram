import { expect, test } from "@playwright/test";

test("cast links to the actor profile and filmography links back to a title", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726");
  await page.getByRole("link", { name: "Cast and crew", exact: true }).click();
  await page
    .getByRole("link", { name: /Robert Downey Jr/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/person\/3223$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Robert Downey Jr." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Filmography", exact: true }),
  ).toBeVisible();
  const film = page.locator(
    '#filmography-works a[href="/en/title/movie/1726"]',
  );
  await expect(film).toHaveCount(1);
  await film.click();
  await expect(page).toHaveURL(/\/en\/title\/movie\/1726$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Iron Man" }),
  ).toBeVisible();
});

test("movie overview links its director to a shared professional profile", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726");
  await page
    .getByRole("link", { name: /Jon Favreau/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/person\/15277$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Jon Favreau" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Directing", exact: true }).click();
  await expect(page).toHaveURL(/activity=directing/);
  await expect(
    page.locator('#filmography-works a[href="/en/title/movie/1726"]'),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "Acting", exact: true }).click();
  await expect(page).toHaveURL(/activity=acting/);
  await expect(
    page.locator('#filmography-works a[href="/en/title/movie/1726"]'),
  ).toHaveCount(1);
});

test("co-directors are listed independently without changing series credits", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1003596");
  await expect(page.getByRole("link", { name: /Joe Russo/ })).toHaveAttribute(
    "href",
    "/en/person/19272",
  );
  await expect(
    page.getByRole("link", { name: /Anthony Russo/ }),
  ).toHaveAttribute("href", "/en/person/19271");
  await page.goto("/en/title/tv/42009");
  await expect(
    page.getByRole("heading", { name: "Direction", exact: true }),
  ).toHaveCount(0);
});

test("media filters and language switching preserve the professional and activity", async ({
  page,
}) => {
  await page.goto("/en/person/15277?type=movie&activity=directing");
  await page.getByRole("link", { name: "Series", exact: true }).click();
  await expect(page).toHaveURL(/type=tv/);
  await expect(page).toHaveURL(/activity=directing/);
  await expect(
    page.locator('#filmography-works a[href*="/title/movie/"]'),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Films", exact: true }).click();
  await expect(page).toHaveURL(/type=movie/);
  await page.getByRole("combobox", { name: "Language", exact: true }).click();
  await page
    .getByRole("option", { name: "Português (Brasil)", exact: true })
    .click();
  await expect(page).toHaveURL(/\/pt-BR\/person\/15277\?/);
  await expect(page).toHaveURL(/activity=directing/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Jon Favreau" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Filmografia", exact: true }),
  ).toBeVisible();
});

test("pagination follows filtering and missing data has a readable fallback", async ({
  page,
}) => {
  await page.goto("/en/person/90000001");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Filmgram pagination fixture",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("No biography available.", { exact: true }),
  ).toBeVisible();
  const width = page.viewportSize()!.width;
  await expect(page.locator("#filmography-works article:visible")).toHaveCount(
    width <= 700 ? 4 : width < 1024 ? 8 : 12,
  );
  await page.getByRole("button", { name: "Show more", exact: true }).click();
  await expect(
    page.locator('#filmography-works a[href*="/title/movie/"]'),
  ).toHaveCount(24);
  await page.getByRole("link", { name: "Next page", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(
    page.locator('#filmography-works a[href*="/title/movie/"]'),
  ).toHaveCount(1);
  await page.getByRole("link", { name: "Series", exact: true }).click();
  await expect(page).not.toHaveURL(/[?&]page=2(?:&|$)/);
  await expect(page).toHaveURL(/type=tv/);
  await expect(
    page.getByText("No works available for these filters.", { exact: true }),
  ).toBeVisible();
});

test("professional profiles fit narrow layouts and missing IDs show not-found", async ({
  page,
}) => {
  await page.goto("/en/person/15277");
  for (const width of [320, 390, 700, 701, 838, 1650]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("heading", { level: 1, name: "Jon Favreau" }),
    ).toBeVisible();
  }
  for (const id of ["invalid", "0", "9007199254740992", "99999999"]) {
    await page.goto(`/en/person/${id}`);
    await expect(
      page.getByRole("heading", { name: "Page not found", exact: true }),
    ).toBeVisible();
  }
});

test("search resets pagination, preserves filters, and clears without affecting recent works", async ({
  page,
}) => {
  await page.goto("/en/person/15277?type=movie&activity=acting");
  const recent = page.getByRole("region", { name: "Recent works" });
  await expect(recent.getByRole("link", { name: /Iron Man/ })).toBeVisible();
  const filmography = page.getByRole("region", { name: "Filmography" });
  const search = filmography.getByRole("searchbox", { name: "Search works" });
  await search.fill("iron");
  await filmography
    .getByRole("button", { name: "Search", exact: true })
    .click();
  await expect(page).toHaveURL(/q=iron/);
  await expect(page).toHaveURL(/type=movie/);
  await expect(page).toHaveURL(/activity=acting/);
  await expect(
    filmography.locator('#filmography-works a[href="/en/title/movie/1726"]'),
  ).toBeVisible();
  await filmography.getByRole("link", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(page).not.toHaveURL(/[?&]q=iron/);
  await expect(page).toHaveURL(/activity=acting/);
  await filmography.getByRole("link", { name: "Series", exact: true }).click();
  await expect(page).toHaveURL(/type=tv/);
  await expect(recent.getByRole("link", { name: /Iron Man/ })).toBeVisible();
});

test("collapsed filmography presents two responsive rows and a bounded DOM", async ({
  page,
}) => {
  await page.goto("/en/person/90000001");
  for (const [width, count] of [
    [390, 4],
    [701, 8],
    [1023, 8],
    [1024, 12],
    [1650, 12],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator("#filmography-works article")).toHaveCount(12);
    await expect(
      page.locator("#filmography-works article:visible"),
    ).toHaveCount(count);
  }
  await page.getByRole("button", { name: "Show more" }).click();
  await expect(page.locator("#filmography-works article:visible")).toHaveCount(
    24,
  );
  await page.getByRole("link", { name: "Next page" }).click();
  await page.getByRole("link", { name: "Previous page" }).click();
  await expect(page.locator("#filmography-works article:visible")).toHaveCount(
    24,
  );
  await page.getByRole("link", { name: "Show less" }).click();
  await expect(page.locator("#filmography-works article:visible")).toHaveCount(
    12,
  );
});

test("movie credits and reviews use separate sections while the TV layout is retained", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726");
  await page.getByRole("link", { name: "Cast and crew", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cast", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Community reviews", exact: true }),
  ).toBeHidden();
  await page.getByRole("link", { name: "Reviews", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Community reviews", exact: true }),
  ).toBeVisible();
  await page.goto("/en/title/tv/42009");
  const tvCast = await page
    .getByRole("heading", { name: "Cast", exact: true })
    .boundingBox();
  const tvRating = await page
    .getByRole("heading", { name: "Community reviews", exact: true })
    .boundingBox();
  expect(tvCast!.y).toBeLessThan(tvRating!.y);
});
