"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslations } from "@/i18n/client";

/** Pestañas Juegos / Avances del perfil. Los paneles llegan ya renderizados desde el servidor. */
export function ProfileTabs({ gamesPanel, postsPanel }: { gamesPanel: ReactNode; postsPanel: ReactNode }) {
  const t = useTranslations("profile");
  return (
    <Tabs defaultValue="games">
      <TabsList aria-label={t("tabs.label")}>
        <TabsTrigger value="games">{t("tabs.games")}</TabsTrigger>
        <TabsTrigger value="posts">{t("tabs.posts")}</TabsTrigger>
      </TabsList>
      <TabsContent value="games">{gamesPanel}</TabsContent>
      <TabsContent value="posts">{postsPanel}</TabsContent>
    </Tabs>
  );
}
