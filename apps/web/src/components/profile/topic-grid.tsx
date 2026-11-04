"use client";

import { useState } from "react";
import { GenreIcon } from "@/components/profile/genre-icon";
import { TopicTile } from "@/components/ui/topic-tile";
import { useTranslations } from "@/i18n/client";
import { GENRE_IDS } from "@/lib/profile/catalog";

/**
 * Grilla de géneros de juegos que le gustan a la persona: tocar uno lo elige, tocarlo de nuevo lo saca.
 * Cada baldosa es una casilla real con name="favoriteGenres", así que el formulario envía los elegidos tal cual.
 */
export function TopicGrid({ initial }: { initial: string[] }) {
  const t = useTranslations("settings");
  const tGenres = useTranslations("genres");
  const [selected, setSelected] = useState<string[]>(initial);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  return (
    <div className="grid gap-3">
      <ul className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {GENRE_IDS.map((id) => (
          <li key={id} className="flex">
            <TopicTile
              name="favoriteGenres"
              value={id}
              checked={selected.includes(id)}
              onChange={() => toggle(id)}
              icon={<GenreIcon id={id} />}
              label={tGenres(id as Parameters<typeof tGenres>[0])}
              className="w-full"
            />
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="text-xs text-text-3">
        {t("profile.genresCount", { count: selected.length })}
      </p>
    </div>
  );
}
