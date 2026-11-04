"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Input } from "./input";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  showLabel: string;
  hideLabel: string;
};

/** Campo de contraseña con botón de mostrar/ocultar (objetivo táctil de 44 px). */
function PasswordInput({ showLabel, hideLabel, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={`pr-14 ${className ?? ""}`} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full text-text-3 transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-cyan"
      >
        {visible ? <EyeOffIcon aria-hidden="true" className="size-5" /> : <EyeIcon aria-hidden="true" className="size-5" />}
      </button>
    </div>
  );
}

export { PasswordInput };
