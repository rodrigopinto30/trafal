import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TopicTileProps = Omit<React.ComponentProps<"input">, "type" | "children"> & {
  label: React.ReactNode;
  icon: React.ReactNode;
};

/**
 * Casilla con forma de baldosa (ícono + nombre) para elegir temas en una grilla: se toca para elegir y se vuelve a
 * tocar para sacar. Es un <input type="checkbox"> real, así que funciona con teclado (espacio), con lectores de pantalla
 * y hasta sin JavaScript. El tilde de la esquina hace que el estado no dependa solo del color.
 */
function TopicTile({ label, icon, className, ...props }: TopicTileProps) {
  return (
    <label className={cn("relative flex", className)}>
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        className={cn(
          "flex min-h-[72px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-white/5 px-2 py-3 text-center text-sm font-semibold text-text-2",
          "transition-[background-color,border-color,color,box-shadow,transform] duration-150 select-none",
          "hover:border-white/30 hover:bg-white/8 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
          "peer-checked:border-violet peer-checked:bg-violet/22 peer-checked:text-white peer-checked:shadow-glow-violet",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-cyan peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
          "peer-disabled:opacity-50",
          "[&_svg]:size-5 [&_svg]:text-text-3 peer-checked:[&_svg]:text-cyan",
        )}
      >
        {icon}
        {label}
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-cyan text-ink opacity-0 transition-opacity peer-checked:opacity-100"
      >
        <CheckIcon className="size-3.5" strokeWidth={3.5} />
      </span>
    </label>
  );
}

export { TopicTile };
