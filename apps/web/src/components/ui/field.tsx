import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

type FieldProps = {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Se muestra a la derecha de la etiqueta (p. ej. «¿Te olvidaste la contraseña?»). */
  aside?: React.ReactNode;
  className?: string;
  /** Recibe los ids/atributos de accesibilidad que hay que poner en el control. */
  children: (control: { id: string; "aria-describedby": string | undefined; "aria-invalid": true | undefined }) => React.ReactNode;
};

/**
 * Etiqueta + control + ayuda + error, con los ids de accesibilidad bien conectados:
 * el control queda asociado a su etiqueta, a la ayuda y al mensaje de error (aria-describedby / aria-invalid).
 */
function Field({ id, label, hint, error, aside, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div data-slot="field" className={cn("grid gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-text-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-[#ff8fa5]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { Field };
