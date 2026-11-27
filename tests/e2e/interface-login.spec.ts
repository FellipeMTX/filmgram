import { expect, test } from "@playwright/test";

test("localizes Google sign-in and shows callback failure in the panel", async ({
  page,
}) => {
  for (const [locale, title, button] of [
    ["pt-BR", "Entre para ver seu perfil", "Entrar com Google"],
    ["en", "Your Filmgram profile", "Sign in with Google"],
    ["es", "Tu perfil en Filmgram", "Continuar con Google"],
  ]) {
    await page.goto(`/${locale}/profile/me?tab=reviews&auth_error=1`);
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: title, level: 1 }),
    ).toBeVisible();
    await expect(main.getByRole("button", { name: button })).toBeEnabled();
    await expect(page.locator("[data-auth-error-global]")).toBeHidden();
    await expect(main.getByRole("alert")).toBeVisible();
    await expect(main.locator('input[name="next"]')).toHaveValue(
      `/${locale}/profile/me?tab=reviews`,
    );
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
  await expect(
    main.getByRole("button", { name: "Entrar com Google" }),
  ).toBeEnabled();
});
