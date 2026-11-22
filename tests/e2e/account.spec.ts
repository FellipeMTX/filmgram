import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../../src/types/database.generated";

async function signUp(context: BrowserContext, origin: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    !url ||
    !key ||
    !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
  ) {
    throw new Error("Account E2E tests require a local Supabase instance.");
  }

  const cookies = new Map<string, string>();
  const client = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => Array.from(cookies, ([name, value]) => ({ name, value })),
      setAll: (newCookies) => {
        for (const { name, value } of newCookies) {
          if (value) cookies.set(name, value);
          else cookies.delete(name);
        }
      },
    },
  });
  const { data, error } = await client.auth.signUp({
    email: `e2e-${randomUUID()}@example.com`,
    password: randomUUID(),
    options: { data: { full_name: "Filmgram E2E" } },
  });
  if (error || !data.session) {
    throw new Error(
      error?.message ??
        "Enable automatic confirmation on the local test instance.",
    );
  }
  await context.addCookies(
    Array.from(cookies, ([name, value]) => ({ name, value, url: origin })),
  );
  return { client, userId: data.session.user.id };
}

test.describe("signed-in account", () => {
  test.skip(
    process.env.FILMGRAM_E2E_AUTH !== "1",
    "Enable with the local Supabase stack",
  );

  test("favorites persist for their owner and are isolated from another account", async ({
    page,
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Expected the Playwright app origin");
    await signUp(page.context(), baseURL);
    const stranger = await browser.newContext();
    try {
      await signUp(stranger, baseURL);
      await page.goto("/en/title/movie/1726");
      const save = page.getByRole("button", { name: "Save", exact: true });
      await expect(save).toBeVisible();
      await save.click();

      const saved = page.getByRole("button", {
        name: /saved|remove (?:from )?favorites/i,
      });
      await expect(saved).toBeVisible();
      await page.reload();
      await expect(saved).toBeVisible();

      const strangerPage = await stranger.newPage();
      await strangerPage.goto(`${baseURL}/en/title/movie/1726`);
      await expect(
        strangerPage.getByRole("button", { name: "Save", exact: true }),
      ).toBeVisible();
    } finally {
      await stranger.close();
    }
  });

  test("a review reaches followers and the author's public profile", async ({
    page,
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Expected the Playwright app origin");
    const { client, userId } = await signUp(page.context(), baseURL);
    const { data: profile, error } = await client
      .from("profiles")
      .select("handle")
      .eq("id", userId)
      .single();
    if (error || !profile)
      throw new Error(error?.message ?? "Expected a public profile");

    const follower = await browser.newContext();
    try {
      await signUp(follower, baseURL);
      const followerPage = await follower.newPage();
      await followerPage.goto(`${baseURL}/en/profile/${profile.handle}`);
      await followerPage
        .getByRole("button", { name: "Follow", exact: true })
        .click();
      await expect(
        followerPage.getByRole("button", { name: "Unfollow", exact: true }),
      ).toBeVisible();

      const review = `Quiet thriller with a vivid sense of place. ${randomUUID()}`;
      await page.goto("/en/title/movie/1726");
      const rating = page.locator('select[name="rating"]');
      await rating.selectOption("4");
      await page.getByRole("textbox", { name: "Write a review" }).fill(review);
      await page
        .getByRole("textbox", { name: /YouTube URL/ })
        .fill("https://youtu.be/dQw4w9WgXcQ");
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await expect(
        page.getByRole("article").getByText(review, { exact: true }),
      ).toBeVisible();

      await followerPage.goto(`${baseURL}/en/following`);
      await expect(
        followerPage.getByText(review, { exact: true }),
      ).toBeVisible();
      await followerPage.goto(`${baseURL}/en/profile/${profile.handle}`);
      await expect(
        followerPage.getByText(review, { exact: false }),
      ).toBeVisible();
    } finally {
      await follower.close();
    }
  });

  test("playlist owner can reorder two titles", async ({ page, baseURL }) => {
    if (!baseURL) throw new Error("Expected the Playwright app origin");
    await signUp(page.context(), baseURL);
    const name = `E2E playlist ${randomUUID()}`;
    await page.goto("/en/playlists");
    await page.getByRole("textbox", { name: "Playlist name" }).fill(name);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    for (const title of ["movie/1726", "tv/1434"]) {
      await page.goto(`/en/title/${title}`);
      await page
        .getByRole("combobox", { name: "Choose a playlist" })
        .selectOption({ label: name });
      const [response] = await Promise.all([
        page.waitForResponse(
          (candidate) =>
            candidate.request().method() === "POST" &&
            candidate.url() === page.url(),
        ),
        page.getByRole("button", { name: "Add", exact: true }).click(),
      ]);
      expect(response.ok()).toBeTruthy();
    }

    await page.goto("/en/playlists");
    await expect(
      page.getByRole("link", { name: /1\. Iron Man/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /2\. Family Guy/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Move up", exact: true }).click();
    await expect(
      page.getByRole("link", { name: /1\. Family Guy/ }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("link", { name: /2\. Iron Man/ }),
    ).toBeVisible();
  });
});
