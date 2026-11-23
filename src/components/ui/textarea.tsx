import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "resize-y rounded-[5px] border border-input bg-input-background p-[11px] text-[15px] leading-[normal] text-foreground placeholder:text-placeholder disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
