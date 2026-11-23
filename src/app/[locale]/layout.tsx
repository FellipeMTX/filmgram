import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { isLocale, messages } from "@/i18n/messages";
import Link from "next/link";
import { Header } from "@/components/Header";
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
      <footer className="footer container">
        FILMGRAM <span>·</span> {messages(locale).tagline}{" "}
        <Link href={`/${locale}/credits`}>{messages(locale).credits}</Link>
      </footer>
    </NextIntlClientProvider>
  );
}
