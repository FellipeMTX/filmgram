"use client";

import { useParams } from "next/navigation";
import { messages } from "@/i18n/messages";
import { container, narrow } from "@/lib/layout";
import { cn } from "@/lib/utils";

export type SocialRoute = "following" | "library" | "playlist";

function Block({ className }: { className: string }) {
  return <div className={cn("rounded-md bg-muted", className)} />;
}

export function SocialRouteLoading({ route }: { route: SocialRoute }) {
  const { locale } = useParams();
  const t = messages(String(locale));

  return (
    <main
      className={cn(
        route === "library"
          ? `${container} pt-[55px] pb-[100px] mobile:pt-[25px]`
          : narrow,
        route === "following" && "max-w-[680px]",
      )}
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        {t.loading}
      </p>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        {route === "following" && (
          <>
            <Block className="h-10 w-48 max-w-full" />
            {[0, 1].map((post) => (
              <div
                key={post}
                className="space-y-4 rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-center gap-3">
                  <Block className="size-10 shrink-0 rounded-full" />
                  <div className="w-full space-y-2">
                    <Block className="h-4 w-32" />
                    <Block className="h-3 w-20" />
                  </div>
                </div>
                <Block className="h-4 w-4/5" />
                <Block className="h-4 w-24" />
                <div className="flex items-center gap-4 rounded-lg border border-border">
                  <Block className="h-28 w-[74px] shrink-0" />
                  <Block className="h-5 w-36 max-w-[45%]" />
                </div>
              </div>
            ))}
          </>
        )}
        {route === "library" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Block className="h-10 w-44" />
              <Block className="h-10 w-32" />
            </div>
            {[0, 1].map((group) => (
              <div key={group} className="space-y-4">
                <Block className="h-6 w-40" />
                <div className="grid grid-cols-2 gap-5 min-[700px]:grid-cols-3 min-[900px]:grid-cols-4 min-[1200px]:grid-cols-5">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <div
                      key={index}
                      className={cn(
                        "space-y-3 rounded-lg border border-border bg-card p-3",
                        index === 2 && "max-[700px]:hidden",
                        index === 3 && "max-[900px]:hidden",
                        index === 4 && "max-[1200px]:hidden",
                      )}
                    >
                      <Block className="aspect-square" />
                      <Block className="h-4 w-3/4" />
                      <Block className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
        {route === "playlist" && (
          <>
            <Block className="h-5 w-36" />
            <div className="flex flex-wrap items-end gap-6 rounded-xl border border-border bg-card p-5">
              <Block className="aspect-square w-[min(44%,180px)] min-w-24" />
              <div className="min-w-28 flex-1 space-y-3">
                <Block className="h-4 w-20" />
                <Block className="h-9 w-72 max-w-full" />
                <Block className="h-4 w-52 max-w-full" />
              </div>
            </div>
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex items-center gap-4">
                  <Block className="h-4 w-3 shrink-0" />
                  <Block className="h-14 w-9 shrink-0" />
                  <Block className="h-4 w-36 max-w-[55%]" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
