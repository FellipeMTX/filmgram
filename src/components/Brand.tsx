import Image from "next/image";
import brand from "../../public/brand/filmgram-popcorn.png";

export function Brand({
  decorative = false,
  header = false,
}: {
  decorative?: boolean;
  header?: boolean;
}) {
  return (
    <Image
      src={brand}
      alt={decorative ? "" : "Filmgram"}
      loading={header ? "eager" : "lazy"}
      sizes={header ? "(max-width: 700px) 115px, 134px" : "88px"}
      className={
        header
          ? "h-auto w-[134px] mobile:w-[115px]"
          : "inline-block h-auto w-[88px] align-middle"
      }
    />
  );
}
