"use server";
import { redirect } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { supabase } from "@/integrations/supabase";
export async function interviewSignIn(
  locale: string,
  _state: boolean,
  form: FormData,
): Promise<boolean> {
  const email = form.get("email"),
    password = form.get("password");
  if (
    email !== "entrevista@filmgram.example" ||
    typeof password !== "string" ||
    !password
  )
    return true;
  const db = await supabase();
  if (!db) return true;
  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return true;
    if (data.user?.app_metadata?.filmgram_interview_demo_v1 !== true) {
      await db.auth.signOut({ scope: "local" });
      return true;
    }
  } catch {
    return true;
  }
  redirect(`/${isLocale(locale) ? locale : "en"}/following`);
}
