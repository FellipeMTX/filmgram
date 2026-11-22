import { getRequestConfig } from "next-intl/server";
import { isLocale, messages } from "@/i18n/messages";
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : "en";
  return { locale, messages: messages(locale) };
});
