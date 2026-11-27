"use client";

import { getImageProps } from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, signInWithEmail } from "./actions";

const copy = {
  en: {
    profile: ["Sign in to Filmgram"],
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
    or: "or",
    email: "Email",
    password: "Password",
    emailButton: "Sign in with email",
    emailPending: "Signing in…",
    emailError: "Could not sign in. Check your details and try again.",
    pending: "Connecting to Google…",
    error: "Sign-in failed or was cancelled. Please try again.",
  },
  "pt-BR": {
    profile: ["Entre no Filmgram"],
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
    or: "ou",
    email: "E-mail",
    password: "Senha",
    emailButton: "Entrar com e-mail",
    emailPending: "Entrando…",
    emailError:
      "Não foi possível entrar. Confira seus dados e tente novamente.",
    pending: "Conectando…",
    error:
      "Não foi possível entrar ou o acesso foi cancelado. Tente novamente.",
  },
  es: {
    profile: ["Entra en Filmgram"],
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
    or: "o",
    email: "Correo electrónico",
    password: "Contraseña",
    emailButton: "Entrar con correo electrónico",
    emailPending: "Entrando…",
    emailError:
      "No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.",
    pending: "Conectando con Google…",
    error:
      "No se pudo iniciar sesión o se canceló el acceso. Inténtalo de nuevo.",
  },
} as const;

const { props: desktopCinema } = getImageProps({
  src: "/login-cinema-portrait.webp",
  alt: "",
  fill: true,
  sizes: "380px",
});
const { props: mobileCinema } = getImageProps({
  src: "/profile-cinema.webp",
  alt: "",
  fill: true,
  sizes: "100vw",
});

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
      className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-md bg-[#fffdf8] px-5 py-3 text-sm font-bold text-[#242424] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70"
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

function EmailSignInForm({
  copy: t,
  next,
  onSubmit,
}: {
  copy: (typeof copy)[keyof typeof copy];
  next: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [error, action, pending] = useActionState(signInWithEmail, false);
  const [email, setEmail] = useState("");
  const errorId = useId();
  return (
    <form
      action={action}
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-4"
    >
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-2 text-sm font-bold">
        {t.email}
        <Input
          type="email"
          name="email"
          className="border-button-border"
          autoComplete="username"
          autoCapitalize="none"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm font-bold">
        {t.password}
        <Input
          type="password"
          name="password"
          className="border-button-border"
          autoComplete="current-password"
          aria-describedby={error ? errorId : undefined}
          required
        />
      </label>
      {error && (
        <p id={errorId} role="alert" className="m-0 text-sm text-destructive">
          {t.emailError}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending}
        aria-live="polite"
        className="min-h-12 w-full"
      >
        {pending ? t.emailPending : t.emailButton}
      </Button>
    </form>
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
  const [title, description] = t[context];
  const Heading = headingLevel;

  function preserveReturnHash(event: FormEvent<HTMLFormElement>) {
    // Fragments are not sent to the server; capture a valid one at submit time.
    const input = event.currentTarget.elements.namedItem("next");
    if (input instanceof HTMLInputElement) {
      const hash = window.location.hash;
      input.value =
        sameRoute && /^#[a-z0-9_-]{1,100}$/i.test(hash)
          ? returnPath + hash
          : cleanNext;
    }
  }

  return (
    <section
      className={`overflow-hidden rounded-xl border border-border bg-card ${compact ? "my-5" : "mx-auto w-full max-w-[770px]"}`}
    >
      <div
        className={`grid ${compact ? "" : "min-[701px]:grid-cols-[2fr_3fr]"}`}
      >
        {!compact && (
          <div className="relative h-32 overflow-hidden min-[701px]:h-auto min-[701px]:min-h-[365px]">
            <picture>
              <source
                media="(min-width: 701px)"
                srcSet={desktopCinema.srcSet}
                sizes={desktopCinema.sizes}
              />
              <img
                {...mobileCinema}
                alt=""
                loading="eager"
                className="object-cover"
              />
            </picture>
          </div>
        )}
        <div
          className={`flex flex-col items-start justify-center ${compact ? "gap-3 p-5 sm:p-7" : "gap-5 p-6 sm:p-9"}`}
        >
          <Brand decorative header />
          <Heading
            className={`m-0 font-display leading-tight font-bold ${compact ? "text-xl sm:text-2xl" : "text-[clamp(1.7rem,4vw,2.35rem)]"}`}
          >
            {title}
          </Heading>
          {description && (
            <p className="m-0 max-w-md text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
          <div className="flex w-full max-w-md flex-col gap-4">
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
              onSubmit={preserveReturnHash}
              className="w-full"
            >
              <input type="hidden" name="next" value={cleanNext} />
              <GoogleButton
                label={t.button}
                pendingLabel={t.pending}
                restoreFocus={urlError}
              />
            </form>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
              {t.or}
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
            </div>
            <EmailSignInForm
              copy={t}
              next={cleanNext}
              onSubmit={preserveReturnHash}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
