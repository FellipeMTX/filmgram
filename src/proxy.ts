import { messages } from "@/i18n/messages";
import type { Database } from "@/types/database.generated";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const locale = request.nextUrl.pathname.split("/")[1];
  headers.set(
    "x-filmgram-locale",
    locale === "pt-BR" || locale === "es" ? locale : "en",
  );
  const forwarded = { request: { headers } };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next(forwarded);
  let response = NextResponse.next(forwarded);
  const db = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        headers.set("cookie", request.cookies.toString());
        response = NextResponse.next(forwarded);
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const { error: authError } = await db.auth.getUser();
  const authUnavailable =
    authError?.name === "AuthRetryableFetchError" ||
    (authError?.status ?? 0) >= 500;
  const requestedPlaylist =
    /^\/(?:en|pt-BR|es)\/playlists\/([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\/?$/i.exec(
      request.nextUrl.pathname,
    )?.[1];
  if (
    requestedPlaylist &&
    !authUnavailable &&
    (request.method === "GET" || request.method === "HEAD") &&
    request.headers.get("rsc") !== "1"
  ) {
    // Set the status before a loading boundary starts streaming. RLS is
    // applied to this lookup and again when the page loads the full record.
    const { data, error } = await db
      .from("playlists")
      .select("id")
      .eq("id", requestedPlaylist)
      .maybeSingle();
    if (!error && !data) {
      const lang = locale === "pt-BR" || locale === "es" ? locale : "en";
      const t = messages(lang);
      const missing = new NextResponse(
        `<!doctype html>
        <html lang="${lang}"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
        <meta name="robots" content="noindex"><title>${t.notFound} · Filmgram</title>
        <style>
          body{margin:0;background:#12100f;color:#fbefde;font:1rem system-ui,sans-serif}
          main{max-width:52rem;margin:4rem auto;padding:0 1.25rem}
          a{color:#ff654f}
        </style>
        <main><h1>${t.notFound}</h1><a href="/${lang}/playlists">${t.playlists}</a></main>
        </html>`,
        {
          status: 404,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "private, no-store",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'",
          },
        },
      );
      response.cookies
        .getAll()
        .forEach((cookie) => missing.cookies.set(cookie));
      return missing;
    }
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
