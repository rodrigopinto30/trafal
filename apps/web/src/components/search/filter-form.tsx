"use client";

import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import { localizePath } from "@/i18n/path";
import { creatorsHref, parseCreatorsQuery } from "@/lib/validation/creators";
import { exploreHref, parseExploreQuery } from "@/lib/validation/explore";

type Props = { kind: "explore" | "creators"; label: string; action: string; children: ReactNode };

/**
 * The form of the filters of the explore and creators pages. It is a normal GET form (it has an address and fields), but when it is sent it builds the
 * address from the checked values instead of the raw fields, so a link never carries empty or default parameters
 * («/?genre=arcade», not «/?genre=arcade&engine=&sort=recent») and any change starts again from the first page.
 */
export function FilterForm({ kind, label, action, children }: Props) {
  const router = useRouter();
  const locale = useLocale();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : undefined;
    };
    const raw = { q: text("q"), genre: text("genre"), engine: text("engine"), sort: text("sort") };
    const href = kind === "creators" ? creatorsHref(parseCreatorsQuery(raw)) : exploreHref(parseExploreQuery({ ...raw, mobile: text("mobile") }));
    router.push(localizePath(locale, href));
  }

  return (
    <form role="search" aria-label={label} action={action} method="get" onSubmit={onSubmit} className="grid gap-4 rounded-3xl border border-white/8 bg-card p-5 sm:p-6">
      {children}
    </form>
  );
}
