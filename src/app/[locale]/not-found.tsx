"use client";
import { useParams, usePathname } from "next/navigation";
import { MissingPage } from "@/features/catalog/MissingPage";
export default function NotFound() {
  const params = useParams();
  const pathname = usePathname();
  return (
    <MissingPage
      locale={String(params.locale || "en")}
      playlist={/^\/(?:en|pt-BR|es)\/playlists\/[^/]+\/?$/.test(pathname)}
    />
  );
}
