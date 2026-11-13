"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { FormMessage } from "@/components/ui/form-message";

/**
 * A form message that scrolls itself into view when it appears or changes. Put it next to the button that caused it: a long form
 * hides what is above the viewport, so a result shown at the top would leave the person looking at the button wondering what happened.
 */
export function RevealedMessage({ children, ...props }: ComponentProps<typeof FormMessage>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  }, [children]);
  return (
    <FormMessage ref={ref} {...props}>
      {children}
    </FormMessage>
  );
}
