"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Popover } from "radix-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import { messages } from "@/i18n/messages";
import { cn } from "@/lib/utils";
import { profileLabels } from "./labels";

export function ProfileAccountMenu({ locale }: { locale: string }) {
  const labels = profileLabels(locale);
  const text = messages(locale);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button type="button" variant="outline">
          {labels.account}
          <ChevronDown aria-hidden="true" className="size-4" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          aria-label={labels.account}
          className="z-50 grid min-w-40 gap-1 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          <Link
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "justify-start",
            )}
            href={`/${locale}/favorites`}
          >
            {labels.saved}
          </Link>
          <form action={signOut}>
            <input type="hidden" name="next" value={`/${locale}/discover`} />
            <Button
              className="w-full justify-start"
              type="submit"
              variant="ghost"
              size="sm"
            >
              {text.signOut}
            </Button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
