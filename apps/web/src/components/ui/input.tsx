import * as React from "react";
import { cn } from "@/lib/utils";

/** Campo de texto: 48 px de alto y 16 px de letra (en iPhone, menos de 16 px hace zoom al enfocar). */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full min-w-0 rounded-2xl border border-white/15 bg-white/5 px-4 text-base text-foreground",
        "placeholder:text-text-3 transition-[border-color,box-shadow,background-color] outline-none",
        "focus-visible:border-cyan focus-visible:bg-cyan/5 focus-visible:ring-2 focus-visible:ring-cyan/40 focus-visible:outline-none",
        "aria-invalid:border-coral aria-invalid:ring-2 aria-invalid:ring-coral/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
