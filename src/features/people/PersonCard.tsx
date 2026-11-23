import Link from "next/link";
import { imageUrl } from "@/integrations/tmdb-display";
import { MediaImage } from "@/features/catalog/MediaImage";

export function PersonCard({
  id,
  name,
  profilePath,
  role,
  locale,
}: {
  id: number;
  name: string;
  profilePath?: string | null;
  role?: string;
  locale: string;
}) {
  return (
    <Link
      href={`/${locale}/person/${id}`}
      className="flex basis-[120px] shrink-0 grow flex-col items-center gap-[5px] text-center text-[13px] mobile:basis-[88px]"
    >
      <span className="relative grid aspect-square h-[120px] w-[120px] max-w-full place-items-center overflow-hidden rounded-[50%] bg-title-placeholder text-[32px] text-title-muted mobile:h-[88px] mobile:w-[88px] [&_img]:absolute [&_img]:inset-0 [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
        <MediaImage
          src={imageUrl(profilePath, "w185")}
          alt=""
          fallback={name.slice(0, 1)}
        />
      </span>
      <strong>{name}</strong>
      {role && <span className="text-xs text-detail-muted">{role}</span>}
    </Link>
  );
}
