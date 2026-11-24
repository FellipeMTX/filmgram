"use server";

import { supabase } from "@/integrations/supabase";
import { getReviewComments } from "./review-discussion-queries";

export async function loadReviewComments(
  reviewId: string,
  cursor?: { createdAt: string; id: string },
) {
  const db = await supabase();
  if (!db) throw new Error("Database unavailable");
  return getReviewComments(db, reviewId, cursor);
}
