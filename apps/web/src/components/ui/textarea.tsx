import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-28 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-foreground",
        "placeholder:text-text-3 transition-[border-color,box-shadow,background-color] outline-none",
        "focus-visible:border-cyan focus-visible:bg-cyan/5 focus-visible:ring-2 focus-visible:ring-cyan/40 focus-visible:outline-none",
        "aria-invalid:border-coral aria-invalid:ring-2 aria-invalid:ring-coral/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
