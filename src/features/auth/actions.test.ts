import { beforeEach, describe, expect, it, vi } from "vitest";

const { passwordSignIn, supabase, redirect } = vi.hoisted(() => ({
  passwordSignIn: vi.fn(),
  supabase: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(path);
  }),
}));
vi.mock("@/integrations/supabase", () => ({ supabase }));
vi.mock("next/navigation", () => ({ redirect }));
import { signInWithEmail } from "./actions";

function form(email: string, password: string, next = "/pt-BR/following") {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  data.set("next", next);
  return data;
}

describe("email sign-in", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    redirect.mockImplementation((path: string) => {
      throw new Error(path);
    });
    supabase.mockResolvedValue({
      auth: { signInWithPassword: passwordSignIn },
    });
    passwordSignIn.mockResolvedValue({ error: null });
  });

  it("signs in any valid email, preserving the password and safe return path", async () => {
    await expect(
      signInWithEmail(
        false,
        form(
          "  person@example.com  ",
          " secret ",
          "/es/title/movie/123?tab=reviews",
        ),
      ),
    ).rejects.toThrow("/es/title/movie/123?tab=reviews");
    expect(passwordSignIn).toHaveBeenCalledWith({
      email: "person@example.com",
      password: " secret ",
    });
  });

  it("rejects missing, malformed, or non-string credentials before contacting auth", async () => {
    const file = form("person@example.com", "secret");
    file.set("password", new Blob(["secret"]), "password.txt");
    for (const data of [
      form("", "secret"),
      form("bad", "secret"),
      form("person@example.com", ""),
      file,
    ]) {
      expect(await signInWithEmail(false, data)).toBe(true);
    }
    expect(supabase).not.toHaveBeenCalled();
  });

  it("returns the same failure for unavailable auth, invalid credentials, and network errors", async () => {
    supabase
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("offline"));
    expect(await signInWithEmail(false, form("a@example.com", "bad"))).toBe(
      true,
    );
    expect(await signInWithEmail(false, form("a@example.com", "bad"))).toBe(
      true,
    );
    passwordSignIn
      .mockResolvedValueOnce({ error: new Error("bad credentials") })
      .mockRejectedValueOnce(new Error("offline"));
    expect(await signInWithEmail(false, form("a@example.com", "bad"))).toBe(
      true,
    );
    expect(await signInWithEmail(false, form("a@example.com", "bad"))).toBe(
      true,
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("falls back for an unsafe return path", async () => {
    await expect(
      signInWithEmail(false, form("a@example.com", "secret", "//evil.test")),
    ).rejects.toThrow("/en/discover");
  });
});
