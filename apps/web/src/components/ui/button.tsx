import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Botones tipo píldora con brillo neón suave. Todos miden al menos 44 px de alto (objetivo táctil).
 *   default → acción principal (degradé violeta → cian)
 *   play    → SOLO acciones de jugar (lima)
 *   like    → me gusta (coral)
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold select-none",
    "transition-[box-shadow,transform,filter,background-color,border-color,color] duration-200",
    "outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "hover:-translate-y-px hover:brightness-110 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.1em]",
  ],
  {
    variants: {
      variant: {
        default: "bg-brand font-bold text-ink shadow-glow-violet hover:shadow-glow-violet-lg",
        play: "bg-lime font-bold text-ink shadow-glow-lime hover:shadow-[0_0_28px_rgb(198_255_61/0.6)]",
        secondary: "bg-foreground font-bold text-ink hover:shadow-[0_0_20px_rgb(255_255_255/0.3)]",
        outline: "border border-white/20 bg-white/5 text-foreground hover:border-cyan/60 hover:bg-white/10",
        ghost: "text-foreground hover:bg-white/10",
        like: "bg-coral/15 text-[#ff8fa5] hover:shadow-glow-coral",
        destructive: "bg-coral font-bold text-ink hover:shadow-glow-coral",
        link: "h-auto min-h-0 rounded-md px-0 text-cyan underline-offset-4 hover:translate-y-0 hover:underline hover:brightness-125",
      },
      size: {
        default: "h-11 px-5 text-sm",
        lg: "h-[50px] px-6 text-base",
        xl: "h-14 px-7 text-base",
        icon: "size-11",
        "icon-lg": "size-[50px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { Button, buttonVariants };
