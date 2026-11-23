import { expect, test } from "@playwright/test";

test("header keeps its selected flag and centers desktop navigation", async ({
  page,
}) => {
  for (const locale of ["en", "pt-BR", "es"]) {
    await page.goto(`/${locale}/discover?type=all`);
    for (const width of [320, 700, 701, 768, 900, 1650]) {
      await page.setViewportSize({ width, height: 900 });
      const header = page.locator("header");
      await expect(header.getByRole("combobox").locator("svg")).toHaveCount(2);
      const navigation = header.locator("nav");
      if (width <= 700) {
        await expect(navigation).toBeHidden();
        await expect(page.locator("body > nav")).toBeVisible();
      } else {
        const bounds = await navigation.boundingBox();
        const logo = await header
          .getByRole("link", { name: "Filmgram." })
          .boundingBox();
        const language = await header.getByRole("combobox").boundingBox();
        expect(bounds).not.toBeNull();
        expect(
          Math.abs(bounds!.x + bounds!.width / 2 - width / 2),
        ).toBeLessThan(2);
        expect(logo!.x + logo!.width).toBeLessThanOrEqual(bounds!.x);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(language!.x);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
    }
  }
});

test("hero shows real progress, only dots in the capsule, and a reachable pause", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/en/discover?type=movie");
  const hero = page.getByRole("region", { name: "Featured titles" });
  await page.mouse.move(0, 0);
  const first = hero.getByRole("button", { name: "Show highlight 1 of 5" });
  await expect(first).toHaveAttribute("aria-current", "true");
  await expect(hero.getByRole("button", { name: "Next titles" })).toHaveCount(
    0,
  );
  await expect(
    hero.getByRole("button", { name: "Previous titles" }),
  ).toHaveCount(0);
  await expect(hero.getByText("View details", { exact: true })).toHaveCount(0);
  const pause = hero.getByRole("button", { name: "Pause highlights" });
  await expect(pause).toBeInViewport();
  await page.clock.runFor(3000);
  const fraction = await first.evaluate((button) => {
    const track = button.firstElementChild!;
    const fill = track.firstElementChild!;
    return (
      fill.getBoundingClientRect().width / track.getBoundingClientRect().width
    );
  });
  expect(fraction).toBeGreaterThan(0.2);
  expect(fraction).toBeLessThan(0.9);
  await pause.click();
  await page.mouse.move(0, 0);
  await page.keyboard.press("Tab");
  const current = await hero.getByRole("link").getAttribute("href");
  await page.clock.runFor(12000);
  await expect(hero.getByRole("link")).toHaveAttribute("href", current!);
  await expect(
    hero.getByRole("button", { name: "Play highlights" }),
  ).toBeVisible();
});

test("language change preserves the title route and query", async ({
  page,
}) => {
  await page.goto("/en/title/movie/1726?source=discovery");
  const language = page.getByRole("combobox", {
    name: "Language",
    exact: true,
  });
  await language.click();
  await page
    .getByRole("option", { name: "Português (Brasil)", exact: true })
    .click();
  await expect(page).toHaveURL(
    /\/pt-BR\/title\/movie\/1726\?source=discovery$/,
  );
  await expect(page.locator("header").getByRole("combobox")).toContainText(
    "PT",
  );
});
