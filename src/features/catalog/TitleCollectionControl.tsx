"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { BookmarkPlus, LockKeyhole } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { setTitleCollection } from "@/features/library/actions";
import { savedCollectionLabels } from "./saved-collection-labels";

export function TitleCollectionControl({
  locale,
  mediaType,
  saved,
  playlists,
  children,
}: {
  locale: string;
  mediaType?: string;
  saved: boolean;
  playlists: { id: string; name: string; contains: boolean }[];
  children: ReactNode;
}) {
  const t = savedCollectionLabels(locale);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const destinations = [
    { id: "saved", name: t.saved, contains: saved },
    ...playlists,
  ];
  function change(form: FormData, destination: string, desired: boolean) {
    form.set("destination", destination);
    form.set("desired", String(desired));
    setError(false);
    start(async () => {
      try {
        const confirmed = await setTitleCollection(form);
        setActive((previous) => ({ ...previous, [destination]: confirmed }));
      } catch {
        setError(true);
      }
    });
  }

  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (open) {
          setActive({});
          setError(false);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button type="button" variant="default">
          <BookmarkPlus aria-hidden="true" />{" "}
          {mediaType === "movie"
            ? locale === "pt-BR"
              ? "Salvar"
              : locale === "es"
                ? "Guardar"
                : "Save"
            : t.action}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/75" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85dvh] w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Dialog.Title className="font-display text-2xl font-semibold">
              {t.action}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" size="sm" variant="ghost">
                {t.close}
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {t.description}
          </Dialog.Description>
          <ul className="mt-4 space-y-1">
            {destinations.map((destination) => {
              const included = active[destination.id] ?? destination.contains;
              return (
                <li key={destination.id}>
                  <form
                    action={(data) => change(data, destination.id, !included)}
                  >
                    {children}
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={pending}
                      aria-pressed={included}
                      className="w-full min-w-0 justify-between text-left whitespace-normal"
                    >
                      <span className="flex min-w-0 items-center gap-2 break-all">
                        {destination.id === "saved" && (
                          <LockKeyhole size={16} aria-label={t.private} />
                        )}
                        {destination.name}
                      </span>
                      <span aria-hidden="true">{included ? "✓" : "+"}</span>
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
          <p role="status" className="sr-only">
            {pending ? t.pending : ""}
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {t.error}
            </p>
          )}
          <Link
            className="mt-4 inline-block text-sm text-primary hover:underline"
            href={`/${locale}/playlists`}
          >
            {t.library}
          </Link>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
