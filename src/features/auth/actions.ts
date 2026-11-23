"use server";
import { appOrigin, authErrorPath, safeReturnPath } from "./redirects";
import { redirect } from "next/navigation";
import { supabase } from "@/integrations/supabase";
const text = (f: FormData, k: string) => String(f.get(k) || "").trim();
export async function signIn(form: FormData) {
  const next = safeReturnPath(text(form, "next"));
  const db = await supabase();
  if (!db) redirect(authErrorPath(next));
  let origin: string;
  try {
    origin = appOrigin();
  } catch {
    redirect(authErrorPath(next));
  }
  let destination: string | null = null;
  try {
    const { data, error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (!error) destination = data.url;
  } catch {
    /* Show the same localized failure for network errors. */
  }
  if (!destination) redirect(authErrorPath(next));
  redirect(destination);
}
export async function signOut(form: FormData) {
  const db = await supabase();
  await db?.auth.signOut();
  redirect(safeReturnPath(text(form, "next")));
}
