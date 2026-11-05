"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { FormState } from "@/lib/forms";

/**
 * Muestra el aviso de éxito de una Server Action una sola vez por resultado. Next conserva el estado de las pantallas ya
 * visitadas y vuelve a ejecutar sus efectos al mostrarlas de nuevo (atrás/adelante): sin este control, un guardado viejo
 * dispararía el aviso otra vez aunque la persona no haya guardado nada.
 */
export function useSuccessToast(state: FormState) {
  const announced = useRef<FormState | null>(null);

  useEffect(() => {
    if (announced.current === state) return;
    announced.current = state;
    if (state.status === "success" && state.message) toast.success(state.message);
  }, [state]);
}
