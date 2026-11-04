import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * <select> nativo con el estilo de los campos de Trafal. Se prefiere el nativo (en vez de un menú
 * propio) porque en celulares abre el selector del sistema, que es más cómodo y accesible.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-12 w-full appearance-none rounded-2xl border border-white/15 bg-white/5 py-0 pr-11 pl-4 text-base text-foreground",
          "transition-[border-color,box-shadow,background-color] outline-none",
          "focus-visible:border-cyan focus-visible:bg-cyan/5 focus-visible:ring-2 focus-visible:ring-cyan/40 focus-visible:outline-none",
          "aria-invalid:border-coral aria-invalid:ring-2 aria-invalid:ring-coral/30 disabled:cursor-not-allowed disabled:opacity-50",
          "[&>option]:bg-panel [&>option]:text-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-text-3" />
    </div>
  );
}

export { NativeSelect };
