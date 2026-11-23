import { Card } from "@/components/ui/card";
import { narrow, pageTitle, actionGroup } from "@/lib/layout";
import { Button } from "@/components/ui/button";
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
    <main className={narrow}>
      <Card asChild>
        <section className="[&_h2]:mt-0 [&_h2]:mb-[14px] [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold">
          <h1 className={pageTitle}>{list.name}</h1>
          <p className="text-muted-foreground">
            {list.is_public ? t.publicLabel : t.private}{" "}
            {list.description && `· ${list.description}`}
          </p>
          {items.map((item, index) => (
            <div
              className="flex items-center justify-between border-t border-border py-3"
              key={item.id}
            >
              <Link
                href={`/${locale}/title/${item.media_type}/${item.tmdb_id}`}
              >
                {index + 1}. {item.media_title}
              </Link>
              {user?.id === list.user_id && (
                <div className={actionGroup}>
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
                        <input
                          type="hidden"
                          name="playlist_id"
                          value={list.id}
                        />
                        <input type="hidden" name="ids" value={ids.join(",")} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="h-auto w-auto rounded-none border-0 px-[6px] py-[2px] text-xl font-normal hover:bg-transparent"
                          aria-label={delta < 0 ? t.moveUp : t.moveDown}
                        >
                          {delta < 0 ? "↑" : "↓"}
                        </Button>
                      </form>
                    );
                  })}
                  <form action={removePlaylistItem}>
                    <input type="hidden" name="playlist_id" value={list.id} />
                    <input type="hidden" name="id" value={item.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="h-auto w-auto rounded-none border-0 px-[6px] py-[2px] text-xl font-normal hover:bg-transparent"
                      aria-label={t.remove}
                    >
                      ×
                    </Button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </section>
      </Card>
    </main>
  );
}
