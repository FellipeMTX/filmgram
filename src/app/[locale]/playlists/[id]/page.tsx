import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaylistCover } from "@/components/playlist-cover";
import { PlaylistItems } from "@/features/social/PlaylistItemControls";
import { getPlaylist } from "@/features/social/queries";
import { messages } from "@/i18n/messages";
import { currentUser, supabase } from "@/integrations/supabase";
import { narrow, pageTitle } from "@/lib/layout";

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
  const t = messages(locale);
  const [user, db] = await Promise.all([currentUser(), supabase()]);
  if (!db) notFound();
  const list = await getPlaylist(db, id);
  if (!list) notFound();
  const items = list.playlist_items;
  const countLabel =
    locale === "pt-BR"
      ? items.length === 1
        ? "título"
        : "títulos"
      : locale === "es"
        ? items.length === 1
          ? "título"
          : "títulos"
        : items.length === 1
          ? "title"
          : "titles";
  const empty =
    locale === "pt-BR"
      ? "Esta playlist ainda não tem títulos."
      : locale === "es"
        ? "Esta lista aún no tiene títulos."
        : "This playlist has no titles yet.";
  return (
    <main className={narrow}>
      <Link
        href={`/${locale}/playlists`}
        className="mb-5 inline-block text-sm text-primary hover:underline"
      >
        ← {t.playlists}
      </Link>
      <section className="flex flex-wrap items-center gap-6 border-b border-border pb-8">
        <PlaylistCover
          posterPaths={items.map((item) => item.poster_path)}
          className="w-44 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            {list.is_public ? t.publicLabel : t.private} · {items.length}{" "}
            {countLabel}
          </p>
          <h1 className={`${pageTitle} break-words`}>{list.name}</h1>
          {list.profiles && (
            <Link
              className="text-primary hover:underline"
              href={`/${locale}/profile/${list.profiles.handle}`}
            >
              {list.profiles.display_name}
            </Link>
          )}
          {list.description && (
            <p className="mt-4 whitespace-pre-wrap break-words text-muted-foreground">
              {list.description}
            </p>
          )}
        </div>
      </section>
      {items.length ? (
        <PlaylistItems
          locale={locale}
          playlistId={list.id}
          items={items}
          owner={user?.id === list.user_id}
        />
      ) : (
        <p className="mt-6 text-muted-foreground">{empty}</p>
      )}
    </main>
  );
}
