"use client";
import { useActionState } from "react";
import Image from "next/image";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { interviewSignIn } from "./interview-action";
const copy = {
  en: {
    title: "Welcome to Filmgram",
    description: "Sign in with your interview account to explore Filmgram.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    pending: "Signing in…",
    error: "Could not sign in. Check your details and try again.",
  },
  "pt-BR": {
    title: "Boas-vindas ao Filmgram",
    description: "Entre com sua conta de entrevista para conhecer o Filmgram.",
    email: "E-mail",
    password: "Senha",
    submit: "Entrar",
    pending: "Entrando…",
    error: "Não foi possível entrar. Confira seus dados e tente novamente.",
  },
  es: {
    title: "Te damos la bienvenida a Filmgram",
    description: "Entra con tu cuenta de entrevista para conocer Filmgram.",
    email: "Correo electrónico",
    password: "Contraseña",
    submit: "Entrar",
    pending: "Entrando…",
    error: "No se pudo iniciar sesión. Revisa tus datos e inténtalo de nuevo.",
  },
} as const;
export function InterviewSignIn({ locale }: { locale: string }) {
  const t = copy[locale as keyof typeof copy] || copy.en;
  const [error, action, pending] = useActionState(
    interviewSignIn.bind(null, locale),
    false,
  );
  return (
    <section className="mx-auto w-full max-w-[770px] overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid min-[701px]:grid-cols-2">
        <div className="relative h-32 overflow-hidden min-[701px]:h-auto min-[701px]:min-h-[365px]">
          <Image
            src="/profile-cinema.webp"
            alt=""
            fill
            loading="eager"
            sizes="(max-width: 700px) 100vw, 385px"
            className="object-cover min-[701px]:object-[82%_center]"
          />
        </div>
        <div className="flex flex-col items-start justify-center gap-4 p-7 sm:p-10">
          <Brand decorative header />
          <h1 className="m-0 font-display text-[clamp(1.7rem,4vw,2.35rem)] leading-tight font-bold">
            {t.title}
          </h1>
          <p className="m-0 text-sm leading-relaxed text-muted-foreground">
            {t.description}
          </p>
          <form action={action} className="flex w-full flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-bold">
              {t.email}
              <Input
                type="email"
                name="email"
                autoComplete="username"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-bold">
              {t.password}
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <p role="alert" className="m-0 text-sm text-destructive">
                {t.error}
              </p>
            )}
            <Button type="submit" disabled={pending} aria-live="polite">
              {pending ? t.pending : t.submit}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
