"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export function FilmographyDisclosure({
  cards,
  initiallyExpanded,
  firstPageUrl,
  more,
  less,
  pagination,
}: {
  cards: ReactNode[];
  initiallyExpanded: boolean;
  firstPageUrl: string;
  more: string;
  less: string;
  pagination: ReactNode;
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const visible = expanded ? cards : cards.slice(0, 12);
  return (
    <>
      <div
        id="filmography-works"
        className="grid grid-cols-6 gap-[18px] max-[1024px]:grid-cols-4 mobile:grid-cols-2 mobile:gap-x-[14px] mobile:gap-y-5"
      >
        {visible.map((card, i) => (
          <div
            key={i}
            className={
              !expanded
                ? i >= 8
                  ? "max-[1024px]:hidden"
                  : i >= 4
                    ? "mobile:hidden"
                    : ""
                : ""
            }
          >
            {card}
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        {(cards.length > 4 || initiallyExpanded) &&
          (expanded ? (
            initiallyExpanded ? (
              <Link
                href={firstPageUrl}
                className={buttonVariants({ variant: "outline" })}
              >
                {less}
              </Link>
            ) : (
              <Button
                type="button"
                variant="outline"
                aria-controls="filmography-works"
                aria-expanded="true"
                onClick={() => setExpanded(false)}
              >
                {less}
              </Button>
            )
          ) : (
            <Button
              type="button"
              variant="outline"
              aria-controls="filmography-works"
              aria-expanded="false"
              onClick={() => setExpanded(true)}
              className={
                cards.length <= 8
                  ? "min-[701px]:hidden"
                  : cards.length <= 12
                    ? "min-[1024px]:hidden"
                    : ""
              }
            >
              {more}
            </Button>
          ))}
      </div>
      {expanded && pagination}
    </>
  );
}
