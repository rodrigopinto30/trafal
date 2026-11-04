import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Casilla de verificación. Es un <input type="checkbox"> NATIVO (no el de Radix) a propósito: React 19 «resetea» el
 * formulario cuando termina una Server Action, y el Checkbox de Radix escucha ese reset y se vuelve a desmarcar aunque la
 * persona ya lo hubiera tildado (tendría que volver a aceptar los términos cada vez que un campo viene con error). Un input
 * nativo no controlado, con `defaultChecked` tomado de lo que devuelve el servidor, conserva su estado.
 *
 * El input real (invisible) cubre 44 × 44 px alrededor del dibujo de 24 px: ese es el área táctil.
 */
function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <span data-slot="checkbox" className={cn("relative inline-grid size-6 shrink-0 place-items-center", className)}>
      <input
        type="checkbox"
        className="peer absolute top-1/2 left-1/2 z-10 size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        {...props}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none grid size-6 place-items-center rounded-lg border border-white/30 bg-white/5 text-ink",
          "transition-[background-color,border-color,box-shadow]",
          "peer-checked:border-transparent peer-checked:bg-brand peer-checked:shadow-glow-violet",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-cyan peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
          "peer-aria-invalid:border-coral peer-aria-invalid:ring-2 peer-aria-invalid:ring-coral/40",
          "peer-disabled:opacity-50",
          "[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
        )}
      >
        <CheckIcon className="size-4" strokeWidth={3} />
      </span>
    </span>
  );
}

export { Checkbox };
