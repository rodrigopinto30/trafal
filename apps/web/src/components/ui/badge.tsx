import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Etiquetas chicas en mayúsculas con la tipografía pixel (NUEVO, 1ER JUEGO, AVANCE...). */
const badgeVariants = cva(
  "pixel-label inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] leading-none",
  {
    variants: {
      variant: {
        violet: "bg-violet text-ink shadow-glow-violet",
        cyan: "bg-cyan/12 text-cyan",
        lime: "border border-lime/35 bg-lime/12 text-lime",
        coral: "bg-coral/14 text-[#ff9cb0]",
        soft: "bg-violet/18 text-[#d3c2ff]",
        outline: "border border-white/15 text-text-2",
      },
    },
    defaultVariants: { variant: "soft" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
