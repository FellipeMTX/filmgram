import "server-only";
import { supabase } from "@/integrations/supabase";

export async function getSocialViewer() {
  const db = await supabase();
  if (!db) return { db: null, user: null };
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (
    error &&
    (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500)
  ) {
    throw new Error("Filmgram could not verify the session", { cause: error });
  }
  return { db, user };
}
