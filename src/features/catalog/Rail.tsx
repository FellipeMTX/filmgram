"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export function Rail({
  children,
  label,
  previous,
  next,
  variant = "poster",
}: {
  children: ReactNode;
  label: string;
  previous: string;
  next: string;
  variant?: "poster" | "cast";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const [edges, setEdges] = useState({ left: false, right: false });
  const update = useCallback(() => {
    const el = ref.current;
    if (el)
      setEdges({
        left: el.scrollLeft > 1,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update, children]);
  const cancelHover = useCallback(() => {
    window.clearTimeout(hoverTimer.current);
  }, []);
  useEffect(() => cancelHover, [cancelHover]);
  const move = (direction: number) =>
    ref.current?.scrollBy({
      left: direction * (ref.current.clientWidth * 0.8),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  function arrow(direction: -1 | 1, available: boolean, label: string) {
    return (
      <button
        type="button"
        className={`absolute z-[2] top-[35%] -translate-y-1/2 h-10 w-10 rounded-full border border-rail-border bg-rail-background text-[28px] text-white aria-disabled:opacity-55 aria-disabled:not-focus:invisible hover:not-aria-disabled:border-primary hover:not-aria-disabled:bg-accent ${direction === -1 ? "left-1" : "right-1"}`}
        aria-label={label}
        aria-disabled={!available}
        tabIndex={available ? 0 : -1}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse" || !available) return;
          cancelHover();
          hoverTimer.current = window.setTimeout(() => move(direction), 240);
        }}
        onPointerLeave={cancelHover}
        onClick={() => {
          cancelHover();
          if (available) move(direction);
        }}
      >
        {direction === -1 ? "‹" : "›"}
      </button>
    );
  }
  return (
    <div
      className={"relative min-w-0"}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const direction = e.key === "ArrowLeft" ? -1 : 1;
        if (direction === -1 ? edges.left : edges.right) {
          e.preventDefault();
          move(direction);
        }
      }}
    >
      {arrow(-1, edges.left, previous)}
      <div
        ref={ref}
        className={`flex snap-x snap-proximity gap-[18px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:min-w-0 [&>*]:shrink-0 [&>*]:snap-start mobile:gap-3 ${variant === "poster" ? "[&>*]:basis-[calc((100%-90px)/6)] mobile:[&>*]:basis-[145px]" : ""}`}
        role="region"
        aria-label={label}
        onScroll={update}
      >
        {children}
      </div>
      {arrow(1, edges.right, next)}
    </div>
  );
}
