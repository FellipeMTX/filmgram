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
  await expect(
    page.getByRole("button", { name: "Entrar com e-mail", exact: true }),
  ).toBeVisible();
  const returnPaths = page.getByRole("main").locator("input[name=next]");
  await expect(returnPaths).toHaveCount(2);
  for (const input of await returnPaths.all()) {
    await expect(input).toHaveValue("/pt-BR/following");
  }
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
        rating: 8,
        body: `Feed review ${index + 1}`,
        created_at: created,
      })),
    );
    if (inFeedError) throw inFeedError;
    const { error: otherError } = await other.db.from("reviews").insert({
      user_id: other.id,
      media_type: "tv",
      tmdb_id: 42009,
      rating: 10,
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
        rating: 8,
        body: [...lines, lastLine].join("\n"),
        youtube_video_id: "dQw4w9WgXcQ",
      },
      {
        id: shortId,
        user_id: author.id,
        media_type: "tv",
        tmdb_id: 42009,
        rating: 10,
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
    const originUrl = page.url();
    const artwork = shortPost.getByRole("button", { name: /^open review:/i });
    const dialog = page.getByRole("dialog");
    await artwork.click();
    await expect(dialog).toContainText("Line six");
    await expect(
      dialog.getByRole("heading", {
        name: /^(featured review|other reviews)$/i,
      }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(originUrl);
    await page.keyboard.press("Escape");
    await expect(artwork).toBeFocused();
    await shortPost.getByText("Line six", { exact: false }).last().click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    const titleLink = shortPost.locator('a[href*="/title/tv/42009"]').first();
    await expect(titleLink).toHaveCount(1);
    await titleLink.click();
    await expect(page).toHaveURL(/\/en\/title\/tv\/42009/);
    await page.goto(originUrl);

    const more = longPost.getByRole("button", { name: "Read more" });
    await more.click();
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText(/Line seven closes the review/),
    ).toBeVisible();
    const player = dialog
      .getByRole("article")
      .filter({ hasText: lastLine })
      .first()
      .locator('iframe[title="YouTube video player"][src$="/dQw4w9WgXcQ"]');
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    await expect(
      dialog.getByRole("button", { name: /play youtube video/i }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("link", { name: /watch on youtube/i }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(more).toBeFocused();

    await longPost
      .getByRole("button", { name: "Like review", exact: true })
      .click();
    await expect(
      longPost.getByRole("button", { name: /unlike review/i }),
    ).toBeVisible();
    const discuss = longPost.getByRole("button", { name: /open discussion/i });
    await discuss.click();
    await dialog.getByRole("textbox", { name: /comment/i }).fill(note);
    await dialog.getByRole("button", { name: "Post comment" }).click();
    await expect(dialog.getByText(note)).toBeVisible();
    const draft = "This draft stays on the review";
    await dialog.getByRole("textbox", { name: /comment/i }).fill(draft);
    await page.keyboard.press("Escape");
    await expect(discuss).toBeFocused();
    await discuss.click();
    await expect(dialog.getByRole("textbox", { name: /comment/i })).toHaveValue(
      draft,
    );
    await dialog.getByRole("link", { name: /^view title:/i }).click();
    await expect(page).toHaveURL(/\/en\/title\/movie\/1726/);
    await expect(page).toHaveURL(/tab=reviews/);
    const linkedReview = page.locator(`#review-${longId}`);
    await expect(
      linkedReview.locator('iframe[title="YouTube video player"]'),
    ).toBeVisible();
    await expect(linkedReview.getByText(note)).toBeVisible();
    await expect(
      linkedReview.getByRole("button", { name: /unlike review/i }),
    ).toBeVisible();

    const authorPage = await authorContext.newPage();
    await authorPage.goto(`${baseURL}/en/title/movie/1726#review-${longId}`);
    await expect(authorPage).toHaveURL(/tab=reviews/);
    const original = authorPage.locator(`#review-${longId}`);
    await expect(original.getByText(note)).toBeVisible();
    await original.getByRole("button", { name: "Reply", exact: true }).click();
    await original
      .getByRole("textbox", { name: /comment|reply/i })
      .pressSequentially("Reply from the author");
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

test("keeps loaded comments when posting, editing and removing a parent with a reply", async ({
  page,
  baseURL,
}) => {
  test.skip(process.env.FILMGRAM_E2E_AUTH !== "1", "Requires local Supabase");
  const reader = await account(page.context(), baseURL);
  const author = await account();
  const reviewId = randomUUID();
  try {
    const follow = await reader.db.from("follows").insert({
      follower_id: reader.id,
      following_id: author.id,
    });
    if (follow.error) throw follow.error;
    const review = await author.db.from("reviews").insert({
      id: reviewId,
      user_id: author.id,
      media_type: "movie",
      tmdb_id: 1726,
      rating: 8,
      body: "Discussion pagination review",
    });
    if (review.error) throw review.error;
    for (let index = 1; index <= 21; index++) {
      const result = await reader.db.rpc("create_review_comment", {
        p_review_id: reviewId,
        p_parent_id: null,
        p_body: `Seed comment ${index}`,
      });
      if (result.error) throw result.error;
    }
    await page.goto("/en/following");
    await page
      .locator(`#review-${reviewId}`)
      .getByRole("button", { name: /open discussion/i })
      .click();
    const post = page.getByRole("dialog");
    await expect(
      post.getByText("Seed comment 1", { exact: true }),
    ).toBeVisible();
    await expect(
      post.getByText("Seed comment 21", { exact: true }),
    ).toHaveCount(0);
    await post.getByRole("button", { name: "Load more comments" }).click();
    await expect(
      post.getByText("Seed comment 21", { exact: true }),
    ).toBeVisible();
    await post
      .getByRole("textbox", { name: "Write a comment" })
      .fill("A new parent");
    await post.getByRole("button", { name: "Post comment" }).click();
    await expect(post.getByText("A new parent", { exact: true })).toBeVisible();
    await expect(
      post.getByText("Seed comment 21", { exact: true }),
    ).toBeVisible();

    const parentId = await post
      .locator("[data-comment-id]")
      .filter({ hasText: "A new parent" })
      .getAttribute("data-comment-id");
    expect(parentId).toBeTruthy();
    const parent = post.locator(`[data-comment-id="${parentId}"]`);
    await expect(parent.locator("time[datetime]")).toBeVisible();
    await parent
      .getByRole("button", { name: "Like comment", exact: true })
      .click();
    await expect(
      parent.getByRole("button", { name: "Unlike comment", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(parent).toContainText("1 like");
    await parent
      .getByRole("button", { name: "Unlike comment", exact: true })
      .click();
    await expect(parent).toContainText("0 likes");
    await parent.getByRole("button", { name: "Reply", exact: true }).click();
    await expect(
      post.getByRole("textbox", { name: "Write a comment" }),
    ).toBeFocused();
    await expect(
      post.getByRole("status").filter({ hasText: "Replying to @" }),
    ).toBeVisible();
    await post
      .getByRole("textbox", { name: "Write a comment" })
      .pressSequentially("Draft survives cancellation");
    await post.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      post.getByRole("status").filter({ hasText: "Replying to @" }),
    ).toHaveCount(0);
    await expect(
      post.getByRole("textbox", { name: "Write a comment" }),
    ).toHaveValue("Draft survives cancellation");
    await parent.getByRole("button", { name: "Reply", exact: true }).click();
    const replyInput = post.getByRole("textbox", { name: "Write a comment" });
    const prefix = (await replyInput.inputValue()).match(/^@\S+ /)?.[0];
    expect(prefix).toBeTruthy();
    await replyInput.fill(`${prefix}A mention reply`);
    await post.getByRole("button", { name: "Post comment" }).click();
    await expect(post.getByText(/@.*A mention reply/)).toBeVisible();
    await parent
      .getByRole("button", { name: "Edit", exact: true })
      .first()
      .click();
    await parent.getByRole("textbox", { name: "Edit" }).fill("Edited parent");
    await parent.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      parent.getByText("Edited parent", { exact: true }),
    ).toBeVisible();
    await parent
      .getByRole("button", { name: "Delete", exact: true })
      .first()
      .click();
    await expect(
      parent.getByText("Comment removed", { exact: true }),
    ).toBeVisible();
    await expect(post.getByText(/@.*A mention reply/)).toBeVisible();
    await expect(
      post.getByText("Seed comment 21", { exact: true }),
    ).toBeVisible();
  } finally {
    await author.db.from("reviews").delete().eq("user_id", author.id);
    await reader.db.from("follows").delete().eq("follower_id", reader.id);
  }
});

test("localizes the reply composer and cancel state", async ({
  page,
  baseURL,
}) => {
  test.skip(process.env.FILMGRAM_E2E_AUTH !== "1", "Requires local Supabase");
  const reader = await account(page.context(), baseURL);
  const author = await account();
  const reviewId = randomUUID();
  try {
    const follow = await reader.db
      .from("follows")
      .insert({ follower_id: reader.id, following_id: author.id });
    if (follow.error) throw follow.error;
    const review = await author.db.from("reviews").insert({
      id: reviewId,
      user_id: author.id,
      media_type: "movie",
      tmdb_id: 1726,
      rating: 8,
      body: "Localized discussion",
    });
    if (review.error) throw review.error;
    const comment = await author.db.rpc("create_review_comment", {
      p_review_id: reviewId,
      p_parent_id: null,
      p_body: "Original comment",
    });
    if (comment.error) throw comment.error;
    for (const l of [
      {
        locale: "en",
        open: "Open discussion",
        reply: "Reply",
        state: "Replying to",
        textbox: "Write a comment",
        cancel: "Cancel",
        submit: "Post comment",
      },
      {
        locale: "pt-BR",
        open: "Abrir discussão",
        reply: "Responder",
        state: "Respondendo a",
        textbox: "Escreva um comentário",
        cancel: "Cancelar",
        submit: "Publicar comentário",
      },
      {
        locale: "es",
        open: "Abrir discusión",
        reply: "Responder",
        state: "Respondiendo a",
        textbox: "Escribe un comentario",
        cancel: "Cancelar",
        submit: "Publicar comentario",
      },
    ]) {
      await page.goto(`/${l.locale}/following`);
      await page
        .locator(`#review-${reviewId}`)
        .getByRole("button", { name: new RegExp(l.open) })
        .click();
      const dialog = page.getByRole("dialog");
      const original = dialog
        .locator("[data-comment-id]")
        .filter({ hasText: "Original comment" });
      await original
        .getByRole("button", { name: l.reply, exact: true })
        .click();
      const input = dialog.getByRole("textbox", { name: l.textbox });
      await expect(input).toBeFocused();
      await expect(
        dialog.getByText(
          /^(Loading reviews…|Carregando resenhas…|Cargando reseñas…)$/,
        ),
      ).toHaveCount(0);
      await expect(input).toBeFocused();
      const widths = await input.evaluate((node) => ({
        input: node.getBoundingClientRect().width,
        column: node.parentElement!.getBoundingClientRect().width,
      }));
      expect(Math.abs(widths.input - widths.column)).toBeLessThan(2);
      await expect(input).toHaveAttribute(
        "aria-describedby",
        `reply-target-${reviewId}`,
      );
      await expect(
        dialog.getByRole("status").filter({ hasText: l.state }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: l.submit }),
      ).toBeDisabled();
      const prefix = await input.inputValue();
      expect(prefix).toMatch(/^@\S+ $/);
      expect(
        await input.evaluate(
          (node) => (node as HTMLTextAreaElement).selectionStart,
        ),
      ).toBe(prefix.length);
      await input.pressSequentially("Draft");
      await dialog.getByRole("button", { name: l.cancel, exact: true }).click();
      await expect(
        dialog.getByRole("status").filter({ hasText: l.state }),
      ).toHaveCount(0);
      await expect(input).toHaveValue("Draft");
      await original
        .getByRole("button", { name: l.reply, exact: true })
        .click();
      await input.fill(`Edited prefix becomes ordinary ${l.locale}`);
      await expect(
        dialog.getByRole("status").filter({ hasText: l.state }),
      ).toHaveCount(0);
      await dialog.getByRole("button", { name: l.submit }).click();
      await expect(
        dialog.getByText(`Edited prefix becomes ordinary ${l.locale}`, {
          exact: true,
        }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  } finally {
    await author.db.from("reviews").delete().eq("user_id", author.id);
    await reader.db.from("follows").delete().eq("follower_id", reader.id);
  }
});

test("distinguishes a new following list from followed profiles without reviews", async ({
  page,
  baseURL,
}) => {
  test.skip(process.env.FILMGRAM_E2E_AUTH !== "1", "Requires local Supabase");
  if (!baseURL) throw new Error("Expected the Playwright app origin");
  const reader = await account(page.context(), baseURL);
  const author = await account();
  await page.goto("/pt-BR/following");
  await expect(page.getByText(/você ainda não segue/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explorar filmes e séries" }),
  ).toHaveAttribute("href", "/pt-BR/discover");

  const { error } = await reader.db.from("follows").insert({
    follower_id: reader.id,
    following_id: author.id,
  });
  if (error) throw error;
  await page.reload();
  await expect(
    page.getByText("Ainda não há resenhas por aqui", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/você ainda não segue/i)).toHaveCount(0);
});
