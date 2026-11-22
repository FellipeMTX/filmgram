import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/integrations/supabase";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const raw = request.nextUrl.searchParams.get("next") || "/en/discover";
  const next =
    raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")
      ? raw
      : "/en/discover";
  if (code) {
    const db = await supabase();
    const { error } = (await db?.auth.exchangeCodeForSession(code)) || {
      error: true,
    };
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(
    new URL("/en/discover?auth_error=1", request.url),
  );
}
