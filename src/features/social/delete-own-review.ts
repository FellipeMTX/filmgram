"use server";
import { currentUser, supabase } from "@/integrations/supabase";
import { z } from "zod";

export async function deleteOwnReview(reviewId: string) {
  z.guid().parse(reviewId);
  const [db, user] = await Promise.all([supabase(), currentUser()]);
  if (!db || !user) throw new Error("Authentication required");
  const result = await db
    .from("reviews")
    .delete()
    .eq("id", reviewId)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (result.error || !result.data)
    throw new Error("Review could not be deleted");
}
