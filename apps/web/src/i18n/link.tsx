"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";
import { useLocale } from "./client";
import { localizePath } from "./path";

type LinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & { href: string };

/**
 * <Link> que respeta el idioma actual: href="/login" va a "/login" en español y a "/en/login" en inglés.
 * Los links externos (http…, mailto:, #ancla) pasan sin tocar.
 */
export function Link({ href, ...props }: LinkProps) {
  const locale = useLocale();
  const isInternal = href.startsWith("/") && !href.startsWith("//");
  return <NextLink href={isInternal ? localizePath(locale, href) : href} {...props} />;
}
