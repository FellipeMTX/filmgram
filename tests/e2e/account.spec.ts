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

  test("shows private profile collections and records another viewing from the title", async ({
    page,
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Expected the Playwright app origin");
    const { client, userId } = await signUp(page.context(), baseURL);
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("handle")
      .eq("id", userId)
      .single();
    if (profileError) throw profileError;
    const { data: review, error: reviewError } = await client
      .from("reviews")
      .insert({
        user_id: userId,
        media_type: "movie",
        tmdb_id: 1726,
        rating: 0,
        body: "Resenha de perfil com nota zero.",
      })
      .select("id")
      .single();
    if (reviewError) throw reviewError;
    const { error: playlistsError } = await client.from("playlists").insert([
      { user_id: userId, name: "Coleção pública de teste", is_public: true },
      { user_id: userId, name: "Coleção privada de teste", is_public: false },
    ]);
    if (playlistsError) throw playlistsError;

    await page.goto("/pt-BR/title/movie/1726");
    const repeat = page.getByRole("button", {
      name: "Registrar nova exibição",
    });
    await expect(repeat).toHaveCount(0);
    await page.getByRole("button", { name: "Marcar como assistido" }).click();
    await expect(repeat).toBeVisible();
    await page.getByRole("button", { name: "Curtir", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Curtido", exact: true }),
    ).toBeVisible();
    await page.goto("/pt-BR/title/tv/42009");
    await page.getByRole("button", { name: "Marcar como assistido" }).click();
    await expect(
      page.getByRole("button", { name: "Assistido", exact: true }),
    ).toBeVisible();

    await page.goto("/pt-BR/title/movie/1726");
    await repeat.click();
    await expect(page.getByText("Nova exibição registrada.")).toBeVisible();
    await page.goto("/pt-BR/discover");
    const recentShelf = page.getByRole("region", {
      name: "Assistidos recentemente",
    });
    await expect(recentShelf.getByRole("link").first()).toHaveAttribute(
      "href",
      "/pt-BR/title/movie/1726",
    );

    await page.goto("/pt-BR/profile/me");
    const recentProfile = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Vistos recentemente" }),
    });
    await expect(
      recentProfile.locator('a[href*="/title/"]').first(),
    ).toHaveAttribute("href", "/pt-BR/title/movie/1726");
    const accountMenu = page.getByRole("button", { name: "Minha conta" });
    await accountMenu.click();
    const accountOptions = page.getByRole("dialog", { name: "Minha conta" });
    await expect(
      accountOptions.getByRole("link", { name: "Salvos" }),
    ).toHaveAttribute("href", "/pt-BR/favorites");
    await expect(
      accountOptions.getByRole("button", { name: "Sair" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(accountMenu).toBeFocused();
    const profileNav = page.getByRole("navigation", {
      name: "Perfil",
      exact: true,
    });
    await expect(
      page.getByRole("heading", { name: "Vistos recentemente" }),
    ).toBeVisible();
    await expect(page.getByText(/2 exibições/)).toBeVisible();
    await expect(page.getByText("0/10", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Período" }).selectOption("30d");
    await expect(page).toHaveURL(/period=30d/);
    await page.goBack();
    await expect(page.getByRole("combobox", { name: "Período" })).toHaveValue(
      "all",
    );
    await page.goForward();
    await expect(page.getByRole("combobox", { name: "Período" })).toHaveValue(
      "30d",
    );
    await expect(page.getByText(/2 exibições/)).toBeVisible();
    await profileNav
      .getByRole("link", { name: "Assistidos", exact: true })
      .click();
    await expect(page).toHaveURL(/tab=watched/);
    const main = page.getByRole("main");
    await expect(
      main.locator('a[href="/pt-BR/title/movie/1726"]'),
    ).toBeVisible();
    await main.getByRole("link", { name: "Séries", exact: true }).click();
    await expect(page).toHaveURL(/type=tv/);
    await expect(main.getByText("Black Mirror", { exact: true })).toBeVisible();
    await expect(main.locator('a[href="/pt-BR/title/movie/1726"]')).toHaveCount(
      0,
    );
    await page.goBack();
    await expect(
      main.locator('a[href="/pt-BR/title/movie/1726"]'),
    ).toBeVisible();
    await profileNav
      .getByRole("link", { name: "Curtidos", exact: true })
      .click();
    await expect(
      main.locator('a[href="/pt-BR/title/movie/1726"]'),
    ).toBeVisible();
    await expect(main.getByText("Black Mirror", { exact: true })).toHaveCount(
      0,
    );
    await page.goto("/pt-BR/profile/me?tab=liked&type=movie&page=99");
    await expect(
      main.locator('a[href="/pt-BR/title/movie/1726"]'),
    ).toBeVisible();
    await expect(
      main.getByRole("link", { name: "Filmes", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await profileNav
      .getByRole("link", { name: "Playlists", exact: true })
      .click();
    await expect(
      main.getByText("Coleção privada de teste", { exact: true }),
    ).toBeVisible();

    const visitor = await browser.newContext();
    try {
      const publicProfile = await visitor.newPage();
      await publicProfile.goto(`/pt-BR/profile/${profile.handle}?tab=watched`);
      const publicNav = publicProfile.getByRole("navigation", {
        name: "Perfil",
        exact: true,
      });
      await expect(
        publicNav.getByRole("link", { name: "Assistidos", exact: true }),
      ).toHaveCount(0);
      await expect(
        publicNav.getByRole("link", { name: "Curtidos", exact: true }),
      ).toHaveCount(0);
      await expect(publicProfile.getByText(/2 exibições/)).toHaveCount(0);
      await publicNav
        .getByRole("link", { name: "Playlists", exact: true })
        .click();
      await expect(
        publicProfile.getByText("Coleção pública de teste", { exact: true }),
      ).toBeVisible();
      await expect(
        publicProfile.getByText("Coleção privada de teste", { exact: true }),
      ).toHaveCount(0);
      await publicNav
        .getByRole("link", { name: "Resenhas", exact: true })
        .click();
      await expect(
        publicProfile.getByText("Resenha de perfil com nota zero."),
      ).toBeVisible();
      await expect(
        publicProfile.getByRole("link", {
          name: /Resenha de perfil com nota zero/,
        }),
      ).toHaveAttribute("href", /[?&]review=[0-9a-f-]+#review-/);
      await publicProfile
        .getByRole("link", { name: /Resenha de perfil com nota zero/ })
        .click();
      await expect(
        publicProfile
          .locator(`article[id="review-${review.id}"]`)
          .getByText("Resenha de perfil com nota zero."),
      ).toBeVisible();
    } finally {
      await visitor.close();
    }
  });

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
      await save.click();
      const saved = page
        .getByRole("dialog")
        .getByRole("button", { name: /Saved/ });
      await expect(saved).toHaveAttribute("aria-pressed", "false");
      await saved.click();
      await expect(saved).toHaveAttribute("aria-pressed", "true");
      await page.reload();
      await save.click();
      await expect(saved).toHaveAttribute("aria-pressed", "true");
      await page.goto("/en/playlists");
      await page.getByRole("link", { name: "Saved Private" }).click();
      await expect(page).toHaveURL(/\/en\/favorites$/);
      await expect(page.getByRole("link", { name: "Iron Man" })).toBeVisible();

      const strangerPage = await stranger.newPage();
      await strangerPage.goto(`${baseURL}/en/title/movie/1726`);
      await strangerPage
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await expect(
        strangerPage.getByRole("dialog").getByRole("button", { name: /Saved/ }),
      ).toHaveAttribute("aria-pressed", "false");
      await strangerPage.goto(`${baseURL}/en/favorites`);
      await expect(strangerPage.getByText("No favorites yet.")).toBeVisible();

      await page.goto("/en/title/movie/1726");
      await save.click();
      await saved.click();
      await expect(saved).toHaveAttribute("aria-pressed", "false");
      await page.goto("/en/favorites");
      await expect(page.getByRole("link", { name: "Iron Man" })).toHaveCount(0);
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
      await page.getByRole("link", { name: "Reviews", exact: true }).click();
      await page
        .getByRole("button", { name: "Write review", exact: true })
        .click();
      await page
        .getByRole("radio", { name: "8/10", exact: true })
        .locator("..")
        .click();
      const editor = page.getByRole("textbox", { name: "Write a review" });
      await editor.fill(review);
      await editor.press("Control+A");
      await page.getByRole("button", { name: "Bold", exact: true }).click();
      await page.getByRole("button", { name: "Italic", exact: true }).click();
      await expect(editor.locator("strong em, em strong")).toHaveCount(1);
      await page
        .getByRole("button", { name: "Align center", exact: true })
        .click();
      await page.getByRole("button", { name: "Add link", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Link URL" })
        .fill("https://example.com/review");
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      await expect(
        editor.locator('a[href="https://example.com/review"]'),
      ).toHaveCount(1);
      await editor.evaluate((element) => {
        element.focus();
        window
          .getSelection()
          ?.collapse(element.lastChild, element.lastChild?.childNodes.length);
      });
      await page.keyboard.press("Enter");
      await expect(editor.locator("p")).toHaveCount(2);
      await page.keyboard.insertText("https://youtu.be/dQw4w9WgXcQ");
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await expect(
        page.getByRole("article").getByText(review, { exact: true }),
      ).toBeVisible();
      const ownReview = page.getByRole("article").filter({ hasText: review });
      await expect(
        page.getByRole("button", { name: "Write review", exact: true }),
      ).toHaveCount(0);
      await expect(
        ownReview.getByRole("button", { name: "Edit my review" }),
      ).toHaveCount(1);
      await expect(
        page
          .getByRole("article")
          .locator("strong em, em strong")
          .filter({ hasText: review }),
      ).toHaveCount(1);

      const authorLink = page
        .getByRole("article")
        .filter({ hasText: review })
        .getByRole("link", { name: "Filmgram user" });
      await expect(authorLink).toHaveAttribute(
        "href",
        `/en/profile/${profile.handle}`,
      );
      await followerPage.goto(`${baseURL}/en/following`);
      await expect(
        followerPage.getByText(review, { exact: true }),
      ).toBeVisible();
      await followerPage.goto(`${baseURL}/en/profile/${profile.handle}`);
      await expect(
        followerPage.getByText(review, { exact: false }),
      ).toBeVisible();
      await ownReview.getByRole("button", { name: "Delete review" }).click();
      await page
        .getByRole("dialog", { name: "Delete this review?" })
        .getByRole("button", { name: "Delete review" })
        .click();
      await expect(page.getByText(review, { exact: true })).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Write review", exact: true }),
      ).toBeVisible();
      await followerPage.reload();
      await expect(
        followerPage.getByText(review, { exact: false }),
      ).toHaveCount(0);
      await followerPage.goto(`${baseURL}/en/following`);
      await expect(followerPage.getByText(review, { exact: true })).toHaveCount(
        0,
      );
    } finally {
      await follower.close();
    }
  });

  test("a title rating of zero persists and can be edited to seven", async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Expected the Playwright app origin");
    const { client, userId } = await signUp(page.context(), baseURL);
    try {
      await page.goto("/en/title/movie/1726");
      await page.getByRole("link", { name: "Reviews", exact: true }).click();
      await page
        .getByRole("button", { name: "Write review", exact: true })
        .click();
      await page
        .getByRole("radio", { name: "0/10", exact: true })
        .locator("..")
        .click();
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await expect
        .poll(
          async () =>
            (
              await client
                .from("reviews")
                .select("rating")
                .eq("user_id", userId)
                .eq("media_type", "movie")
                .eq("tmdb_id", 1726)
                .single()
            ).data?.rating,
        )
        .toBe(0);
      await page.reload();
      await expect(
        page.getByText("Filmgram rating: 0 out of 10", { exact: true }).first(),
      ).toBeAttached();
      await page.getByRole("button", { name: "Edit my review" }).click();
      await expect(
        page.getByRole("radio", { name: "0/10", exact: true }),
      ).toBeChecked();
      await page
        .getByRole("radio", { name: "7/10", exact: true })
        .locator("..")
        .click();
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await expect
        .poll(
          async () =>
            (
              await client
                .from("reviews")
                .select("rating")
                .eq("user_id", userId)
                .eq("media_type", "movie")
                .eq("tmdb_id", 1726)
                .single()
            ).data?.rating,
        )
        .toBe(7);
      await page.reload();
      await expect(
        page.getByText("Filmgram rating: 7 out of 10", { exact: true }).first(),
      ).toBeAttached();
    } finally {
      const { error } = await client
        .from("reviews")
        .delete()
        .eq("user_id", userId)
        .eq("media_type", "movie")
        .eq("tmdb_id", 1726);
      if (error) throw error;
    }
  });

  test("playlist links respect public and private visibility", async ({
    page,
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Expected the Playwright app origin");
    const { client, userId } = await signUp(page.context(), baseURL);
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("handle")
      .eq("id", userId)
      .single();
    if (profileError || !profile) throw new Error("Expected a public profile");
    const { data: lists, error } = await client
      .from("playlists")
      .insert([
        { user_id: userId, name: "Public E2E playlist", is_public: true },
        { user_id: userId, name: "Private E2E playlist", is_public: false },
      ])
      .select("id,name");
    if (error || !lists)
      throw new Error(error?.message ?? "Expected playlists");
    const publicList = lists.find(
      (list) => list.name === "Public E2E playlist",
    )!;
    const privateList = lists.find(
      (list) => list.name === "Private E2E playlist",
    )!;
    await page.goto(`/en/playlists/${privateList.id}`);
    await expect(
      page.getByRole("heading", { name: privateList.name }),
    ).toBeVisible();
    const visitor = await browser.newContext();
    try {
      const visitorPage = await visitor.newPage();
      const missingProfile = await visitorPage.goto(
        `${baseURL}/en/profile/missing-${randomUUID()}`,
      );
      expect(missingProfile?.status()).toBe(404);
      const missingAssetLikeHandle = await visitorPage.goto(
        "/en/profile/missing-filmgram-profile.png",
      );
      expect(missingAssetLikeHandle?.status()).toBe(404);
      await expect(
        visitorPage.getByRole("heading", { name: "Page not found" }),
      ).toBeVisible();
      const ownProfile = await visitorPage.goto(`${baseURL}/en/profile/me`);
      expect(ownProfile?.status()).toBe(200);
      await visitorPage.goto(`${baseURL}/en/profile/${profile.handle}`);
      await expect(
        visitorPage.getByRole("link", { name: /Public E2E playlist/ }),
      ).toHaveAttribute("href", `/en/playlists/${publicList.id}`);
      await expect(visitorPage.getByText(privateList.name)).toHaveCount(0);
      await visitorPage
        .getByRole("link", { name: /Public E2E playlist/ })
        .click();
      await expect(
        visitorPage.getByRole("heading", { name: publicList.name }),
      ).toBeVisible();
      const response = await visitorPage.goto(
        `${baseURL}/en/playlists/${privateList.id}`,
      );
      expect(response?.status()).toBe(404);
      await expect(
        visitorPage.getByRole("heading", { name: "Page not found" }),
      ).toBeVisible();
      await expect(visitorPage.getByText(privateList.name)).toHaveCount(0);
    } finally {
      await visitor.close();
    }
  });

  test("playlist sections paginate independently and show public authors", async ({
    page,
    browser,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Expected the Playwright app origin");
    const owner = await signUp(page.context(), baseURL);
    const visitor = await browser.newContext();
    try {
      const other = await signUp(visitor, baseURL);
      expect(
        (
          await other.client
            .from("profiles")
            .update({ display_name: "Public Author" })
            .eq("id", other.userId)
        ).error,
      ).toBeNull();
      const suffix = randomUUID();
      const ownRows = Array.from({ length: 25 }, (_, index) => ({
        user_id: owner.userId,
        name: `Own ${suffix} ${index}`,
        is_public: false,
      }));
      const publicRows = Array.from({ length: 25 }, (_, index) => ({
        user_id: other.userId,
        name: `Public ${suffix} ${index}`,
        is_public: true,
      }));
      expect(
        (await owner.client.from("playlists").insert(ownRows)).error,
      ).toBeNull();
      expect(
        (await other.client.from("playlists").insert(publicRows)).error,
      ).toBeNull();
      await page.goto("/en/playlists");
      const ownNav = page.getByRole("navigation", {
        name: "Pagination: Your playlists",
      });
      const publicNav = page.getByRole("navigation", {
        name: "Pagination: Public playlists",
      });
      await expect(page.getByText("by Public Author").first()).toBeVisible();
      await ownNav.getByRole("link", { name: "Next" }).click();
      await expect(page).toHaveURL(/ownPage=2/);
      await publicNav.getByRole("link", { name: "Next" }).click();
      await expect(page).toHaveURL(/ownPage=2.*publicPage=2/);
      await expect(
        page.getByRole("heading", { name: "Your playlists" }),
      ).toBeVisible();
      await page.goto("/en/playlists?ownPage=999&publicPage=999");
      await expect(
        page.getByRole("heading", { name: "Your playlists" }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("navigation", { name: "Pagination: Your playlists" })
          .getByRole("link", { name: "Previous" }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("navigation", { name: "Pagination: Public playlists" })
          .getByRole("link", { name: "Previous" }),
      ).toBeVisible();
    } finally {
      await visitor.close();
    }
  });

  test("playlist owner can reorder two titles", async ({ page, baseURL }) => {
    if (!baseURL) throw new Error("Expected the Playwright app origin");
    const { client } = await signUp(page.context(), baseURL);
    const name = `E2E playlist ${randomUUID()}`;
    await page.goto("/en/playlists");
    await page.getByRole("button", { name: "Create playlist" }).click();
    await page.getByRole("textbox", { name: "Playlist name" }).fill(name);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    for (const title of ["movie/1726", "tv/1434"]) {
      await page.goto(`/en/title/${title}`);
      await page
        .getByRole("button", {
          name: title.startsWith("movie/") ? "Save" : "Save to playlist",
          exact: true,
        })
        .click();
      const destination = page
        .getByRole("dialog")
        .getByRole("button", { name, exact: true });
      await expect(destination).toHaveAttribute("aria-pressed", "false");
      await destination.click();
      await expect(destination).toHaveAttribute("aria-pressed", "true");
    }

    await page.goto("/en/playlists");
    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(/\/en\/playlists\/[0-9a-f-]+$/);
    const rows = page.locator("main ol > li");
    await expect(rows.nth(0)).toContainText("Iron Man");
    await expect(rows.nth(1)).toContainText("Family Guy");
    await expect(page.locator('input[name="expected_ids"]')).toHaveCount(1);

    // Another session changes the order while this page is open.
    const listId = page.url().split("/").pop()!;
    const { data: items, error } = await client
      .from("playlist_items")
      .select("id")
      .eq("playlist_id", listId)
      .order("position");
    if (error || !items || items.length !== 2)
      throw new Error("Expected two playlist items");
    const ids = items.map((item) => item.id);
    const changed = await client.rpc("reorder_playlist_items", {
      p_playlist_id: listId,
      p_expected_ids: ids,
      p_item_ids: [...ids].reverse(),
    });
    expect(changed.error).toBeNull();
    await page.getByRole("button", { name: "Move up: Family Guy" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "order changed",
    );
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
    await expect(rows.nth(0)).toContainText("Family Guy");
    await page.getByRole("button", { name: "Move up: Iron Man" }).click();
    await expect(rows.nth(0)).toContainText("Iron Man");
    await page.reload();
    await expect(rows.nth(0)).toContainText("Iron Man");
    await page.getByRole("button", { name: "Remove: Iron Man" }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText("Family Guy");
  });
});
