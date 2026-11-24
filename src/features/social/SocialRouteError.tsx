"use client";

import { Button } from "@/components/ui/button";
import { messages } from "@/i18n/messages";
import { narrow, pageTitle } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import type { SocialRoute } from "./SocialRouteLoading";

const copy = {
  en: {
    following: "We couldn’t load your feed.",
    library: "We couldn’t load the playlists.",
    playlist: "We couldn’t load this playlist.",
  },
  "pt-BR": {
    following: "Não foi possível carregar seu feed.",
    library: "Não foi possível carregar as playlists.",
    playlist: "Não foi possível carregar esta playlist.",
  },
  es: {
    following: "No pudimos cargar tu feed.",
    library: "No pudimos cargar las listas.",
    playlist: "No pudimos cargar esta lista.",
  },
};

export function SocialRouteError({
  route,
  retry,
}: {
  route: SocialRoute;
  retry: () => void;
}) {
  const { locale } = useParams();
  const lang = locale === "pt-BR" || locale === "es" ? locale : "en";
  const t = messages(lang);
  const [pending, startTransition] = useTransition();

  return (
    <main className={cn(narrow, route === "following" && "max-w-[760px]")}>
      <h1 className={pageTitle}>
        {route === "following" ? t.following : t.playlists}
      </h1>
      <div className="rounded-xl border border-border bg-card p-5">
        <p role="alert" className="mb-4 text-muted-foreground">
          {copy[lang][route]}
        </p>
        <Button
          type="button"
          onClick={() => startTransition(retry)}
          disabled={pending}
        >
          {pending ? t.loading : t.tryAgain}
        </Button>
      </div>
    </main>
  );
}
