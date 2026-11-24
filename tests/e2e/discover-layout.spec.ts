import { expect, test, type Page } from "@playwright/test";

const titlePath = /\/en\/title\/(movie|tv)\/\d+$/;

function shelf(page: Page, name: string) {
  return page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name, exact: true }),
    })
    .first();
}

test("the fifth highlight can be selected and its entire surface opens that title", async ({
  page,
}) => {
  await page.goto("/en/discover?type=movie");
  const hero = page.getByRole("region", { name: "Featured titles" });
  const first = hero.getByRole("button", { name: "Show highlight 1 of 5" });
  const fifth = hero.getByRole("button", { name: "Show highlight 5 of 5" });
  await expect(first).toBeVisible();
  const link = hero.getByRole("link", { name: /./ }).first();
  const firstHref = await link.getAttribute("href");
  await fifth.click();
  await expect(page).toHaveURL(/\/en\/discover\?type=movie$/);
  await expect(link).not.toHaveAttribute("href", firstHref ?? "");
  const fifthHref = await link.getAttribute("href");
  expect(fifthHref).toMatch(titlePath);

  const bounds = await link.boundingBox();
  if (!bounds) throw new Error("Expected a clickable backdrop");
  await link.click({
    position: { x: bounds.width * 0.85, y: bounds.height * 0.2 },
  });
  await expect(page).toHaveURL((url) => url.pathname === fifthHref);
});

test("changing the media filter resets the highlight", async ({ page }) => {
  await page.goto("/en/discover");
  const hero = page.getByRole("region", { name: "Featured titles" });
  await hero.getByRole("button", { name: "Show highlight 5 of 5" }).click();
  await page.getByRole("link", { name: "Series", exact: true }).click();
  await expect(page).toHaveURL(/type=tv/);
  const selected = hero.locator(
    'button[aria-current="true"], button[aria-pressed="true"]',
  );
  await expect(selected).toHaveAccessibleName("Show highlight 1 of 5");
  await expect(hero.getByRole("link").first()).toHaveAttribute(
    "href",
    /\/title\/tv\//,
  );
});

test("catalog shelves stay in one row and fit the page at desktop, tablet and phone widths", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "The desktop browser resizes through all five layouts",
  );
  await page.goto("/en/discover?type=movie");
  const rail = shelf(page, "Trending now");
  const links = rail.getByRole("link");
  await expect.poll(() => links.count()).toBeGreaterThanOrEqual(10);

  for (const width of [320, 390, 768, 1084, 1676]) {
    await page.setViewportSize({ width, height: 900 });
    const tops = await links.evaluateAll((cards) =>
      cards.map((card) => card.getBoundingClientRect().top),
    );
    expect(new Set(tops).size, `Card rows at ${width}px`).toBe(1);
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasOverflow, `Whole-page horizontal overflow at ${width}px`).toBe(
      false,
    );
    const heroHeading = await page
      .getByRole("heading", { level: 1 })
      .boundingBox();
    const shelfHeading = await rail.getByRole("heading").boundingBox();
    if (!heroHeading || !shelfHeading)
      throw new Error("Expected Discover headings");
    if (width >= 1084)
      expect(Math.abs(heroHeading.x - shelfHeading.x)).toBeLessThan(2);
    else expect(heroHeading.x).toBeGreaterThanOrEqual(16);
  }

  const next = rail.getByRole("button", { name: /^Next\b/i });
  await expect(next).toBeVisible();
  await next.click();
  await expect(links.nth(9)).toBeInViewport();
  const previous = rail.getByRole("button", { name: /^Previous\b/i });
  await expect(previous).toBeVisible();
  await previous.focus();
  await page.keyboard.press("Enter");
  await expect(links.first()).toBeInViewport();
});

test("popular fallback identifies TMDB as the source", async ({ page }) => {
  await page.goto("/en/discover?type=tv");
  const popular = shelf(page, "Popular on TMDB");
  await expect(popular.getByRole("heading")).toBeVisible();
  await expect
    .poll(() => popular.getByRole("link").count())
    .toBeGreaterThanOrEqual(10);
  await expect(popular.locator('a[href*="/title/movie/"]')).toHaveCount(0);
});

test("a touch gesture moves the horizontal shelf on a phone", async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== "mobile",
    "This check uses Chromium touch input",
  );
  await page.goto("/en/discover?type=movie");
  const firstCard = shelf(page, "Trending now").getByRole("link").first();
  await firstCard.scrollIntoViewIfNeeded();
  const startingX = (await firstCard.boundingBox())?.x;
  if (startingX === undefined) throw new Error("Expected a shelf card");
  const card = await firstCard.boundingBox();
  if (!card) throw new Error("Expected shelf dimensions");
  const width = page.viewportSize()?.width ?? 390;
  const y = Math.floor(card.y + card.height * 0.4);
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: Math.floor(width * 0.75), y }],
    });
    for (const factor of [0.65, 0.55, 0.45, 0.35, 0.25, 0.15]) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: Math.floor(width * factor), y }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(async () => (await firstCard.boundingBox())?.x ?? startingX)
      .toBeLessThan(startingX - 40);
  } finally {
    await cdp.detach();
  }
});

test("public title shows the cast without a Google sign-in button", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726");
  await expect(
    page.getByRole("heading", { name: "Iron Man", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with Google", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Cast and crew", exact: true }).click();
  const cast = shelf(page, "Cast");
  await expect(
    cast.getByText("Robert Downey Jr.", { exact: true }),
  ).toBeVisible();
  await expect(cast.getByText(/Tony Stark/)).toBeVisible();
  const portrait = cast.locator("img").first();
  await expect(portrait).toBeVisible();
  const frame = await portrait.evaluate((image) => {
    const { width, height } = image.getBoundingClientRect();
    const radius =
      image.parentElement &&
      getComputedStyle(image.parentElement).borderTopLeftRadius;
    return { width, height, radius };
  });
  expect(frame.width).toBeCloseTo(frame.height, 0);
  expect(frame.radius).toBe("50%");
});

test("the title poster fills the banner column on desktop", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Mobile uses the title backdrop");
  await page.goto("/en/title/movie/1368337");
  const poster = page.getByAltText(/The Odyssey poster/);
  await expect(poster).toBeVisible();
  const edges = await poster.evaluate((image) => {
    const frame = image.parentElement?.getBoundingClientRect();
    const info =
      image.parentElement?.nextElementSibling?.getBoundingClientRect();
    if (!frame || !info)
      throw new Error("Expected poster and title information columns");
    return {
      top: Math.abs(frame.top - info.top),
      bottom: Math.abs(frame.bottom - info.bottom),
    };
  });
  expect(edges.top).toBeLessThan(2);
  expect(edges.bottom).toBeLessThan(2);
});

test("highlight content and controls stay separate with a long title", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Checks multiple viewport widths");
  await page.goto("/en/discover");
  const hero = page.getByRole("region", { name: "Featured titles" });
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await hero.getByRole("heading", { level: 1 }).evaluate((heading) => {
      heading.textContent = "An exceptionally long title ".repeat(8);
    });
    const content = await hero.getByRole("heading", { level: 1 }).boundingBox();
    const controls = await hero
      .getByRole("button", { name: "Show highlight 1 of 5" })
      .boundingBox();
    if (!content || !controls)
      throw new Error("Expected hero content and controls");
    expect(content.y + content.height).toBeLessThanOrEqual(controls.y);
  }
});

test("rail retains keyboard focus when reaching an edge", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Checks keyboard focus");
  await page.goto("/en/discover?type=movie");
  const rail = shelf(page, "Trending now");
  const next = rail.getByRole("button", { name: "Next titles" });
  await next.focus();
  for (
    let i = 0;
    i < 8 && (await next.getAttribute("aria-disabled")) !== "true";
    i++
  ) {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(450);
  }
  await expect(next).toHaveAttribute("aria-disabled", "true");
  await expect(next).toBeFocused();
  await expect(next).toBeVisible();
});

test("credits and official TMDB attribution are reachable in each language", async ({
  page,
}) => {
  for (const locale of ["en", "pt-BR", "es"]) {
    await page.goto(`/${locale}/discover`);
    await page.locator('footer a[href$="/credits"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/credits$`));
    await expect(
      page.getByRole("img", { name: "The Movie Database" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "This product uses the TMDB API but is not endorsed or certified by TMDB.",
      ),
    ).toBeVisible();
  }
});
