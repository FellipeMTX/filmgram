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
      posts.first().getByRole("link", { name: /Black Mirror/ }),
    ).toBeVisible();
    await expect(posts.nth(1)).toContainText("Title unavailable");
    await expect(page.getByText("Unfollowed review")).toHaveCount(0);
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(posts).toHaveCount(15);
    await expect(page.getByText(/^Feed review \d+$/)).toHaveText(
      cursorIds.map((_, index) => `Feed review ${index + 1}`),
    );
    await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(
      0,
    );
  } finally {
    await followed.db.from("reviews").delete().eq("user_id", followed.id);
    await other.db.from("reviews").delete().eq("user_id", other.id);
    await reader.db.from("follows").delete().eq("follower_id", reader.id);
  }
});
