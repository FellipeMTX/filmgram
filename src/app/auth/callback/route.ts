import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/integrations/supabase";
import {
  appOrigin,
  authErrorPath,
  safeReturnPath,
} from "@/features/auth/redirects";

export async function GET(request: NextRequest) {
  const next = safeReturnPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  const origin = appOrigin();
  if (code) {
    try {
      const db = await supabase();
      const { error } = (await db?.auth.exchangeCodeForSession(code)) || {
        error: true,
      };
      if (!error) return NextResponse.redirect(new URL(next, origin));
    } catch {
      /* Redirect to localized feedback on exchange failures too. */
    }
  }
  return NextResponse.redirect(new URL(authErrorPath(next), origin));
}
