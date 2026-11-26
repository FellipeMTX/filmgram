import { container } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { isLocale, messages } from "@/i18n/messages";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Brand } from "@/components/Brand";
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <NextIntlClientProvider locale={locale} messages={messages(locale)}>
      <Header locale={locale} />
      {children}
      <footer
        className={cn(
          container,
          "border-t border-header-border pt-[30px] pb-[45px] font-bold tracking-[0.08em] mobile:text-xs [&_span]:text-primary",
        )}
      >
        <Brand /> <span>·</span> {messages(locale).tagline}{" "}
        <Link href={`/${locale}/credits`}>{messages(locale).credits}</Link>
      </footer>
    </NextIntlClientProvider>
  );
}
