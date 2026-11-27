import { MissingPage } from "@/features/catalog/MissingPage";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function Missing({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ playlist?: string }>;
}) {
  if ((await headers()).get("x-filmgram-internal-missing") !== "1") notFound();
  const { locale } = await params;
  const { playlist } = await searchParams;
  return <MissingPage locale={locale} playlist={playlist === "1"} />;
}
