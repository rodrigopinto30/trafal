import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bloque de la configuración: una tarjeta con el mismo marco que la cabecera del perfil, así todas las pantallas
 * de la cuenta ocupan el mismo ancho. Lleva su título como encabezado de nivel 3 y queda asociada a él (aria-labelledby).
 */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("rounded-[28px] border border-white/8 bg-card p-6 sm:p-8", className)}>
      <header className="mb-5">
        <h3 id={headingId} className="font-display text-xl leading-tight font-bold">
          {title}
        </h3>
        {description ? <p className="mt-1 text-sm text-text-2">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
