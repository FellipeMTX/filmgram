import Link from "next/link";
import { messages } from "@/i18n/messages";
import { supabase, currentUser } from "@/integrations/supabase";
import {
  createPlaylist,
  removePlaylistItem,
  reorderPlaylist,
  signIn,
} from "@/features/auth/actions";
type Item = {
  id: string;
  media_type: string;
  tmdb_id: number;
  media_title: string;
  position: number;
};
type Playlist = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  playlist_items: Item[];
};
export default async function Playlists({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params,
    t = messages(locale),
    user = await currentUser(),
    db = await supabase();
  let lists: Playlist[] = [];
  if (db) {
    const { data } = await db
      .from("playlists")
      .select(
        "id,user_id,name,description,is_public,playlist_items(id,media_type,tmdb_id,media_title,position)",
      )
      .order("created_at", { ascending: false });
    lists = (data || []) as Playlist[];
  }
  return (
    <main className="container narrow">
      <p className="eyebrow">{t.collection}</p>
      <h1 className="pageTitle">{t.playlists}</h1>
      {user ? (
        <form className="panel stack" action={createPlaylist}>
          <h2>{t.createPlaylist}</h2>
          <input
            name="name"
            required
            maxLength={100}
            placeholder={t.playlistName}
            aria-label={t.playlistName}
          />
          <input
            name="description"
            placeholder={t.description}
            aria-label={t.description}
          />
          <label>
            <input type="checkbox" name="is_public" /> {t.public}
          </label>
          <button className="button primary">{t.create}</button>
        </form>
      ) : (
        <form action={signIn}>
          <input type="hidden" name="next" value={`/${locale}/playlists`} />
          <button className="button primary">{t.signIn}</button>
        </form>
      )}
      {lists.length ? (
        lists.map((list) => {
          const items = [...(list.playlist_items || [])].sort(
            (a, b) => a.position - b.position,
          );
          return (
            <section className="panel" key={list.id}>
              <h2>{list.name}</h2>
              <p className="muted">
                {list.is_public ? t.publicLabel : t.private}{" "}
                {list.description && `· ${list.description}`}
              </p>
              {items.map((item, index) => (
                <div className="playlistItem" key={item.id}>
                  <Link
                    href={`/${locale}/title/${item.media_type}/${item.tmdb_id}`}
                  >
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
                              name="playlist_id"
                              value={list.id}
                            />
                            <input
                              type="hidden"
                              name="ids"
                              value={ids.join(",")}
                            />
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
          );
        })
      ) : (
        <p className="muted">{t.noPlaylists}</p>
      )}
    </main>
  );
}
