import { expect, test } from "@playwright/test";

test("localizes Google sign-in and shows callback failure in the panel", async ({
  page,
}) => {
  for (const [locale, title, button] of [
    ["pt-BR", "Entre para ver seu perfil", "Entrar com Google"],
    ["en", "Your Filmgram profile", "Sign in with Google"],
    ["es", "Tu perfil en Filmgram", "Continuar con Google"],
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

test("opens the localized test account form from the Google sign-in panel", async ({
  page,
}) => {
  for (const [locale, label, password] of [
    ["pt-BR", "Entrar com conta de teste", "Senha"],
    ["en", "Sign in with a test account", "Password"],
    ["es", "Entrar con una cuenta de prueba", "Contraseña"],
  ] as const) {
    await page.goto(`/${locale}/profile/me`);
    const link = page
      .getByRole("main")
      .getByRole("link", { name: label, exact: true });
    await expect(link).toHaveAttribute("href", `/${locale}/entrevista`);
    await link.focus();
    await link.press("Enter");
    await expect(page).toHaveURL(`/${locale}/entrevista`);
    await expect(page.getByLabel(password, { exact: true })).toBeVisible();
  }
});
