const fallback = "/en/discover";

/** Canonical application origin; never derive OAuth redirects from request headers. */
export function appOrigin(): string {
  const configured = process.env.APP_ORIGIN;
  if (!configured && process.env.NODE_ENV !== "production")
    return "http://127.0.0.1:3103";
  if (!configured) throw new Error("APP_ORIGIN is required");
  const url = new URL(configured);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  )
    throw new Error("Invalid APP_ORIGIN");
  return url.origin;
}

export function safeReturnPath(raw: string | null | undefined): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(raw) ||
    /%(?:2f|5c|00|0[0-9a-f]|1[0-9a-f]|7f)/i.test(raw)
  )
    return fallback;
  try {
    const origin = "https://filmgram.invalid";
    const url = new URL(raw, origin);
    if (
      url.origin !== origin ||
      !/^\/(en|pt-BR|es)\/(?:discover|following|playlists|favorites|profile\/[a-zA-Z0-9_]+|title\/(?:movie|tv)\/[1-9][0-9]*|person\/[1-9][0-9]*|credits)\/?$/.test(
        url.pathname,
      )
    )
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function authErrorPath(path: string): string {
  const url = new URL(safeReturnPath(path), "https://filmgram.invalid");
  url.searchParams.set("auth_error", "1");
  return url.pathname + url.search + url.hash;
}
