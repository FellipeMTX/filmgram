import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { expect, test, type BrowserContext } from "@playwright/test";
import type { Database } from "../../src/types/database.generated";

async function account(context?: BrowserContext, origin?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  if (
    !url ||
    !key ||
    !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
  )
    throw new Error("Use local Supabase for review tests.");
  const cookies = new Map<string, string>();
  const db = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (entries) =>
        entries.forEach(({ name, value }) =>
          value ? cookies.set(name, value) : cookies.delete(name),
        ),
    },
  });
  const { data, error } = await db.auth.signUp({
    email: `follow-pagination-${randomUUID()}@example.com`,
    password: randomUUID(),
    options: { data: { display_name: "Review tester" } },
  });
  if (error || !data.session)
    throw new Error(error?.message || "Missing session");
  if (context && origin)
    await context.addCookies(
      [...cookies].map(([name, value]) => ({ name, value, url: origin })),
    );
  return { db, id: data.session.user.id };
}

test("paginates series reviews, preserves deep links and retries comments safely", async ({
  page,
  baseURL,
}, info) => {
  test.skip(process.env.FILMGRAM_E2E_AUTH !== "1", "Requires local Supabase");
  test.setTimeout(120_000);
  const tmdbId = info.project.name === "desktop" ? 1434 : 1622;
  const reader = await account(page.context(), baseURL);
  const authors: Awaited<ReturnType<typeof account>>[] = [];
  const ownId = randomUUID(),
    selectedId = randomUUID(),
    batch = randomUUID();
  try {
    for (let i = 0; i < 22; i += 5)
      authors.push(
        ...(await Promise.all(
          Array.from({ length: Math.min(5, 22 - i) }, () => account()),
        )),
      );
    const follow = await reader.db
      .from("follows")
      .insert(
        authors
          .slice(0, 20)
          .map((a) => ({ follower_id: reader.id, following_id: a.id })),
      );
    if (follow.error) throw follow.error;
    const own = await reader.db.from("reviews").insert({
      id: ownId,
      user_id: reader.id,
      media_type: "tv",
      tmdb_id: tmdbId,
      rating: 8,
      body: `Own ${batch}`,
      created_at: "2019-01-01T00:00:00Z",
    });
    if (own.error) throw own.error;
    await Promise.all(
      authors.map(async (a, i) => {
        const result = await a.db.from("reviews").insert({
          id: i === 20 ? selectedId : randomUUID(),
          user_id: a.id,
          media_type: "tv",
          tmdb_id: tmdbId,
          rating: 8,
          body: `Rank ${batch} ${i}`,
          created_at: `2025-02-${String(22 - i).padStart(2, "0")}T00:00:00Z`,
        });
        if (result.error) throw result.error;
      }),
    );
    await page.goto(`/en/title/tv/${tmdbId}#review-${selectedId}`);
    await expect(page.locator(`#review-${selectedId}`)).toBeInViewport();
    await page.goto(
      `/en/title/tv/${tmdbId}?review=${selectedId}#review-${selectedId}`,
    );
    await expect(page.locator('[data-reviews-hydrated="true"]')).toBeAttached();
    const ownCard = page.locator(`#review-${ownId}`);
    const selected = page.locator(`#review-${selectedId}`);
    await expect(selected).toHaveCount(1);
    await ownCard.getByRole("button", { name: "Edit my review" }).click();
    const editor = ownCard.getByRole("textbox", { name: "Write a review" });
    await editor.fill("Draft survives following");
    await page.getByRole("button", { name: "Load more", exact: true }).click();
    await expect(
      page.getByText(`Rank ${batch} 21`, { exact: true }),
    ).toBeVisible();
    await selected.getByRole("button", { name: "+ Follow" }).click();
    await expect(
      selected.getByRole("button", { name: "+ Follow" }),
    ).toHaveCount(0);
    await expect(
      page.getByText(`Rank ${batch} 21`, { exact: true }),
    ).toHaveCount(0);
    await expect(editor).toHaveText("Draft survives following");
    await expect(ownCard).toHaveCount(1);
    await expect(selected).toHaveCount(1);
    await page.getByRole("button", { name: "Load more", exact: true }).click();
    await expect(
      page.getByText(`Rank ${batch} 21`, { exact: true }),
    ).toHaveCount(1);
    await expect(ownCard).toHaveCount(1);
    await expect(editor).toHaveText("Draft survives following");

    // A server action can commit even if its response is lost.
    await ownCard.getByRole("button", { name: "Cancel", exact: true }).click();
    const composer = selected.getByRole("textbox", { name: "Write a comment" });
    await expect(composer).toBeVisible();
    const commentText = `Retry ${batch}`;
    await composer.fill(commentText);
    let aborted = false;
    await page.route(`**/en/title/tv/${tmdbId}**`, async (route) => {
      if (
        !aborted &&
        route.request().method() === "POST" &&
        route.request().headers()["next-action"]
      ) {
        aborted = true;
        await route.fetch();
        await route.abort();
      } else await route.continue();
    });
    await selected.getByRole("button", { name: "Post comment" }).click();
    await expect(selected.getByRole("alert")).toBeVisible();
    await selected.getByRole("button", { name: "Post comment" }).click();
    await expect(selected.getByText(commentText, { exact: true })).toHaveCount(
      1,
    );
    const stored = await reader.db
      .from("review_comments")
      .select("id")
      .eq("review_id", selectedId)
      .eq("body", commentText);
    if (stored.error) throw stored.error;
    expect(stored.data).toHaveLength(1);
    await expect(
      selected.getByRole("button", { name: "Comments (1)" }),
    ).toBeVisible();

    const lastText = page.getByText(`Rank ${batch} 21`, { exact: true });
    await lastText.click();
    const discussion = page.getByRole("dialog");
    await discussion.getByRole("button", { name: "Comments (0)" }).click();
    const modalDraft = discussion.getByRole("textbox", {
      name: "Write a comment",
    });
    await modalDraft.fill("Draft stays open after following");
    await discussion
      .getByRole("button", { name: "+ Follow", exact: true })
      .click();
    await expect(
      discussion.getByRole("button", { name: "+ Follow", exact: true }),
    ).toHaveCount(0);
    await expect(modalDraft).toHaveValue("Draft stays open after following");
    await discussion
      .getByRole("button", { name: "Close full review", exact: true })
      .click();
    await expect(discussion).toHaveCount(0);
    await expect(lastText).toHaveCount(0);
  } finally {
    await Promise.all(
      authors.map((a) => a.db.from("reviews").delete().eq("user_id", a.id)),
    );
    await reader.db.from("reviews").delete().eq("user_id", reader.id);
    await reader.db.from("follows").delete().eq("follower_id", reader.id);
  }
});
