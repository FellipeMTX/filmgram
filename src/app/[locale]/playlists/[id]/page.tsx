import Link from "next/link";
import { notFound } from "next/navigation";
import { messages } from "@/i18n/messages";
import { currentUser, supabase } from "@/integrations/supabase";
import { getPlaylist } from "@/features/social/queries";
import { removePlaylistItem, reorderPlaylist } from "@/features/social/actions";

export default async function PlaylistDetail({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    notFound();
  const t = messages(locale),
    user = await currentUser(),
    db = await supabase();
  if (!db) notFound();
  const list = await getPlaylist(db, id);
  if (!list) notFound();
  const items = [...list.playlist_items].sort(
    (a, b) => a.position - b.position,
  );
  return (
    <main className="container narrow">
      <section className="panel">
        <h1 className="pageTitle">{list.name}</h1>
        <p className="muted">
          {list.is_public ? t.publicLabel : t.private}{" "}
          {list.description && `· ${list.description}`}
        </p>
        {items.map((item, index) => (
          <div className="playlistItem" key={item.id}>
            <Link href={`/${locale}/title/${item.media_type}/${item.tmdb_id}`}>
              {index + 1}. {item.media_title}
            </Link>
            {user?.id === list.user_id && (
              <div className="actionGroup">
                {[-1, 1].map((delta) => {
                  const ids = items.map((i) => i.id);
                  const other = index + delta;
                  if (other < 0 || other >= ids.length) return null;
                  [ids[index], ids[other]] = [ids[other]!, ids[index]!];
                  return (
                    <form action={reorderPlaylist} key={delta}>
                      <input
                        type="hidden"
                        name="expected_ids"
                        value={items.map((i) => i.id).join(",")}
                      />
                      <input type="hidden" name="playlist_id" value={list.id} />
                      <input type="hidden" name="ids" value={ids.join(",")} />
                      <button
                        className="iconButton"
                        aria-label={delta < 0 ? t.moveUp : t.moveDown}
                      >
                        {delta < 0 ? "↑" : "↓"}
                      </button>
                    </form>
                  );
                })}
                <form action={removePlaylistItem}>
                  <input type="hidden" name="playlist_id" value={list.id} />
                  <input type="hidden" name="id" value={item.id} />
                  <button className="iconButton" aria-label={t.remove}>
                    ×
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
