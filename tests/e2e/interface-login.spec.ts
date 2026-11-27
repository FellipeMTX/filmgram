import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("localizes Google sign-in and shows callback failure in the panel", async ({
  page,
}) => {
  for (const [locale, title, button] of [
    ["pt-BR", "Entre no Filmgram", "Entrar com Google"],
    ["en", "Sign in to Filmgram", "Sign in with Google"],
    ["es", "Entra en Filmgram", "Continuar con Google"],
  ]) {
    await page.goto(
      `/${locale}/profile/me?tab=reviews&auth_error=1&utm_content=%2Fbanner`,
    );
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: title, level: 1 }),
    ).toBeVisible();
    await expect(main.getByRole("button", { name: button })).toBeEnabled();
    await expect(page.locator("[data-auth-error-global]")).toBeHidden();
    await expect(main.getByRole("alert")).toBeVisible();
    await expect(main.getByRole("button", { name: button })).toBeFocused();
    const returnPaths = main.locator('input[name="next"]');
    await expect(returnPaths).toHaveCount(2);
    for (const input of await returnPaths.all()) {
      await expect(input).toHaveValue(`/${locale}/profile/me?tab=reviews`);
    }
  }
});

test("shows compact sign-in alongside public film reviews", async ({
  page,
}) => {
  await page.goto("/pt-BR/title/movie/1726");
  await expect(
    page.getByRole("heading", { name: /^(Iron Man|Homem de Ferro)$/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Resenhas", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Resenhas da comunidade" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Entre para escrever uma resenha" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Entrar com Google", exact: true }),
  ).toBeVisible();
});

test("shows the pending sign-in state and enables retry after OAuth fails", async ({
  page,
}) => {
  let release!: () => void;
  const allowRequest = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/pt-BR/profile/me**", async (route) => {
    if (route.request().method() === "POST") await allowRequest;
    await route.continue();
  });
  await page.goto("/pt-BR/profile/me?tab=reviews");
  const main = page.getByRole("main");
  try {
    await main.getByRole("button", { name: "Entrar com Google" }).click();
    await expect(
      main.getByRole("button", { name: "Conectando…" }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(page).toHaveURL(/tab=reviews&auth_error=1/);
  await expect(main.getByRole("alert")).toBeVisible();
  const retry = main.getByRole("button", { name: "Entrar com Google" });
  await expect(retry).toBeEnabled();
  await expect(retry).toBeFocused();
  const secondAttempt = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/pt-BR/profile/me"),
  );
  await retry.click();
  await secondAttempt;
  await expect(retry).toBeEnabled();
  await expect(retry).toBeFocused();
});

test("returns to the selected movie reviews section if Google sign-in fails", async ({
  page,
}) => {
  await page.goto("/pt-BR/title/movie/01726?tab=reviews#reviews");
  const button = page.getByRole("button", { name: "Entrar com Google" });
  await button.click();
  await expect(page).toHaveURL(
    /\/title\/movie\/1726\?tab=reviews&auth_error=1#reviews$/,
  );
  await expect(page.locator("main [data-auth-error-local]")).toBeVisible();
});

const locales = [
  {
    locale: "pt-BR",
    title: "Entre no Filmgram",
    google: "Entrar com Google",
    email: "E-mail",
    password: "Senha",
    submit: "Entrar com e-mail",
    failure: "Não foi possível entrar. Confira seus dados e tente novamente.",
    write: "Escrever resenha",
    emptyFollowing: "Você ainda não segue ninguém",
  },
  {
    locale: "en",
    title: "Sign in to Filmgram",
    google: "Sign in with Google",
    email: "Email",
    password: "Password",
    submit: "Sign in with email",
    failure: "Could not sign in. Check your details and try again.",
    write: "Write review",
    emptyFollowing: "You aren't following anyone yet",
  },
  {
    locale: "es",
    title: "Entra en Filmgram",
    google: "Continuar con Google",
    email: "Correo electrónico",
    password: "Contraseña",
    submit: "Entrar con correo electrónico",
    failure:
      "No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.",
    write: "Escribir reseña",
    emptyFollowing: "Aún no sigues a nadie",
  },
] as const;

test("shows both sign-in options immediately on profile and interview routes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const { locale, title, google, email, password, submit } of locales) {
    for (const path of ["profile/me", "entrevista"]) {
      await page.goto(`/${locale}/${path}`);
      const main = page.getByRole("main");
      await expect(
        main.getByRole("heading", { name: title, level: 1 }),
      ).toBeVisible();
      await expect(
        main.getByRole("button", { name: google, exact: true }),
      ).toBeEnabled();
      const emailInput = main.getByLabel(email, { exact: true });
      const passwordInput = main.getByLabel(password, { exact: true });
      const submitButton = main.getByRole("button", {
        name: submit,
        exact: true,
      });
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(submitButton).toBeEnabled();
      await emailInput.focus();
      await page.keyboard.press("Tab");
      await expect(passwordInput).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(submitButton).toBeFocused();
    }
  }
});

test("email sign-in retries and returns to the original route or following", async ({
  page,
}) => {
  test.setTimeout(120_000);
  test.skip(process.env.FILMGRAM_E2E_AUTH !== "1", "Requires local Supabase");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    !url ||
    !key ||
    !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
  ) {
    throw new Error("Email sign-in E2E requires a local Supabase instance.");
  }
  const client = createClient(url, key, { auth: { persistSession: false } });
  const email = `e2e-${randomUUID()}@example.com`;
  const password = randomUUID();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { full_name: "Filmgram E2E" } },
  });
  if (error || !data.session) {
    throw new Error(
      error?.message ??
        "Enable automatic confirmation on the local test instance.",
    );
  }

  for (const {
    locale,
    email: emailLabel,
    password: passwordLabel,
    submit,
    failure,
    write,
    emptyFollowing,
  } of locales) {
    for (const [path, destination] of [
      [
        "title/movie/1726?tab=reviews#reviews",
        `/${locale}/title/movie/1726?tab=reviews#reviews`,
      ],
      ["entrevista", `/${locale}/following`],
    ] as const) {
      await page.context().clearCookies();
      await page.goto(`/${locale}/${path}`);
      const main = page.getByRole("main");
      await main.getByLabel(emailLabel, { exact: true }).fill(email);
      const passwordInput = main.getByLabel(passwordLabel, { exact: true });
      if (path !== "entrevista") {
        await passwordInput.fill("incorrect-password");
        await main.getByRole("button", { name: submit, exact: true }).click();
        await expect(main.getByRole("alert")).toHaveText(failure);
      }
      await passwordInput.fill(password);
      await passwordInput.press("Enter");
      await expect(page).toHaveURL(destination);
      await expect(passwordInput).toHaveCount(0);
      if (path === "entrevista") {
        await expect(
          main.getByText(emptyFollowing, { exact: true }),
        ).toBeVisible();
      } else {
        await expect(
          main.getByRole("button", { name: write, exact: true }),
        ).toBeVisible();
      }
    }
  }
});
