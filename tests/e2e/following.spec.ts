import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../../src/types/database.generated";
import { expect, test, type BrowserContext } from "@playwright/test";

test("following asks signed-out visitors to sign in and preserves the return path", async ({
  page,
}) => {
  await page.goto("/pt-BR/following");
  await expect(page.getByRole("heading", { name: "Seguindo" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Google/ })).toBeVisible();
  await expect(page.locator("input[name=next]")).toHaveValue(
    "/pt-BR/following",
  );
});

async function account(context?: BrowserContext, origin?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    !url ||
    !key ||
    !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
  )
    throw new Error("Use local Supabase for following tests.");
  const cookies = new Map<string, string>();
  const db = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (entries) => {
        for (const { name, value } of entries) {
          if (value) cookies.set(name, value);
          else cookies.delete(name);
        }
      },
    },
  });
  const { data, error } = await db.auth.signUp({
    email: `feed-e2e-${randomUUID()}@example.com`,
    password: randomUUID(),
    options: { data: { display_name: "Feed reviewer" } },
  });
  if (error || !data.session)
    throw new Error(error?.message || "Missing test session");
  if (context && origin)
    await context.addCookies(
      [...cookies].map(([name, value]) => ({ name, value, url: origin })),
    );
  return { db, id: data.session.user.id };
}

test("loads 12 followed reviews, then appends the rest in stable order", async ({
  page,
  baseURL,
}) => {
  test.skip(process.env.FILMGRAM_E2E_AUTH !== "1", "Requires local Supabase");
  const reader = await account(page.context(), baseURL);
  const followed = await account();
  const other = await account();
  const cursorIds = Array.from({ length: 15 }, () => randomUUID())
    .sort()
    .reverse();
  const created = "2025-01-01T00:00:00+00:00";
  try {
    const { error: followError } = await reader.db.from("follows").insert({
      follower_id: reader.id,
      following_id: followed.id,
    });
    if (followError) throw followError;
    const { error: inFeedError } = await followed.db.from("reviews").insert(
      cursorIds.map((id, index) => ({
        id,
        user_id: followed.id,
        media_type: "tv",
        tmdb_id: index === 0 ? 42009 : 91000000 + index,
        rating: 4,
        body: `Feed review ${index + 1}`,
        created_at: created,
      })),
    );
    if (inFeedError) throw inFeedError;
    const { error: otherError } = await other.db.from("reviews").insert({
      user_id: other.id,
      media_type: "tv",
      tmdb_id: 42009,
      rating: 5,
      body: "Unfollowed review",
      created_at: "2026-01-01T00:00:00+00:00",
    });
    if (otherError) throw otherError;
    await page.goto("/en/following");
    const posts = page.locator("main article");
    await expect(posts).toHaveCount(12);
    await expect(
      posts.first().getByRole("link", { name: /^Black Mirror/ }),
    ).toBeVisible();
    await expect(posts.nth(1)).toContainText("Title unavailable");
    await expect(page.getByText("Unfollowed review")).toHaveCount(0);
    await page.getByRole("button", { name: "Load more reviews" }).click();
    await expect(posts).toHaveCount(15);
    await expect(posts.nth(12)).toBeFocused();
    await expect(page.getByText(/^Feed review \d+$/)).toHaveText(
      cursorIds.map((_, index) => `Feed review ${index + 1}`),
    );
    await expect(
      page.getByRole("button", { name: "Load more reviews" }),
    ).toHaveCount(0);
  } finally {
    await followed.db.from("reviews").delete().eq("user_id", followed.id);
    await other.db.from("reviews").delete().eq("user_id", other.id);
    await reader.db.from("follows").delete().eq("follower_id", reader.id);
  }
});

test("opens only overflowing reviews in the modal and shares their discussion with the title", async ({
  page,
  browser,
  baseURL,
}) => {
  test.skip(process.env.FILMGRAM_E2E_AUTH !== "1", "Requires local Supabase");
  const reader = await account(page.context(), baseURL);
  const authorContext = await browser.newContext();
  const author = await account(authorContext, baseURL);
  const longId = randomUUID();
  const shortId = randomUUID();
  const lines = [
    "Line one",
    "Line two",
    "Line three",
    "Line four",
    "Line five",
    "Line six",
  ];
  const lastLine = "Line seven closes the review";
  const note = `A thought from the feed ${randomUUID()}`;
  const guest = await browser.newContext();
  try {
    const { error: followError } = await reader.db.from("follows").insert({
      follower_id: reader.id,
      following_id: author.id,
    });
    if (followError) throw followError;
    const { error: reviewError } = await author.db.from("reviews").insert([
      {
        id: longId,
        user_id: author.id,
        media_type: "movie",
        tmdb_id: 1726,
        rating: 4,
        body: [...lines, lastLine].join("\n"),
      },
      {
        id: shortId,
        user_id: author.id,
        media_type: "tv",
        tmdb_id: 42009,
        rating: 5,
        body: lines.join("\n"),
      },
    ]);
    if (reviewError) throw reviewError;

    await page.goto("/en/following");
    const longPost = page.locator(`#review-${longId}`);
    const shortPost = page.locator(`#review-${shortId}`);
    await expect(shortPost).toContainText("Line six");
    await expect(
      shortPost.getByRole("button", { name: "Read more" }),
    ).toHaveCount(0);
    const more = longPost.getByRole("button", { name: "Read more" });
    await more.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/Line seven closes the review/),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(more).toBeFocused();

    await longPost
      .getByRole("button", { name: "Like review", exact: true })
      .click();
    await expect(
      longPost.getByRole("button", { name: /unlike review/i }),
    ).toBeVisible();
    await longPost.getByRole("button", { name: /comments/i }).click();
    await longPost.getByRole("textbox", { name: /comment/i }).fill(note);
    await longPost
      .getByRole("button", { name: "Post comment", exact: true })
      .click();
    await expect(longPost.getByText(note)).toBeVisible();
    const draft = "This draft stays on the review";
    await longPost.getByRole("textbox", { name: /comment/i }).fill(draft);
    await more.click();
    await expect(dialog.getByRole("textbox", { name: /comment/i })).toHaveValue(
      draft,
    );
    await expect(dialog.getByText(note)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      longPost.getByRole("textbox", { name: /comment/i }),
    ).toHaveValue(draft);

    await longPost
      .getByRole("link", { name: /view this review on the title page/i })
      .click();
    await expect(page).toHaveURL(/\/en\/title\/movie\/1726/);
    const linkedReview = page.locator(`#review-${longId}`);
    await expect(linkedReview.getByText(note)).toBeVisible();
    await expect(
      linkedReview.getByRole("button", { name: /unlike review/i }),
    ).toBeVisible();

    const authorPage = await authorContext.newPage();
    await authorPage.goto(page.url());
    const original = authorPage.locator(`#review-${longId}`);
    await expect(original.getByText(note)).toBeVisible();
    await original.getByRole("button", { name: "Reply", exact: true }).click();
    await original
      .getByRole("textbox", { name: /comment|reply/i })
      .fill("Reply from the author");
    await original
      .getByRole("button", { name: "Post comment", exact: true })
      .click();
    await expect(original.getByText("Reply from the author")).toBeVisible();

    const visitor = await guest.newPage();
    await visitor.goto(page.url());
    await expect(
      visitor.locator(`#review-${longId}`).getByText(note),
    ).toBeVisible();
    await expect(
      visitor
        .locator(`#review-${longId}`)
        .getByRole("textbox", { name: /comment/i }),
    ).toHaveCount(0);
  } finally {
    await guest.close();
    await authorContext.close();
    await author.db.from("reviews").delete().eq("user_id", author.id);
    await reader.db.from("follows").delete().eq("follower_id", reader.id);
  }
});
