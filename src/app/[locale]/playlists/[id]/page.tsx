import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaylistCover } from "@/components/playlist-cover";
import { PlaylistItems } from "@/features/playlists/PlaylistItemControls";
import { SocialEmpty } from "@/features/social/SocialEmpty";
import { getPlaylist } from "@/features/playlists/queries";
import { messages } from "@/i18n/messages";
import { getSocialViewer } from "@/features/social/social-viewer";
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
  const { user, db } = await getSocialViewer();
  if (!db) throw new Error("Playlists database unavailable");
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
  const owner = user?.id === list.user_id;
  const howToAdd =
    locale === "pt-BR"
      ? "Salve um filme ou série na página do título para adicioná-lo a esta playlist."
      : locale === "es"
        ? "Guarda una película o serie desde su ficha para añadirla a esta lista."
        : "Save a film or series from its title page to add it to this playlist.";
  const findTitles =
    locale === "pt-BR"
      ? "Encontrar títulos"
      : locale === "es"
        ? "Encontrar títulos"
        : "Find titles";
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
          owner={owner}
        />
      ) : (
        <div className="mt-6">
          <SocialEmpty
            icon="collection"
            title={owner ? empty : undefined}
            message={owner ? howToAdd : empty}
            action={
              owner
                ? { href: `/${locale}/discover`, label: findTitles }
                : undefined
            }
          />
        </div>
      )}
    </main>
  );
}
