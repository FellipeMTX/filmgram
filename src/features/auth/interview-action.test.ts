import { beforeEach, describe, expect, it, vi } from "vitest";
const { signIn, signOut, supabase, redirect } = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  supabase: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(path);
  }),
}));
vi.mock("@/integrations/supabase", () => ({ supabase }));
vi.mock("next/navigation", () => ({ redirect }));
import { interviewSignIn } from "./interview-action";
function form(email: string, password: string) {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  return data;
}
describe("interview sign-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.mockResolvedValue({
      auth: { signInWithPassword: signIn, signOut },
    });
    signIn.mockResolvedValue({
      error: null,
      data: { user: { app_metadata: { filmgram_interview_demo_v1: true } } },
    });
  });
  it("rejects other accounts before contacting Supabase", async () => {
    expect(
      await interviewSignIn("en", false, form("other@example.com", "secret")),
    ).toBe(true);
    expect(supabase).not.toHaveBeenCalled();
  });
  it("returns the same failure for bad credentials and connection errors", async () => {
    signIn
      .mockResolvedValueOnce({ error: new Error("bad") })
      .mockRejectedValueOnce(new Error("offline"));
    expect(
      await interviewSignIn(
        "en",
        false,
        form("entrevista@filmgram.example", "bad"),
      ),
    ).toBe(true);
    expect(
      await interviewSignIn(
        "en",
        false,
        form("entrevista@filmgram.example", "bad"),
      ),
    ).toBe(true);
  });
  it("signs out an unmarked account", async () => {
    signIn.mockResolvedValueOnce({
      error: null,
      data: { user: { app_metadata: {} } },
    });
    expect(
      await interviewSignIn(
        "en",
        false,
        form("entrevista@filmgram.example", "secret"),
      ),
    ).toBe(true);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(redirect).not.toHaveBeenCalled();
  });
  it("signs in the dedicated account and returns to localized following", async () => {
    await expect(
      interviewSignIn(
        "pt-BR",
        false,
        form("entrevista@filmgram.example", "secret"),
      ),
    ).rejects.toThrow("/pt-BR/following");
    expect(signIn).toHaveBeenCalledWith({
      email: "entrevista@filmgram.example",
      password: "secret",
    });
  });
  it("does not allow a supplied locale to select an unsafe destination", async () => {
    await expect(
      interviewSignIn(
        "../outside",
        false,
        form("entrevista@filmgram.example", "secret"),
      ),
    ).rejects.toThrow("/en/following");
  });
});
