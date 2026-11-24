"use server";

import { supabase } from "@/integrations/supabase";
import { getReviewComments } from "./review-discussion-queries";

export async function loadReviewComments(
  reviewId: string,
  parentId: string | null,
  cursor?: { createdAt: string; id: string },
) {
  const db = await supabase();
  if (!db) throw new Error("Database unavailable");
  return getReviewComments(db, reviewId, parentId, cursor);
}
