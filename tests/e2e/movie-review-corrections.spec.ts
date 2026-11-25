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
    email: `review-correction-${randomUUID()}@example.com`,
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

test("keeps own review unique across pagination and closes an edited modal safely", async ({
  page,
  baseURL,
}) => {
  test.skip(process.env.FILMGRAM_E2E_AUTH !== "1", "Requires local Supabase");
  test.setTimeout(120_000);
  const reader = await account(page.context(), baseURL);
  const authors: Awaited<ReturnType<typeof account>>[] = [];
  const ownId = randomUUID();
  const batchId = randomUUID();
  try {
    for (let i = 0; i < 21; i += 5)
      authors.push(
        ...(await Promise.all(
          Array.from({ length: Math.min(5, 21 - i) }, () => account()),
        )),
      );
    const follow = await reader.db
      .from("follows")
      .insert(
        authors.map((a) => ({ follower_id: reader.id, following_id: a.id })),
      );
    if (follow.error) throw follow.error;
    const own = await reader.db.from("reviews").insert({
      id: ownId,
      user_id: reader.id,
      media_type: "movie",
      tmdb_id: 1003596,
      rating: 0,
      body: "My old review",
      created_at: "2020-01-01T00:00:00Z",
    });
    if (own.error) throw own.error;
    await Promise.all(
      authors.map(async (a, i) => {
        const result = await a.db.from("reviews").insert({
          user_id: a.id,
          media_type: "movie",
          tmdb_id: 1003596,
          rating: 8,
          body: `Followed review ${batchId} ${i}`,
          created_at: "2025-01-01T00:00:00Z",
        });
        if (result.error) throw result.error;
      }),
    );
    await page.goto("/en/title/movie/1003596?tab=reviews&country=CY");
    const ownCard = page.locator(`#review-${ownId}`);
    await expect(
      page.getByRole("heading", { name: "Your review" }),
    ).toBeVisible();
    await expect(ownCard).toHaveCount(1);
    await page.getByRole("button", { name: "Load more", exact: true }).click();
    await expect(
      page.getByText(new RegExp(`^Followed review ${batchId} \\d+$`)),
    ).toHaveCount(21);
    await expect(ownCard).toHaveCount(1);
    const pencil = ownCard.getByRole("button", { name: "Edit my review" });
    await pencil.click();
    const inlineEditor = ownCard.getByRole("textbox", {
      name: "Write a review",
    });
    await expect(inlineEditor).toBeFocused();
    await inlineEditor.fill("Unsaved change");
    page.once("dialog", (dialog) => dialog.dismiss());
    await ownCard.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(inlineEditor).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.keyboard.press("Escape");
    await expect(inlineEditor).toHaveCount(0);
    await expect(pencil).toBeFocused();
    await ownCard.getByRole("button", { name: /Open review/ }).focus();
    await page.keyboard.press("Enter");
    const modal = page.getByRole("dialog");
    await expect(
      modal.getByRole("link", { name: /View title/ }),
    ).toHaveAttribute("href", /country=CY/);
    await modal.getByRole("button", { name: "Edit my review" }).click();
    await expect(
      page.getByRole("textbox", { name: "Write a review" }),
    ).toHaveCount(1);
    await modal.locator('label:has(input[name="rating"][value="1"])').click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.keyboard.press("Escape");
    await expect(modal).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await modal.getByRole("button", { name: "Close full review" }).click();
    await expect(modal).toHaveCount(0);
    await ownCard.getByRole("button", { name: /Open review/ }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("textbox", { name: "Write a review" }),
    ).toHaveCount(0);
    await page.goto(
      `/en/title/movie/1003596?tab=reviews&review=${ownId}#review-${ownId}`,
    );
    await expect(page.locator(`#review-${ownId}`)).toHaveCount(1);
    await expect(
      page.getByRole("heading", { name: "Your review" }),
    ).toBeVisible();
  } finally {
    await Promise.all(
      authors.map((a) => a.db.from("reviews").delete().eq("user_id", a.id)),
    );
    await reader.db.from("reviews").delete().eq("user_id", reader.id);
    await reader.db.from("follows").delete().eq("follower_id", reader.id);
  }
});
