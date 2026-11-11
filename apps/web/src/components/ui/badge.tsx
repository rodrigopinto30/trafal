import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Etiquetas chicas en mayúsculas con la tipografía pixel (NUEVO, 1ER JUEGO, AVANCE...). Todas tienen un contraste marcado contra la
 * tarjeta: las de color van rellenas con texto oscuro y las neutras con borde claro y texto blanco.
 */
const badgeVariants = cva(
  "pixel-label inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] leading-none",
  {
    variants: {
      variant: {
        violet: "bg-violet-pale text-violet-ink shadow-glow-violet",
        cyan: "bg-cyan text-ink",
        lime: "bg-lime text-ink",
        coral: "bg-coral text-ink",
        soft: "border border-violet bg-violet/45 text-white",
        outline: "border border-white/40 bg-white/8 text-foreground",
      },
    },
    defaultVariants: { variant: "soft" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
