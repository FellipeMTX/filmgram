"use server";
import { revalidatePath } from "next/cache";
import { supabase } from "@/integrations/supabase";

export async function createPlaylistFromLibrary(
  form: FormData,
): Promise<{ id?: string; error?: string }> {
  try {
    const db = await supabase();
    if (!db) return { error: "unavailable" };
    const {
      data: { user },
    } = await db.auth.getUser();
    const name = String(form.get("name") || "").trim();
    if (
      !user ||
      !name ||
      name.length > 100 ||
      String(form.get("description") || "").trim().length > 2000
    )
      return { error: "invalid" };
    const { data, error } = await db
      .from("playlists")
      .insert({
        user_id: user.id,
        name,
        description: String(form.get("description") || "").trim() || null,
        is_public: form.has("is_public"),
      })
      .select("id")
      .single();
    if (error || !data) return { error: "failed" };
    revalidatePath("/", "layout");
    return { id: data.id };
  } catch {
    return { error: "failed" };
  }
}
