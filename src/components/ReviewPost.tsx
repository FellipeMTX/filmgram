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
import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TitleReviewContext } from "@/features/social/TitleReviewContext";
import {
  CommunityEditControl,
  CommunityCardEditor,
} from "@/features/social/CommunityEditor";
import { FollowReviewAuthor } from "@/features/social/FollowReviewAuthor";
import { ReviewVideo } from "@/components/ReviewVideo";
import { ReviewRichText } from "@/components/ReviewRichText";
import { FilmgramRating } from "@/components/FilmgramRating";
import { reviewYoutubeId } from "@/features/social/review-content";

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
    less: "Show less",
    title: "View title",
    close: "Close full review",
    full: "Full review",
    open: "Open review",
  },
  "pt-BR": {
    more: "Ver mais",
    less: "Ver menos",
    title: "Ver ficha",
    close: "Fechar resenha completa",
    full: "Resenha completa",
    open: "Abrir resenha",
  },
  es: {
    more: "Ver más",
    less: "Ver menos",
    title: "Ver ficha",
    close: "Cerrar reseña completa",
    full: "Reseña completa",
    open: "Abrir reseña",
  },
};
export type ReviewPostProps = {
  reviewId: string;
  tmdbId: number;
  placement?: "title";
  mediaType?: "movie" | "tv";
  locale: string;
  author: { name: string; href?: string; avatarUrl?: string | null };
  authorId?: string;
  viewerId?: string | null;
  followed?: boolean;
  date: string;
  title: string;
  year?: string | number | null;
  rating?: number | null;
  text: string;
  content?: unknown;
  titleHref: string;
  backdropUrl?: string | null;
  posterUrl?: string | null;
  trailerUrl?: string | null;
  interaction?: ReactNode;
};

function Byline({
  author,
  date,
  follow,
}: Pick<ReviewPostProps, "author" | "date"> & { follow?: ReactNode }) {
  const initials = author.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
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
          {follow}
        </div>
      </div>
      <time className="shrink-0 text-right text-xs text-subtle">{date}</time>
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
        <FilmgramRating value={rating} locale={locale} className="text-sm" />
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
  const copyRef = useRef<HTMLDivElement>(null);
  const inlineHost = useRef<HTMLDivElement>(null);
  const modalHost = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const card = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"read" | "discussion">("read");
  const [overflow, setOverflow] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
    if (host && interactionContainer.parentNode !== host)
      host.appendChild(interactionContainer);
  }, [open, interactionContainer]);
  useEffect(() => {
    const node = copyRef.current;
    if (!node) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(node).lineHeight);
      setOverflow(node.scrollHeight > lineHeight * 6 + 1);
    };
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
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && interactionContainer && inlineHost.current)
          inlineHost.current.appendChild(interactionContainer);
        setOpen(nextOpen);
      }}
    >
      {/* The card accepts pointer clicks; the equivalent button below provides keyboard access. */}
      <article
        id={`review-${props.reviewId}`}
        data-review-id={props.reviewId}
        ref={card}
        tabIndex={-1}
        onClick={(event) => {
          const target = event.target;
          if (
            !(target instanceof Element) ||
            target.closest(
              "a,button,input,textarea,select,label,[contenteditable=true]",
            )
          )
            return;
          if (window.getSelection()?.toString()) return;
          opener.current = card.current;
          setMode("read");
          setOpen(true);
        }}
        className="min-w-0 cursor-pointer rounded-xl border border-border bg-card p-[clamp(12px,2.5vw,20px)] [overflow-wrap:anywhere]"
      >
        {(!artwork || props.placement === "title") && (
          <button
            type="button"
            className="sr-only focus:not-sr-only focus:mb-3 focus:rounded focus:outline-2 focus:outline-primary"
            onClick={(event) => {
              opener.current = event.currentTarget;
              setMode("read");
              setOpen(true);
            }}
          >
            {t.open}: {title}
          </button>
        )}
        <div className="mb-3 flex items-start gap-3">
          <Byline
            author={author}
            date={date}
            follow={
              props.placement === "title" && props.authorId ? (
                <FollowReviewAuthor
                  authorId={props.authorId}
                  userId={props.viewerId || null}
                  followed={!!props.followed}
                  locale={props.locale}
                />
              ) : null
            }
          />
          {props.placement === "title" && (
            <CommunityEditControl reviewId={props.reviewId} />
          )}
        </div>
        <Heading {...props} />
        {artwork && props.placement !== "title" && (
          <button
            type="button"
            aria-label={`${t.open}: ${title}`}
            onClick={(event) => {
              opener.current = event.currentTarget;
              setMode("read");
              setOpen(true);
            }}
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
          </button>
        )}
        <div className="relative mt-3 mb-4 text-sm">
          <div
            ref={copyRef}
            aria-hidden={expanded}
            className={`${expanded ? "invisible absolute w-full" : ""} line-clamp-6 whitespace-pre-line leading-[1.55]`}
          >
            <ReviewRichText
              content={props.content}
              fallback={text}
              locale={props.locale}
              showMedia={false}
              showLinks={!overflow}
            />
          </div>
          {expanded && (
            <ReviewRichText
              content={props.content}
              fallback={text}
              locale={props.locale}
              showMedia={false}
              className="leading-[1.55]"
            />
          )}
          {overflow && props.placement === "title" && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="mt-1 font-bold text-primary hover:underline"
            >
              {expanded ? t.less : t.more}
            </button>
          )}
          {overflow && props.placement !== "title" && (
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
        {props.placement === "title" &&
          (reviewYoutubeId(props.content) || trailerUrl) && (
            <ReviewVideo
              url={
                reviewYoutubeId(props.content)
                  ? `https://www.youtube.com/watch?v=${reviewYoutubeId(props.content)}`
                  : trailerUrl!
              }
              locale={props.locale}
            />
          )}
        {props.placement === "title" && (
          <CommunityCardEditor reviewId={props.reviewId} />
        )}
        <div
          ref={(node) => {
            inlineHost.current = node;
            if (
              node &&
              !open &&
              interactionContainer &&
              interactionContainer.parentNode !== node
            )
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
            <Link
              href={`${titleHref}?review=${props.reviewId}#review-${props.reviewId}`}
              aria-label={`${t.title}: ${title}`}
              onNavigate={() => {
                if (props.placement === "title") {
                  if (interactionContainer && inlineHost.current)
                    inlineHost.current.appendChild(interactionContainer);
                  setOpen(false);
                }
              }}
              className="relative flex min-h-[clamp(142px,28vw,245px)] items-end overflow-hidden bg-secondary p-[clamp(14px,3vw,24px)]"
            >
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
            </Link>
            {props.mediaType && (
              <TitleReviewContext
                locale={props.locale}
                mediaType={props.mediaType}
                tmdbId={props.tmdbId}
                reviewId={props.reviewId}
                titleHref={titleHref}
                selected={(own, data) => (
                  <>
                    <div>
                      <Byline
                        author={author}
                        date={date}
                        follow={
                          data?.selectedAuthorId ? (
                            <FollowReviewAuthor
                              authorId={data.selectedAuthorId}
                              userId={data.userId}
                              followed={data.followed.includes(
                                data.selectedAuthorId,
                              )}
                              locale={props.locale}
                            />
                          ) : null
                        }
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      {(own?.id === props.reviewId
                        ? own.rating
                        : props.rating) != null && (
                        <FilmgramRating
                          value={
                            (own?.id === props.reviewId
                              ? own.rating
                              : props.rating)!
                          }
                          locale={props.locale}
                        />
                      )}
                      <CommunityEditControl reviewId={props.reviewId} />
                    </div>
                    <ReviewRichText
                      content={
                        own?.id === props.reviewId
                          ? own.body_document
                          : props.content
                      }
                      fallback={
                        (own?.id === props.reviewId ? own.body : text) || ""
                      }
                      locale={props.locale}
                      className="mt-3 text-sm leading-[1.55]"
                    />
                    {!reviewYoutubeId(
                      own?.id === props.reviewId
                        ? own.body_document
                        : props.content,
                    ) &&
                      (own?.id === props.reviewId
                        ? own.youtube_video_id
                        : trailerUrl) && (
                        <ReviewVideo
                          url={
                            own?.id === props.reviewId
                              ? `https://www.youtube.com/watch?v=${own.youtube_video_id}`
                              : trailerUrl!
                          }
                          locale={props.locale}
                        />
                      )}
                    <CommunityCardEditor reviewId={props.reviewId} />
                    <div
                      ref={(node) => {
                        modalHost.current = node;
                        if (
                          node &&
                          interactionContainer &&
                          interactionContainer.parentNode !== node
                        )
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
