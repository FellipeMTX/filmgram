"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./Cards.module.css";
export function Rail({
  children,
  label,
  previous,
  next,
}: {
  children: ReactNode;
  label: string;
  previous: string;
  next: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
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
  const move = (direction: number) =>
    ref.current?.scrollBy({
      left: direction * (ref.current.clientWidth * 0.8),
      behavior: "smooth",
    });
  return (
    <div className={styles.rail}>
      {edges.left && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.left}`}
          aria-label={previous}
          onClick={() => move(-1)}
        >
          ‹
        </button>
      )}
      <div
        ref={ref}
        className={styles.row}
        role="region"
        aria-label={label}
        onScroll={update}
      >
        {children}
      </div>
      {edges.right && (
        <button
          type="button"
          className={`${styles.arrow} ${styles.right}`}
          aria-label={next}
          onClick={() => move(1)}
        >
          ›
        </button>
      )}
    </div>
  );
}
