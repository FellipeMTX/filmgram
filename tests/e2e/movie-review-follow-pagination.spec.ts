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

test("refreshes review pages after following and keeps the selected review and draft", async ({
  page,
  baseURL,
}) => {
  test.skip(process.env.FILMGRAM_E2E_AUTH !== "1", "Requires local Supabase");
  test.setTimeout(120_000);
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
      media_type: "movie",
      tmdb_id: 1003596,
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
          media_type: "movie",
          tmdb_id: 1003596,
          rating: 8,
          body: `Rank ${batch} ${i}`,
          created_at: `2025-02-${String(22 - i).padStart(2, "0")}T00:00:00Z`,
        });
        if (result.error) throw result.error;
      }),
    );
    await page.goto(
      `/en/title/movie/1003596?tab=reviews&review=${selectedId}#review-${selectedId}`,
    );
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
  } finally {
    await Promise.all(
      authors.map((a) => a.db.from("reviews").delete().eq("user_id", a.id)),
    );
    await reader.db.from("reviews").delete().eq("user_id", reader.id);
    await reader.db.from("follows").delete().eq("follower_id", reader.id);
  }
});
