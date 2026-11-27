import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { messages } from "@/i18n/messages";
import { container } from "@/lib/layout";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    description: "This page may have moved or is unavailable.",
    playlist: "Playlist unavailable",
    playlistDescription:
      "The playlist may have been removed or set to private.",
    playlistAction: "View playlists",
    action: "Back to Discover",
  },
  "pt-BR": {
    description:
      "Esta página pode ter mudado de endereço ou estar indisponível.",
    playlist: "Playlist indisponível",
    playlistDescription: "A playlist pode ter sido removida ou estar privada.",
    playlistAction: "Ver playlists",
    action: "Voltar para Descobrir",
  },
  es: {
    description:
      "Esta página puede haber cambiado de dirección o no estar disponible.",
    playlist: "Lista no disponible",
    playlistDescription:
      "Es posible que la lista se haya eliminado o sea privada.",
    playlistAction: "Ver listas",
    action: "Volver a Descubrir",
  },
};

export function MissingPage({
  locale,
  playlist = false,
}: {
  locale: string;
  playlist?: boolean;
}) {
  const t = messages(locale);
  const text = copy[locale as keyof typeof copy] || copy.en;
  return (
    <main className={cn(container, "py-12 mobile:py-8")}>
      <div
        className="mx-auto flex min-h-[355px] max-w-[770px] flex-col justify-center overflow-hidden rounded-[14px] border border-border bg-cover bg-[position:82%_center] bg-secondary"
        style={{
          backgroundImage:
            "linear-gradient(90deg, #15110ef5 15%, #15110ee6 58%, #15110e54), url(/profile-cinema.webp)",
        }}
      >
        <div className="flex flex-col items-start justify-center gap-5 p-10 mobile:p-7">
          <p className="m-0 font-display text-xl tracking-[0.14em] text-primary">
            404
          </p>
          <h1 className="m-0 font-display text-5xl font-bold mobile:text-4xl">
            {playlist ? text.playlist : t.notFound}
          </h1>
          <p className="m-0 max-w-sm text-muted-foreground">
            {playlist ? text.playlistDescription : text.description}
          </p>
          <Link
            className={buttonVariants()}
            href={`/${locale}/${playlist ? "playlists" : "discover"}`}
          >
            <ArrowLeft size={17} aria-hidden="true" />
            {playlist ? text.playlistAction : text.action}
          </Link>
        </div>
      </div>
    </main>
  );
}
