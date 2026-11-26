"use client";
import Link from "next/link";
import { Brand } from "@/components/Brand";
import { usePathname, useSearchParams } from "next/navigation";
import { Compass, Users, Layers, UserRound } from "lucide-react";
import { messages } from "@/i18n/messages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { container } from "@/lib/layout";

function Flag({ locale }: { locale: string }) {
  if (locale === "pt-BR")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 30 20"
        className="size-4 w-6 shrink-0 rounded-[2px]"
      >
        <path fill="#009739" d="M0 0h30v20H0z" />
        <path fill="#ffdf00" d="m15 2 12 8-12 8L3 10z" />
        <circle fill="#002776" cx="15" cy="10" r="4.4" />
        <path
          fill="none"
          stroke="white"
          strokeWidth=".8"
          d="M10.8 9.2c3-.9 6-.2 8.3 1.5"
        />
      </svg>
    );
  if (locale === "es")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 30 20"
        className="size-4 w-6 shrink-0 rounded-[2px]"
      >
        <path fill="#aa151b" d="M0 0h30v20H0z" />
        <path fill="#f1bf00" d="M0 5h30v10H0z" />
        <path fill="#aa151b" d="M8 7h3v5H8z" />
      </svg>
    );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 30 20"
      className="size-4 w-6 shrink-0 rounded-[2px]"
    >
      <path fill="#012169" d="M0 0h30v20H0z" />
      <path stroke="white" strokeWidth="4" d="m0 0 30 20M30 0 0 20" />
      <path stroke="#c8102e" strokeWidth="2" d="m0 0 30 20M30 0 0 20" />
      <path stroke="white" strokeWidth="6" d="M15 0v20M0 10h30" />
      <path stroke="#c8102e" strokeWidth="3" d="M15 0v20M0 10h30" />
    </svg>
  );
}
export function Header({ locale }: { locale: string }) {
  const t = messages(locale),
    path = usePathname(),
    query = useSearchParams();
  const links = [
    ["discover", t.discover, Compass],
    ["following", t.following, Users],
    ["playlists", t.playlists, Layers],
    ["profile/me", t.profile, UserRound],
  ] as const;
  const active = (url: string) => path.includes("/" + url.split("/")[0]);
  function changeLocale(value: string) {
    const parts = path.split("/");
    parts[1] = value;
    location.href =
      parts.join("/") +
      (query.toString() ? `?${query}` : "") +
      (parts[2] === "title" && parts[3] === "movie" ? location.hash : "");
  }
  return (
    <>
      {query.get("auth_error") === "1" && (
        <div role="alert" className={container}>
          {t.authError}
        </div>
      )}
      <header className="relative z-[5] grid h-[76px] grid-cols-[1fr_auto_1fr] items-center border-b border-header-border bg-background px-[5%] mobile:h-[68px] mobile:grid-cols-2 mobile:border-0 mobile:px-5">
        <Link
          href={`/${locale}/discover`}
          aria-label="Filmgram"
          className="justify-self-start"
        >
          <Brand decorative header />
        </Link>
        <nav className="flex h-full items-center gap-[38px] compact:gap-3 mobile:hidden">
          {links.map(([url, label, Icon]) => (
            <Link
              key={url}
              href={`/${locale}/${url}`}
              className={`flex h-full items-center gap-2 border-b-2 text-sm font-bold compact:text-xs hover:border-primary hover:text-brand-foreground ${active(url) ? "border-primary text-brand-foreground" : "border-transparent text-subtle"}`}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="justify-self-end">
          <Select value={locale} onValueChange={changeLocale}>
            <SelectTrigger
              aria-label={t.language}
              className="h-auto gap-1.5 border-0 bg-transparent p-0 text-[13px] font-bold text-popover-foreground shadow-none"
            >
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  <Flag locale={locale} />
                  {locale === "pt-BR" ? "PT" : locale.toUpperCase()}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(
                [
                  ["en", "EN", "English"],
                  ["es", "ES", "Espa\u00f1ol"],
                  ["pt-BR", "PT", "Portugu\u00eas (Brasil)"],
                ] as const
              ).map(([value, label, name]) => (
                <SelectItem key={value} value={value} textValue={name}>
                  <span
                    aria-hidden="true"
                    className="flex items-center gap-1.5"
                  >
                    <Flag locale={value} />
                    {label}
                  </span>
                  <span className="sr-only">{name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-10 hidden h-[68px] justify-around border-t border-mobile-border bg-background mobile:flex">
        {links.map(([url, label, Icon]) => (
          <Link
            key={url}
            href={`/${locale}/${url}`}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-[11px] ${active(url) ? "text-primary" : "text-mobile-foreground"}`}
          >
            <Icon size={23} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
