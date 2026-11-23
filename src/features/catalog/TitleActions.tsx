import { actionGroup } from "@/lib/layout";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { toggleTitle, addToPlaylist } from "@/features/social/actions";
import { titleName, type Title } from "@/integrations/tmdb";
import { messages } from "@/i18n/messages";
export function TitleFields({ item }: { item: Title }) {
  return (
    <>
      <input type="hidden" name="media_type" value={item.media_type} />
      <input type="hidden" name="tmdb_id" value={item.id} />
      <input type="hidden" name="media_title" value={titleName(item)} />
      <input type="hidden" name="poster_path" value={item.poster_path || ""} />
      <input
        type="hidden"
        name="genre_ids"
        value={(item.genre_ids || item.genres?.map((x) => x.id) || []).join(
          ",",
        )}
      />
    </>
  );
}
export function TitleActions({
  item,
  locale,
  user,
  states,
  playlists,
}: {
  item: Title;
  locale: string;
  user: boolean;
  states: Record<string, boolean>;
  playlists: { id: string; name: string }[];
}) {
  const t = messages(locale);
  if (!user) return null;
  return (
    <div className={actionGroup}>
      {(
        [
          ["favorites", states.favorites ? t.saved : t.save],
          ["watched", states.watched ? t.watch : t.watched],
          ["title_likes", states.title_likes ? t.liked : t.like],
        ] as [string, string][]
      ).map(([table, label]) => (
        <form action={toggleTitle} key={table}>
          <TitleFields item={item} />
          <input type="hidden" name="table" value={table} />
          <Button
            type="submit"
            variant={table === "favorites" ? "default" : "outline"}
            aria-label={label}
            aria-pressed={!!states[table]}
          >
            {table === "favorites" ? "☆" : table === "watched" ? "✓" : "♡"}{" "}
            {label}
          </Button>
        </form>
      ))}
      {playlists.length > 0 && (
        <form
          action={addToPlaylist}
          className="flex gap-2 [&_select]:max-w-[180px]"
        >
          <TitleFields item={item} />
          <NativeSelect
            name="playlist_id"
            aria-label={t.selectPlaylist}
            required
            defaultValue=""
          >
            <option value="" disabled>
              {t.selectPlaylist}
            </option>
            {playlists.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline">
            {t.add}
          </Button>
        </form>
      )}
    </div>
  );
}
