import Link from "next/link";
import {
  BarChart3,
  Clapperboard,
  Heart,
  ListMusic,
  MessageSquare,
  Users,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const icons = {
  film: Clapperboard,
  people: Users,
  collection: ListMusic,
  review: MessageSquare,
  heart: Heart,
  chart: BarChart3,
};
export function SocialEmpty({
  message,
  title,
  action,
  compact = false,
  icon = "film",
  children,
}: {
  message: string;
  title?: string;
  action?: { href: string; label: string };
  compact?: boolean;
  icon?: keyof typeof icons;
  children?: React.ReactNode;
}) {
  const Icon = icons[icon];
  return (
    <div
      className={`rounded-xl border border-border bg-card ${compact ? "p-4" : "p-6"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          {title && <p className="font-semibold text-foreground">{title}</p>}
          <p className={`${title ? "mt-1 " : ""}text-muted-foreground`}>
            {message}
          </p>
          {action && (
            <Link
              className={
                compact
                  ? "mt-3 inline-block text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  : buttonVariants({ className: "mt-4" })
              }
              href={action.href}
            >
              {action.label}
            </Link>
          )}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}
