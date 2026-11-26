"use server";
import { revalidatePath } from "next/cache";
import { supabase } from "@/integrations/supabase";

export type PlaylistActionState = { error?: "conflict" | "failed" };

export async function updatePlaylistDetail(
  _: PlaylistActionState,
  form: FormData,
): Promise<PlaylistActionState> {
  const db = await supabase();
  if (!db) return { error: "failed" };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "failed" };
  const playlistId = String(form.get("playlist_id") || "");
  const [operation, itemId, extra] = String(form.get("operation") || "").split(
    ":",
  );
  if (!itemId || extra) return { error: "failed" };
  let result;
  if (operation === "remove") {
    result = await db.rpc("remove_playlist_item", {
      p_playlist_id: playlistId,
      p_item_id: itemId,
    });
  } else if (operation === "up" || operation === "down") {
    const expected = String(form.get("expected_ids") || "")
      .split(",")
      .filter(Boolean);
    const ids = [...expected];
    const index = ids.indexOf(itemId);
    const other = index + (operation === "up" ? -1 : 1);
    if (index < 0 || other < 0 || other >= ids.length)
      return { error: "failed" };
    [ids[index], ids[other]] = [ids[other]!, ids[index]!];
    result = await db.rpc("reorder_playlist_items", {
      p_playlist_id: playlistId,
      p_item_ids: ids,
      p_expected_ids: expected,
    });
  } else return { error: "failed" };
  if (result.error)
    return { error: result.error.code === "PT409" ? "conflict" : "failed" };
  revalidatePath("/", "layout");
  return {};
}
