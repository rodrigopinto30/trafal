"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import { localizePath } from "@/i18n/path";
import { exploreHref, parseExploreQuery } from "@/lib/validation/explore";

type Props = { label: string; action: string; children: ReactNode };

/**
 * The form of the explore filters. It is a normal GET form (it has an address and fields), but when it is sent it builds the
 * address from the checked values instead of the raw fields, so a link never carries empty or default parameters
 * («/explore?genre=arcade», not «/explore?genre=arcade&engine=&sort=recent») and any change starts again from the first page.
 */
export function ExploreForm({ label, action, children }: Props) {
  const router = useRouter();
  const locale = useLocale();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : undefined;
    };
    const query = parseExploreQuery({ q: text("q"), genre: text("genre"), engine: text("engine"), mobile: text("mobile"), sort: text("sort") });
    router.push(localizePath(locale, exploreHref(query)));
  }

  return (
    <form role="search" aria-label={label} action={action} method="get" onSubmit={onSubmit} className="grid gap-4 rounded-3xl border border-white/8 bg-card p-5 sm:p-6">
      {children}
    </form>
  );
}
