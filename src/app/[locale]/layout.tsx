import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { isLocale, messages } from "@/i18n/messages";
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
    </NextIntlClientProvider>
  );
}
