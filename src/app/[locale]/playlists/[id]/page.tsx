import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaylistCover } from "@/components/playlist-cover";
import { MediaImage } from "@/features/catalog/MediaImage";
import { PlaylistItemControls } from "@/features/social/PlaylistItemControls";
import { getPlaylist } from "@/features/social/queries";
import { messages } from "@/i18n/messages";
import { currentUser, supabase } from "@/integrations/supabase";
import { imageUrl } from "@/integrations/tmdb-display";
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
  const ids = items.map((item) => item.id);
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
          <h1 className={pageTitle}>{list.name}</h1>
          {list.profiles && (
            <Link
              className="text-primary hover:underline"
              href={`/${locale}/profile/${list.profiles.handle}`}
            >
              {list.profiles.display_name}
            </Link>
          )}
          {list.description && (
            <p className="mt-4 whitespace-pre-wrap text-muted-foreground">
              {list.description}
            </p>
          )}
        </div>
      </section>
      {items.length ? (
        <ol className="mt-4">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-4 border-b border-border py-3"
            >
              <span className="w-7 text-center text-muted-foreground">
                {index + 1}
              </span>
              <Link
                href={`/${locale}/title/${item.media_type}/${item.tmdb_id}`}
                className="flex min-w-0 flex-1 items-center gap-4 font-semibold hover:text-primary"
              >
                <span className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-center text-xs text-muted-foreground [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
                  <MediaImage
                    src={imageUrl(item.poster_path, "w185")}
                    alt=""
                    fallback={t.noPoster}
                  />
                </span>
                <span>{item.media_title}</span>
              </Link>
              {user?.id === list.user_id && (
                <PlaylistItemControls
                  locale={locale}
                  playlistId={list.id}
                  itemId={item.id}
                  title={item.media_title}
                  ids={ids}
                  index={index}
                />
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-muted-foreground">{empty}</p>
      )}
    </main>
  );
}
