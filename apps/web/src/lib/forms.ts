/** Estado que devuelven las Server Actions de formularios (lo consume useActionState). */
export type FormState = {
  status: "idle" | "error" | "success";
  /** Mensaje general, ya traducido. */
  message?: string;
  /** Errores por campo (nombre del input → mensaje traducido). */
  fieldErrors?: Record<string, string>;
  /** Valores a devolver al formulario cuando hay error (nunca contraseñas). */
  values?: Record<string, string>;
  /** Email al que se mandó un link (pantalla «revisá tu email»). */
  sentTo?: string;
};

export const initialFormState: FormState = { status: "idle" };

export function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
