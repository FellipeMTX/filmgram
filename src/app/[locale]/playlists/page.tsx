import Link from "next/link";
import { PlaylistCover } from "@/components/playlist-cover";
import { Button } from "@/components/ui/button";
import { CreatePlaylistDialog } from "@/features/playlists/create-dialog";
import { signIn } from "@/features/auth/actions";
import { messages } from "@/i18n/messages";
import { currentUser, supabase } from "@/integrations/supabase";
import { container, eyebrow, pageTitle } from "@/lib/layout";

const PAGE_SIZE = 24;
type Summary = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  item_count: { count: number }[];
  covers: { poster_path: string | null }[];
};

export default async function Playlists({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const requested = Number(query.page);
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, 10000)
      : 1;
  const t = messages(locale);
  const labels =
    locale === "pt-BR"
      ? {
          own: "Suas playlists",
          public: "Playlists públicas",
          close: "Fechar",
          failure: "Não foi possível criar a playlist. Tente novamente.",
          previous: "Anterior",
          next: "Próxima",
          titles: "títulos",
        }
      : locale === "es"
        ? {
            own: "Tus listas",
            public: "Listas públicas",
            close: "Cerrar",
            failure: "No se pudo crear la lista. Inténtalo de nuevo.",
            previous: "Anterior",
            next: "Siguiente",
            titles: "títulos",
          }
        : {
            own: "Your playlists",
            public: "Public playlists",
            close: "Close",
            failure: "Could not create the playlist. Please try again.",
            previous: "Previous",
            next: "Next",
            titles: "titles",
          };
  const [user, db] = await Promise.all([currentUser(), supabase()]);
  let lists: Summary[] = [];
  let count = 0;
  if (db) {
    const result = await db
      .from("playlists")
      .select(
        "id,user_id,name,description,is_public,item_count:playlist_items(count),covers:playlist_items(poster_path)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .order("position", { referencedTable: "covers", ascending: true })
      .limit(4, { referencedTable: "covers" })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (result.error) throw result.error;
    lists = (result.data || []) as unknown as Summary[];
    count = result.count || 0;
  }
  const groups = user
    ? [
        {
          title: labels.own,
          lists: lists.filter((list) => list.user_id === user.id),
        },
        {
          title: labels.public,
          lists: lists.filter((list) => list.user_id !== user.id),
        },
      ]
    : [{ title: labels.public, lists }];
  return (
    <main className={`${container} pt-[55px] pb-[100px] mobile:pt-[25px]`}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrow}>{t.collection}</p>
          <h1 className={`${pageTitle} mb-0`}>{t.playlists}</h1>
        </div>
        {user ? (
          <CreatePlaylistDialog
            locale={locale}
            labels={{ ...t, close: labels.close, failure: labels.failure }}
          />
        ) : (
          <form action={signIn}>
            <input type="hidden" name="next" value={`/${locale}/playlists`} />
            <Button type="submit">{t.signIn}</Button>
          </form>
        )}
      </div>
      {lists.length === 0 ? (
        <p className="text-muted-foreground">{t.noPlaylists}</p>
      ) : (
        groups
          .filter((group) => group.lists.length > 0)
          .map((group) => (
            <section key={group.title} className="mb-12">
              <h2 className="mb-5 font-display text-2xl font-semibold">
                {group.title}
              </h2>
              <div className="grid grid-cols-2 gap-5 min-[700px]:grid-cols-3 min-[900px]:grid-cols-4 min-[1200px]:grid-cols-5">
                {group.lists.map((list) => (
                  <Link
                    key={list.id}
                    href={`/${locale}/playlists/${list.id}`}
                    className="group min-w-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  >
                    <PlaylistCover
                      posterPaths={list.covers.map(
                        (cover) => cover.poster_path,
                      )}
                    />
                    <h3 className="mt-3 truncate font-display text-xl font-semibold group-hover:text-primary">
                      {list.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {list.item_count[0]?.count || 0} {labels.titles} ·{" "}
                      {list.is_public ? t.publicLabel : t.private}
                    </p>
                    {list.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {list.description}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))
      )}
      {(page > 1 || page * PAGE_SIZE < count) && (
        <nav aria-label="Pagination" className="flex gap-3">
          {page > 1 && (
            <Button asChild variant="outline">
              <Link href={`/${locale}/playlists?page=${page - 1}`}>
                {labels.previous}
              </Link>
            </Button>
          )}
          {page * PAGE_SIZE < count && (
            <Button asChild variant="outline">
              <Link href={`/${locale}/playlists?page=${page + 1}`}>
                {labels.next}
              </Link>
            </Button>
          )}
        </nav>
      )}
    </main>
  );
}
