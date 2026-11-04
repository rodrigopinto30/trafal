import * as React from "react";
import { cn } from "@/lib/utils";

type ChipCheckboxProps = Omit<React.ComponentProps<"input">, "type" | "children"> & { label: React.ReactNode };

/**
 * Casilla con forma de chip (como los filtros de género de la landing). Es un <input type="checkbox">
 * real: funciona sin JavaScript, con teclado y con lectores de pantalla.
 */
function ChipCheckbox({ label, className, ...props }: ChipCheckboxProps) {
  return (
    <label className={cn("relative inline-flex", className)}>
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        className={cn(
          "inline-flex h-11 items-center rounded-full border border-white/15 bg-white/5 px-4 text-sm font-semibold text-text-2",
          "transition-[background-color,border-color,color,box-shadow]",
          "peer-checked:border-violet peer-checked:bg-violet/22 peer-checked:text-white peer-checked:shadow-glow-violet",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-cyan peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
          "peer-disabled:opacity-50 hover:border-white/30",
        )}
      >
        {label}
      </span>
    </label>
  );
}

export { ChipCheckbox };
