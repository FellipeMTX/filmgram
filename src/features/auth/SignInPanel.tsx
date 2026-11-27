"use client";

import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Brand } from "@/components/Brand";
import { signIn } from "./actions";

const copy = {
  en: {
    profile: [
      "Your Filmgram profile",
      "Sign in to make your profile your own and share what you love.",
    ],
    following: [
      "Follow the conversation",
      "Sign in to keep up with people and their latest reviews.",
    ],
    playlists: [
      "Make it a collection",
      "Sign in to create playlists and keep your favorites together.",
    ],
    "title-review": [
      "Share your take",
      "Sign in to rate this title and join the conversation.",
    ],
    button: "Sign in with Google",
    pending: "Connecting to Google…",
    error: "Sign-in failed or was cancelled. Please try again.",
  },
  "pt-BR": {
    profile: [
      "Entre para ver seu perfil",
      "Acompanhe o que assistiu, guarde suas resenhas e descubra seus hábitos de visualização.",
    ],
    following: [
      "Entre para ver quem você segue",
      "Acompanhe autores e veja as resenhas deles no seu feed.",
    ],
    playlists: [
      "Entre para criar playlists",
      "Monte coleções e guarde os títulos que você quer ver depois.",
    ],
    "title-review": [
      "Entre para escrever uma resenha",
      "Avalie o título e compartilhe o que achou com a comunidade.",
    ],
    button: "Entrar com Google",
    pending: "Conectando…",
    error:
      "Não foi possível entrar ou o acesso foi cancelado. Tente novamente.",
  },
  es: {
    profile: [
      "Tu perfil en Filmgram",
      "Entra para crear tu perfil y compartir lo que te gusta.",
    ],
    following: [
      "Sigue la conversación",
      "Entra para seguir a otras personas y sus últimas reseñas.",
    ],
    playlists: [
      "Crea tus colecciones",
      "Entra para crear playlists y reunir tus favoritos.",
    ],
    "title-review": [
      "Comparte tu opinión",
      "Entra para valorar este título y unirte a la conversación.",
    ],
    button: "Continuar con Google",
    pending: "Conectando con Google…",
    error:
      "No se pudo iniciar sesión o se canceló el acceso. Inténtalo de nuevo.",
  },
} as const;

const returnQueryKeys = {
  profile: ["tab", "type", "period", "page"],
  following: [],
  playlists: ["ownPage", "publicPage"],
  "title-review": ["country", "tab", "media", "review"],
} as const;

function canonicalTitlePath(pathname: string) {
  return pathname.replace(/(\/title\/(?:movie|tv)\/)0+(?=\d)/, "$1");
}

function GoogleButton({
  label,
  pendingLabel,
  restoreFocus,
}: {
  label: string;
  pendingLabel: string;
  restoreFocus: boolean;
}) {
  const { pending } = useFormStatus();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (restoreFocus && !pending) button.current?.focus();
  }, [pending, restoreFocus]);
  return (
    <button
      ref={button}
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-md bg-[#fffdf8] px-5 py-3 text-sm font-bold text-[#242424] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70 sm:w-auto"
      aria-live="polite"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
        <path
          fill="#4285F4"
          d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15z"
        />
        <path
          fill="#34A853"
          d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44z"
        />
        <path
          fill="#FBBC05"
          d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8z"
        />
        <path
          fill="#EA4335"
          d="M24 12c3 0 5.7 1 7.8 3l5.8-5.7A19.3 19.3 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12z"
        />
      </svg>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function SignInPanel({
  locale,
  next,
  context,
  compact = false,
  headingLevel = "h2",
}: {
  locale: string;
  next: string;
  context: "profile" | "following" | "playlists" | "title-review";
  compact?: boolean;
  headingLevel?: "h1" | "h2" | "h3";
}) {
  const t = copy[locale as keyof typeof copy] || copy.en;
  const pathname = usePathname();
  const search = useSearchParams();
  const urlError = search.get("auth_error") === "1";
  const intended = new URL(next, "https://filmgram.invalid");
  const sameRoute =
    intended.pathname === pathname ||
    (context === "title-review" &&
      intended.pathname === canonicalTitlePath(pathname));
  const queryKeys = returnQueryKeys[context];
  const params = new URLSearchParams();
  for (const key of queryKeys) {
    const value =
      (sameRoute ? search.get(key) : null) ?? intended.searchParams.get(key);
    if (value && /^[a-z0-9_-]{1,100}$/i.test(value)) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  const returnPath = intended.pathname + (query ? `?${query}` : "");
  const cleanNext = returnPath + intended.hash;
  const Heading = headingLevel;
  return (
    <section
      className={`overflow-hidden rounded-xl border border-border bg-card ${compact ? "my-5" : "mx-auto w-full max-w-[770px]"}`}
    >
      <div className={`grid ${compact ? "" : "min-[701px]:grid-cols-2"}`}>
        {!compact && (
          <div className="relative h-32 overflow-hidden min-[701px]:h-auto min-[701px]:min-h-[365px]">
            <Image
              src="/profile-cinema.webp"
              alt=""
              fill
              loading="eager"
              sizes="(max-width: 700px) 100vw, 50vw"
              className="object-cover min-[701px]:object-[82%_center]"
            />
          </div>
        )}
        <div
          className={`flex flex-col items-start justify-center ${compact ? "gap-3 p-5 sm:p-7" : "gap-4 p-7 sm:p-10"}`}
        >
          <Brand decorative header />
          <Heading
            className={`m-0 font-display leading-tight font-bold ${compact ? "text-xl sm:text-2xl" : "text-[clamp(1.7rem,4vw,2.35rem)]"}`}
          >
            {t[context][0]}
          </Heading>
          <p className="m-0 max-w-md text-sm leading-relaxed text-muted-foreground">
            {t[context][1]}
          </p>
          {urlError && (
            <p
              role="alert"
              data-auth-error-local
              className="m-0 text-sm text-destructive"
            >
              {t.error}
            </p>
          )}
          <form
            action={signIn}
            className="w-full sm:w-auto"
            onSubmit={(event) => {
              // Fragments are not sent to the server; preserve the current one when present.
              if (
                !sameRoute ||
                !/^#[a-z0-9_-]{1,100}$/i.test(window.location.hash)
              )
                return;
              const input = event.currentTarget.elements.namedItem(
                "next",
              ) as HTMLInputElement | null;
              if (input) input.value = returnPath + window.location.hash;
            }}
          >
            <input type="hidden" name="next" value={cleanNext} />
            <GoogleButton
              label={t.button}
              pendingLabel={t.pending}
              restoreFocus={urlError}
            />
          </form>
        </div>
      </div>
    </section>
  );
}
