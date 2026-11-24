import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, getUser, revalidatePath } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getUser: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/integrations/supabase", () => ({
  supabase: async () => ({ auth: { getUser }, rpc }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));
import { updatePlaylistDetail } from "./playlist-detail-actions";
function form(operation: string) {
  const data = new FormData();
  data.set("playlist_id", "list");
  data.set("item_id", "b");
  data.set("expected_ids", "a,b,c");
  data.set("operation", operation);
  return data;
}
describe("playlist detail actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
    rpc.mockResolvedValue({ error: null });
  });
  it("sends the complete expected order and the swapped order", async () => {
    expect(await updatePlaylistDetail({}, form("up"))).toEqual({});
    expect(rpc).toHaveBeenCalledWith("reorder_playlist_items", {
      p_playlist_id: "list",
      p_expected_ids: ["a", "b", "c"],
      p_item_ids: ["b", "a", "c"],
    });
    expect(revalidatePath).toHaveBeenCalled();
  });
  it("returns an inline conflict when the order changed", async () => {
    rpc.mockResolvedValue({ error: { code: "40001" } });
    expect(await updatePlaylistDetail({}, form("down"))).toEqual({
      error: "conflict",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("requires authentication and uses the remove RPC", async () => {
    await updatePlaylistDetail({}, form("remove"));
    expect(rpc).toHaveBeenCalledWith("remove_playlist_item", {
      p_playlist_id: "list",
      p_item_id: "b",
    });
    getUser.mockResolvedValue({ data: { user: null } });
    rpc.mockClear();
    expect(await updatePlaylistDetail({}, form("remove"))).toEqual({
      error: "failed",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
