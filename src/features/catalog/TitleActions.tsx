import { actionGroup } from "@/lib/layout";
import { Button } from "@/components/ui/button";
import { toggleTitle } from "@/features/social/actions";
import { titleName, type Title } from "@/integrations/tmdb";
import { TitleCollectionControl } from "./TitleCollectionControl";
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
  playlists: { id: string; name: string; contains: boolean }[];
}) {
  const t = messages(locale);
  if (!user) return null;
  return (
    <div className={actionGroup}>
      <TitleCollectionControl
        locale={locale}
        saved={!!states.favorites}
        playlists={playlists}
      >
        <TitleFields item={item} />
      </TitleCollectionControl>
      {(
        [
          ["watched", states.watched ? t.watch : t.watched],
          ["title_likes", states.title_likes ? t.liked : t.like],
        ] as [string, string][]
      ).map(([table, label]) => (
        <form action={toggleTitle} key={table}>
          <TitleFields item={item} />
          <input type="hidden" name="table" value={table} />
          <Button
            type="submit"
            variant="outline"
            aria-label={label}
            aria-pressed={!!states[table]}
          >
            {table === "watched" ? "✓" : "♡"} {label}
          </Button>
        </form>
      ))}
    </div>
  );
}
