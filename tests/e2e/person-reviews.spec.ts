import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../../src/types/database.generated";

// Mirrors the local-only signup helper in account.spec.ts.
async function signUp(context: BrowserContext, origin: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    !url ||
    !key ||
    !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
  )
    throw new Error("Account E2E tests require local Supabase.");
  const cookies = new Map<string, string>();
  const client = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => Array.from(cookies, ([name, value]) => ({ name, value })),
      setAll: (values) => {
        for (const { name, value } of values) {
          if (value) cookies.set(name, value);
          else cookies.delete(name);
        }
      },
    },
  });
  const { data, error } = await client.auth.signUp({
    email: `person-e2e-${randomUUID()}@example.com`,
    password: randomUUID(),
    options: { data: { full_name: "Filmgram E2E" } },
  });
  if (error || !data.session)
    throw new Error(
      error?.message ?? "Enable automatic confirmation on local Supabase.",
    );
  await context.addCookies(
    Array.from(cookies, ([name, value]) => ({ name, value, url: origin })),
  );
  return { client, userId: data.session.user.id };
}

test.describe("professional reviews", () => {
  test.skip(
    process.env.FILMGRAM_E2E_AUTH !== "1",
    "Enable with the local Supabase stack",
  );

  test("create, edit, and delete a review with a referenced work", async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Expected the Playwright app origin");
    const { client, userId } = await signUp(page.context(), baseURL);
    const personId = 15277;
    const body = `E2E thoughtful review ${randomUUID()}`;
    const edited = `${body} edited`;
    try {
      await page.goto(`/en/person/${personId}`);
      const section = page.locator("#person-reviews");
      await section.locator('select[name="rating"]').selectOption("4");
      await section
        .getByRole("textbox", { name: "Review (optional)" })
        .fill(body);
      await section
        .getByRole("searchbox", { name: "Search reference works" })
        .fill("Iron Man");
      await section.getByRole("checkbox", { name: "Iron Man (Film)" }).check();
      await section
        .getByRole("button", { name: "Publish", exact: true })
        .click();
      const article = section.getByRole("article").filter({ hasText: body });
      await expect(article).toBeVisible();
      await expect(section.getByRole("status")).toBeVisible();
      await expect(
        article.getByRole("link", { name: "Iron Man" }),
      ).toHaveAttribute("href", "/en/title/movie/1726");
      await expect(section.locator('select[name="rating"]')).toHaveValue("4");
      await page.reload();
      await expect(
        section.getByRole("checkbox", { name: "Iron Man (Film)" }),
      ).toBeChecked();
      await section.locator('select[name="rating"]').selectOption("5");
      await section
        .getByRole("textbox", { name: "Review (optional)" })
        .fill(edited);
      await section
        .getByRole("button", { name: "Publish", exact: true })
        .click();
      await expect(
        section.getByRole("article").filter({ hasText: edited }),
      ).toBeVisible();
      await expect(section.locator('select[name="rating"]')).toHaveValue("5");
      await section
        .getByRole("button", { name: "Delete review", exact: true })
        .click();
      await expect(
        section.getByRole("button", { name: "Confirm deletion" }),
      ).toBeVisible();
      await section.getByRole("button", { name: "Confirm deletion" }).click();
      await expect(
        section.getByRole("article").filter({ hasText: edited }),
      ).toHaveCount(0);
      await expect(section.locator('select[name="rating"]')).toHaveValue("");
      await expect(section.getByRole("status")).toBeVisible();
    } finally {
      const { error } = await client
        .from("person_reviews")
        .delete()
        .eq("user_id", userId)
        .eq("person_tmdb_id", personId);
      if (error) throw error;
    }
  });

  test("saves a rating without review text or references", async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Expected the Playwright app origin");
    const { client, userId } = await signUp(page.context(), baseURL);
    const personId = 3223;
    try {
      await page.goto(`/en/person/${personId}`);
      const section = page.locator("#person-reviews");
      await section.locator('select[name="rating"]').selectOption("3");
      await section
        .getByRole("button", { name: "Publish", exact: true })
        .click();
      await expect(section.locator('select[name="rating"]')).toHaveValue("3");
      await expect
        .poll(async () => {
          const { data } = await client
            .from("person_reviews")
            .select("rating,body,person_review_works(tmdb_id)")
            .eq("person_tmdb_id", personId)
            .eq("user_id", userId)
            .maybeSingle();
          return data;
        })
        .toMatchObject({ rating: 3, body: null, person_review_works: [] });
      await page.reload();
      await expect(section.locator('select[name="rating"]')).toHaveValue("3");
    } finally {
      const { error } = await client
        .from("person_reviews")
        .delete()
        .eq("user_id", userId)
        .eq("person_tmdb_id", personId);
      if (error) throw error;
    }
  });
});
