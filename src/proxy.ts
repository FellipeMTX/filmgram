import type { Database } from "@/types/database.generated";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
function decodeSegment(segment: string | undefined) {
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("x-filmgram-internal-missing");
  const locale = request.nextUrl.pathname.split("/")[1];
  headers.set(
    "x-filmgram-locale",
    locale === "pt-BR" || locale === "es" ? locale : "en",
  );
  const forwarded = { request: { headers } };
  function rewriteMissing(playlist: boolean) {
    const destination = request.nextUrl.clone();
    const lang = locale === "pt-BR" || locale === "es" ? locale : "en";
    destination.pathname = `/${lang}/missing`;
    destination.search = playlist ? "?playlist=1" : "";
    const internalHeaders = new Headers(headers);
    internalHeaders.set("x-filmgram-internal-missing", "1");
    const missing = NextResponse.rewrite(destination, {
      status: 404,
      request: { headers: internalHeaders },
    });
    missing.headers.set("Cache-Control", "private, no-store");
    missing.headers.set("X-Robots-Tag", "noindex");
    return missing;
  }
  const playlistPath = /^\/(?:en|pt-BR|es)\/playlists\/([^/]+)\/?$/i.exec(
    request.nextUrl.pathname,
  );
  const playlistId = decodeSegment(playlistPath?.[1]);
  if (
    playlistPath &&
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(playlistId ?? "") &&
    (request.method === "GET" || request.method === "HEAD") &&
    request.headers.get("rsc") !== "1"
  ) {
    return rewriteMissing(true);
  }
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
  const requestedPlaylist = playlistId;
  const profileMatch = /^\/(?:en|pt-BR|es)\/profile\/([^/]+)\/?$/.exec(
    request.nextUrl.pathname,
  );
  const handle = decodeSegment(profileMatch?.[1]);
  const requestedProfile = handle === "me" ? undefined : handle;
  if (
    (requestedPlaylist || requestedProfile) &&
    !authUnavailable &&
    (request.method === "GET" || request.method === "HEAD") &&
    request.headers.get("rsc") !== "1"
  ) {
    // Set the status before a loading boundary starts streaming. RLS is
    // applied to this lookup and again when the page loads the full record.
    const { data, error } = requestedPlaylist
      ? await db
          .from("playlists")
          .select("id")
          .eq("id", requestedPlaylist)
          .maybeSingle()
      : await db
          .from("profiles")
          .select("id")
          .eq("handle", requestedProfile!)
          .maybeSingle();
    if (!error && !data) {
      const missing = rewriteMissing(!!requestedPlaylist);
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
    "/:locale/profile/:username",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
