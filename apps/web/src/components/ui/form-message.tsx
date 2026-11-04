import * as React from "react";
import { cn } from "@/lib/utils";

type FormMessageProps = React.ComponentProps<"div"> & { tone?: "error" | "info" };

/** Mensaje de resultado de un formulario. Los errores se anuncian a lectores de pantalla (role="alert"). */
function FormMessage({ tone = "error", className, children, ...props }: FormMessageProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
        tone === "error" ? "border-coral/40 bg-coral/10 text-[#ffb3c1]" : "border-cyan/40 bg-cyan/10 text-cyan",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { FormMessage };
