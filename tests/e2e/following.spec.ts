import { expect, test } from "@playwright/test";

test("following asks signed-out visitors to sign in and preserves the return path", async ({
  page,
}) => {
  await page.goto("/pt-BR/following");
  await expect(page.getByRole("heading", { name: "Seguindo" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Google/ })).toBeVisible();
  await expect(page.locator("input[name=next]")).toHaveValue(
    "/pt-BR/following",
  );
});
