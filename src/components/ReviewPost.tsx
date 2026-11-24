"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, X, Play } from "lucide-react";
import { Dialog } from "radix-ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TitleReviewContext } from "@/features/social/TitleReviewContext";

const ReviewPostModal = createContext<{
  open: boolean;
  mode: "read" | "discussion";
  feed: boolean;
  openDiscussion?: (button: HTMLButtonElement) => void;
}>({ open: false, mode: "read", feed: false });
export const useReviewPostModal = () => useContext(ReviewPostModal);
const labels = {
  en: {
    more: "Read more",
    title: "View title",
    close: "Close full review",
    full: "Full review",
  },
  "pt-BR": {
    more: "Ver mais",
    title: "Ver ficha",
    close: "Fechar resenha completa",
    full: "Resenha completa",
  },
  es: {
    more: "Ver más",
    title: "Ver ficha",
    close: "Cerrar reseña completa",
    full: "Reseña completa",
  },
};
export type ReviewPostProps = {
  reviewId: string;
  tmdbId: number;
  placement?: "title";
  mediaType?: "movie" | "tv";
  locale: string;
  author: { name: string; href?: string; avatarUrl?: string | null };
  date: string;
  title: string;
  year?: string | number | null;
  rating?: number | null;
  text: string;
  titleHref: string;
  backdropUrl?: string | null;
  posterUrl?: string | null;
  trailerUrl?: string | null;
  interaction?: ReactNode;
};

function Byline({ author, date }: Pick<ReviewPostProps, "author" | "date">) {
  const initials = author.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <Avatar>
        <AvatarImage src={author.avatarUrl ?? undefined} alt="" />
        <AvatarFallback className="bg-avatar text-xs text-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 text-sm">
        <strong>
          {author.href ? (
            <Link href={author.href} className="hover:text-primary">
              {author.name}
            </Link>
          ) : (
            author.name
          )}
        </strong>
        <div className="text-xs text-subtle">{date}</div>
      </div>
    </div>
  );
}

function Heading({
  title,
  year,
  rating,
  titleHref,
  placement,
  mediaType,
  locale,
}: Pick<
  ReviewPostProps,
  | "title"
  | "year"
  | "rating"
  | "titleHref"
  | "placement"
  | "mediaType"
  | "locale"
>) {
  const stars = Math.max(0, Math.min(5, Math.round(rating ?? 0)));
  const meta =
    mediaType === "tv"
      ? locale === "en"
        ? "Series"
        : "Série"
      : locale === "en"
        ? "Film"
        : locale === "es"
          ? "Película"
          : "Filme";
  return (
    <div className="mb-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      {placement !== "title" && (
        <div>
          <Link
            href={titleHref}
            className="font-display text-[clamp(23px,4vw,32px)] leading-tight font-bold hover:text-primary"
          >
            {title}
          </Link>
          <div className="text-xs text-muted-foreground">
            {mediaType ? meta : ""}
            {year ? ` · ${year}` : ""}
          </div>
        </div>
      )}
      {rating != null && (
        <span
          className="whitespace-nowrap text-sm font-semibold"
          aria-label={`${rating}/5`}
        >
          <span
            aria-hidden="true"
            className="text-lg tracking-wider text-primary"
          >
            {"★".repeat(stars)}
            {"☆".repeat(5 - stars)}
          </span>{" "}
          {rating}/5
        </span>
      )}
    </div>
  );
}

/** Shared card and full review. The interaction subtree keeps its state when moved into the dialog. */
export function ReviewPost(props: ReviewPostProps) {
  const {
    author,
    date,
    text,
    title,
    titleHref,
    backdropUrl,
    posterUrl,
    trailerUrl,
    interaction,
  } = props;
  const lang =
    props.locale === "pt-BR" || props.locale === "es" ? props.locale : "en";
  const t = labels[lang];
  const [failedArtwork, setFailedArtwork] = useState<string[]>([]);
  const artwork = [backdropUrl, posterUrl].find(
    (url) => url && !failedArtwork.includes(url),
  );
  const copyRef = useRef<HTMLParagraphElement>(null);
  const inlineHost = useRef<HTMLDivElement>(null);
  const modalHost = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const card = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"read" | "discussion">("read");
  const [overflow, setOverflow] = useState(false);
  const [interactionContainer, setInteractionContainer] =
    useState<HTMLDivElement | null>(null);

  // The portal host must be created after hydration because it is a browser DOM node.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInteractionContainer(document.createElement("div"));
  }, []);
  useLayoutEffect(() => {
    if (!interactionContainer) return;
    const host = open ? modalHost.current : inlineHost.current;
    host?.appendChild(interactionContainer);
  }, [open, interactionContainer]);
  useEffect(() => {
    const node = copyRef.current;
    if (!node) return;
    const measure = () =>
      setOverflow(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    document.fonts.ready.then(measure);
    document.fonts.addEventListener("loadingdone", measure);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", measure);
    };
  }, [text]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <article
        id={`review-${props.reviewId}`}
        data-review-id={props.reviewId}
        ref={card}
        tabIndex={-1}
        className="min-w-0 rounded-xl border border-border bg-card p-[clamp(12px,2.5vw,20px)] [overflow-wrap:anywhere]"
      >
        <Byline author={author} date={date} />
        <Heading {...props} />
        {artwork && props.placement !== "title" && (
          <Link
            href={titleHref}
            aria-label={`${t.title}: ${title}`}
            className="relative block w-full aspect-[16/8.75] max-h-[390px] overflow-hidden rounded-lg bg-secondary"
          >
            <Image
              src={artwork}
              alt=""
              fill
              unoptimized
              sizes="(max-width: 680px) 95vw, 680px"
              onError={() => setFailedArtwork((failed) => [...failed, artwork])}
              className={
                artwork === backdropUrl
                  ? "object-cover transition hover:brightness-110"
                  : "object-contain"
              }
            />
            <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-md bg-black/85 px-2 py-1 text-xs">
              {t.title} <ArrowUpRight size={14} />
            </span>
          </Link>
        )}
        <div className="mt-3 mb-4 text-sm">
          <p
            ref={copyRef}
            className="line-clamp-6 whitespace-pre-line leading-[1.55]"
          >
            {text}
          </p>
          {overflow && (
            <Dialog.Trigger asChild>
              <button
                onClick={(event) => {
                  setMode("read");
                  opener.current = event.currentTarget;
                }}
                type="button"
                className="mt-1 font-bold text-primary hover:underline"
              >
                {t.more}
              </button>
            </Dialog.Trigger>
          )}
        </div>
        {trailerUrl && (
          <a
            href={trailerUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-subtle hover:text-primary"
          >
            <Play size={17} /> YouTube <ArrowUpRight size={14} />
          </a>
        )}
        <div
          ref={(node) => {
            inlineHost.current = node;
            if (node && !open && interactionContainer)
              node.appendChild(interactionContainer);
          }}
        />
      </article>
      {interactionContainer &&
        createPortal(
          <ReviewPostModal.Provider
            value={{
              open,
              mode,
              feed: props.placement !== "title",
              openDiscussion: (button) => {
                opener.current = button;
                setMode("discussion");
                setOpen(true);
              },
            }}
          >
            {interaction}
          </ReviewPostModal.Provider>,
          interactionContainer,
        )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/85" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (opener.current?.isConnected
              ? opener.current
              : card.current
            )?.focus();
          }}
          className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-26px)] w-[min(760px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-xl focus:outline-none"
        >
          <Dialog.Title className="sr-only">
            {t.full}: {title}
          </Dialog.Title>
          <Dialog.Close
            aria-label={t.close}
            className="absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-md border border-border bg-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X size={20} />
          </Dialog.Close>
          <div className="max-h-[min(calc(100dvh-26px),760px)] overflow-auto overscroll-contain">
            <header className="relative flex min-h-[clamp(142px,28vw,245px)] items-end overflow-hidden bg-secondary p-[clamp(14px,3vw,24px)]">
              {artwork && (
                <Image
                  src={artwork}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 760px) 95vw, 760px"
                  onError={() =>
                    setFailedArtwork((failed) => [...failed, artwork])
                  }
                  className={
                    artwork === backdropUrl ? "object-cover" : "object-contain"
                  }
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 to-transparent" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  {props.mediaType === "tv"
                    ? lang === "en"
                      ? "Series"
                      : "Série"
                    : lang === "en"
                      ? "Film"
                      : lang === "es"
                        ? "Película"
                        : "Filme"}
                  {props.year ? ` · ${props.year}` : ""}
                </p>
                <p className="font-display text-[clamp(28px,4vw,42px)] font-bold">
                  {title}
                </p>
              </div>
            </header>
            {props.mediaType && (
              <TitleReviewContext
                locale={props.locale}
                mediaType={props.mediaType}
                tmdbId={props.tmdbId}
                reviewId={props.reviewId}
                onTitlePage={props.placement === "title"}
                titleHref={titleHref}
                selected={(own) => (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Byline author={author} date={date} />
                      {(own?.id === props.reviewId
                        ? own.rating
                        : props.rating) != null && (
                        <p className="text-primary">
                          {"★".repeat(
                            (own?.id === props.reviewId
                              ? own.rating
                              : props.rating) || 0,
                          )}
                          {"☆".repeat(
                            5 -
                              ((own?.id === props.reviewId
                                ? own.rating
                                : props.rating) || 0),
                          )}{" "}
                          <span className="text-foreground">
                            {own?.id === props.reviewId
                              ? own.rating
                              : props.rating}
                            /5
                          </span>
                        </p>
                      )}
                    </div>
                    <p className="mt-3 whitespace-pre-line text-sm leading-[1.55]">
                      {own?.id === props.reviewId ? own.body : text}
                    </p>
                    {trailerUrl && (
                      <a
                        href={trailerUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-subtle hover:text-primary"
                      >
                        <Play size={17} /> YouTube <ArrowUpRight size={14} />
                      </a>
                    )}
                    <div
                      ref={(node) => {
                        modalHost.current = node;
                        if (node && interactionContainer)
                          node.appendChild(interactionContainer);
                      }}
                    />
                  </>
                )}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
