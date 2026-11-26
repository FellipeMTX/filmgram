"use server";
import { revalidatePath } from "next/cache";
import { supabase } from "@/integrations/supabase";

export async function recordRewatch(form: FormData): Promise<void> {
  const mediaType = String(form.get("media_type") || "");
  const tmdbId = Number(form.get("tmdb_id"));
  const requestId = String(form.get("request_id") || "");
  if (
    !["movie", "tv"].includes(mediaType) ||
    !Number.isSafeInteger(tmdbId) ||
    tmdbId <= 0 ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(requestId)
  ) {
    throw new Error("Invalid viewing");
  }
  const db = await supabase();
  if (!db) throw new Error("Authentication is not configured");
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Please sign in");
  const { error } = await db.rpc("record_rewatch", {
    p_media_type: mediaType,
    p_tmdb_id: tmdbId,
    p_request_id: requestId,
  });
  if (error) throw error;
  revalidatePath("/", "layout");
}
