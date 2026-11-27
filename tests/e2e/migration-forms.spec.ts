import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";

for (const isPublic of [false, true]) {
  test(`playlist form preserves ${isPublic ? "public" : "private"} visibility`, async ({
    page,
    context,
    baseURL,
  }) => {
    test.skip(process.env.FILMGRAM_E2E_AUTH !== "1", "Requires local Supabase");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    expect(["127.0.0.1", "localhost"]).toContain(new URL(url).hostname);
    const cookies = new Map<string, string>();
    const db = createServerClient(url, key, {
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
    const { data, error } = await db.auth.signUp({
      email: `migration-${randomUUID()}@example.com`,
      password: randomUUID(),
    });
    expect(error).toBeNull();
    expect(data.session).toBeTruthy();
    await context.addCookies(
      Array.from(cookies, ([name, value]) => ({ name, value, url: baseURL! })),
    );
    await page.goto("/en/playlists");
    const trigger = page.getByRole("button", {
      name: /^Create (first )?playlist$/,
    });
    await trigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    const name = `Migration ${randomUUID()}`;
    await page
      .getByRole("textbox", { name: "Playlist name", exact: true })
      .fill(name);
    const checkbox = page.getByRole("checkbox");
    await checkbox.setChecked(isPublic);
    const form = page.locator("form").filter({ has: checkbox });
    expect(
      await form.evaluate((element) =>
        new FormData(element as HTMLFormElement).has("is_public"),
      ),
    ).toBe(isPublic);
    await form.getByRole("button", { name: "Create", exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("This playlist has no titles yet."),
    ).toBeVisible();
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    const saved = await db
      .from("playlists")
      .select("is_public")
      .eq("name", name)
      .single();
    expect(saved.error).toBeNull();
    expect(saved.data?.is_public).toBe(isPublic);
  });
}
