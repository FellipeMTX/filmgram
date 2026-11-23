import { cn } from "@/lib/utils";
export const container =
  "mx-auto w-[min(1400px,90%)] mobile:mx-5 mobile:w-auto";
export const narrow = cn(
  container,
  "max-w-[900px] pt-[55px] pb-[100px] mobile:pt-[25px]",
);
export const pageTitle =
  "font-display text-[46px] leading-[1.1] font-bold mt-2.5 mb-6 mobile:text-4xl";
export const eyebrow =
  "uppercase text-primary text-xs tracking-[0.16em] font-bold";
export const actionGroup = "flex items-center gap-2.5 flex-wrap";
