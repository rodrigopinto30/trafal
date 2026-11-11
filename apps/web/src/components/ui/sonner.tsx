"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Avisos (toasts) con el estilo de Trafal. Siempre tema oscuro. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-white/10 !bg-panel !text-foreground !shadow-float !font-sans",
          description: "!text-text-2",
          actionButton: "!bg-action !font-bold !text-white",
          cancelButton: "!bg-white/10 !text-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
