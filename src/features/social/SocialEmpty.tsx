import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function SocialEmpty({
  message,
  action,
}: {
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-muted-foreground sm:p-6">
      <p>{message}</p>
      {action && (
        <Link
          className={buttonVariants({ variant: "outline", className: "mt-4" })}
          href={action.href}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
