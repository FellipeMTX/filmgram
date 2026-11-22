"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Compass, Users, Layers, UserRound, Globe } from "lucide-react";
import { messages } from "@/i18n/messages";
import styles from "./Header.module.css";
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
  function changeLocale(value: string) {
    const parts = path.split("/");
    parts[1] = value;
    location.href = parts.join("/") + (query.toString() ? `?${query}` : "");
  }
  return (
    <>
      <header className={styles.header}>
        <Link href={`/${locale}/discover`} className={styles.logo}>
          Filmgram<span>.</span>
        </Link>
        <nav className={styles.desktop}>
          {links.map(([url, label, Icon]) => (
            <Link
              className={
                path.includes("/" + url.split("/")[0]) ? styles.active : ""
              }
              href={`/${locale}/${url}`}
              key={url}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <label className={styles.language}>
          <Globe size={19} />
          <span className="srOnly">{t.language}</span>
          <select
            aria-label={t.language}
            value={locale}
            onChange={(e) => changeLocale(e.target.value)}
          >
            <option value="en">EN</option>
            <option value="pt-BR">PT</option>
            <option value="es">ES</option>
          </select>
        </label>
      </header>
      <nav className={styles.mobile}>
        {links.map(([url, label, Icon]) => (
          <Link
            className={
              path.includes("/" + url.split("/")[0]) ? styles.active : ""
            }
            href={`/${locale}/${url}`}
            key={url}
          >
            <Icon size={23} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
