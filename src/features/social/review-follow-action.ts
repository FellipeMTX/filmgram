"use server";
import { currentUser, supabase } from "@/integrations/supabase";
import { z } from "zod";
import { revalidatePath } from "next/cache";
export async function setReviewAuthorFollow(
  authorId: string,
  following: boolean,
) {
  z.guid().parse(authorId);
  if (typeof following !== "boolean") throw new Error("Invalid request");
  const [db, user] = await Promise.all([supabase(), currentUser()]);
  if (!db || !user || user.id === authorId) throw new Error("Not allowed");
  const key = { follower_id: user.id, following_id: authorId };
  const result = following
    ? await db.from("follows").upsert(key, {
        onConflict: "follower_id,following_id",
        ignoreDuplicates: true,
      })
    : await db.from("follows").delete().match(key);
  if (result.error) throw result.error;
  revalidatePath("/", "layout");
  return following;
}

export async function setProfileAuthorFollow(
  authorId: string,
  following: boolean,
) {
  await setReviewAuthorFollow(authorId, following);
}
