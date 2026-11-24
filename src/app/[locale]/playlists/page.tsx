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
  name: string;
  description: string | null;
  is_public: boolean;
  profiles: { display_name: string } | null;
  item_count: { count: number }[];
  covers: { poster_path: string | null }[];
};
type Client = NonNullable<Awaited<ReturnType<typeof supabase>>>;
function pageNumber(value?: string) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
}
async function getGroup(
  db: Client,
  userId: string | undefined,
  own: boolean,
  requested: number,
) {
  async function fetchPage(page: number) {
    let query = db
      .from("playlists")
      .select(
        "id,name,description,is_public,profiles(display_name),item_count:playlist_items(count),covers:playlist_items(poster_path)",
        { count: "exact" },
      );
    if (own && userId) query = query.eq("user_id", userId);
    else {
      query = query.eq("is_public", true);
      if (userId) query = query.neq("user_id", userId);
    }
    const result = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .order("position", { referencedTable: "covers", ascending: true })
      .limit(4, { referencedTable: "covers" })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (result.error) {
      if (result.status === 416 && page > 1) return null;
      throw result.error;
    }
    return {
      lists: (result.data || []) as unknown as Summary[],
      count: result.count || 0,
    };
  }
  const requestedResult = await fetchPage(requested);
  const first = requestedResult ?? (await fetchPage(1));
  if (!first) throw new Error("Unable to load playlists");
  const page = Math.min(
    requested,
    Math.max(1, Math.ceil(first.count / PAGE_SIZE)),
  );
  const result =
    page === requested
      ? first
      : page === 1 && !requestedResult
        ? first
        : await fetchPage(page);
  if (!result) throw new Error("Unable to load playlists");
  return { ...result, page };
}

export default async function Playlists({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ownPage?: string; publicPage?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const t = messages(locale);
  const labels =
    locale === "pt-BR"
      ? {
          own: "Suas playlists",
          public: "Playlists públicas",
          close: "Fechar",
          failure: "Não foi possível criar a playlist. Tente novamente.",
          unavailable: "Playlists indisponíveis no momento.",
          previous: "Anterior",
          next: "Próxima",
          title: "título",
          titles: "títulos",
          by: "por",
          pagination: "Paginação",
        }
      : locale === "es"
        ? {
            own: "Tus listas",
            public: "Listas públicas",
            close: "Cerrar",
            failure: "No se pudo crear la lista. Inténtalo de nuevo.",
            unavailable: "Las listas no están disponibles en este momento.",
            previous: "Anterior",
            next: "Siguiente",
            title: "título",
            titles: "títulos",
            by: "por",
            pagination: "Paginación",
          }
        : {
            own: "Your playlists",
            public: "Public playlists",
            close: "Close",
            failure: "Could not create the playlist. Please try again.",
            unavailable: "Playlists are currently unavailable.",
            previous: "Previous",
            next: "Next",
            title: "title",
            titles: "titles",
            by: "by",
            pagination: "Pagination",
          };
  const [user, db] = await Promise.all([currentUser(), supabase()]);
  const [own, publicLists] = db
    ? await Promise.all([
        user
          ? getGroup(db, user.id, true, pageNumber(query.ownPage))
          : Promise.resolve(null),
        getGroup(db, user?.id, false, pageNumber(query.publicPage)),
      ])
    : [null, null];
  const groups = [
    ...(own ? [{ ...own, title: labels.own, key: "ownPage" as const }] : []),
    ...(publicLists
      ? [{ ...publicLists, title: labels.public, key: "publicPage" as const }]
      : []),
  ];
  function pageHref(key: "ownPage" | "publicPage", page: number) {
    const p = new URLSearchParams();
    const ownPage = key === "ownPage" ? page : own?.page;
    const publicPage = key === "publicPage" ? page : publicLists?.page;
    if (ownPage && ownPage > 1) p.set("ownPage", String(ownPage));
    if (publicPage && publicPage > 1) p.set("publicPage", String(publicPage));
    const suffix = p.toString();
    return `/${locale}/playlists${suffix ? `?${suffix}` : ""}`;
  }
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
      {!db ? (
        <p className="text-muted-foreground">{labels.unavailable}</p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="mb-12">
            <h2 className="mb-5 font-display text-2xl font-semibold">
              {group.title}
            </h2>
            {group.count === 0 ? (
              <p className="text-muted-foreground">{t.noPlaylists}</p>
            ) : (
              <div className="grid grid-cols-2 gap-5 min-[700px]:grid-cols-3 min-[900px]:grid-cols-4 min-[1200px]:grid-cols-5">
                {group.lists.map((list) => {
                  const count = list.item_count[0]?.count || 0;
                  return (
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
                        {count} {count === 1 ? labels.title : labels.titles} ·{" "}
                        {list.is_public ? t.publicLabel : t.private}
                      </p>
                      {list.profiles?.display_name && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {labels.by} {list.profiles.display_name}
                        </p>
                      )}
                      {list.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {list.description}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
            {(group.page > 1 || group.page * PAGE_SIZE < group.count) && (
              <nav
                aria-label={`${labels.pagination}: ${group.title}`}
                className="mt-6 flex gap-3"
              >
                {group.page > 1 && (
                  <Button asChild variant="outline">
                    <Link href={pageHref(group.key, group.page - 1)}>
                      {labels.previous}
                    </Link>
                  </Button>
                )}
                {group.page * PAGE_SIZE < group.count && (
                  <Button asChild variant="outline">
                    <Link href={pageHref(group.key, group.page + 1)}>
                      {labels.next}
                    </Link>
                  </Button>
                )}
              </nav>
            )}
          </section>
        ))
      )}
    </main>
  );
}
