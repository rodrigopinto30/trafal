"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "@/i18n/client";
import { Link } from "@/i18n/link";
import { localizePath } from "@/i18n/path";
import { toggleFollowAction } from "@/lib/profile/actions";

type Props = {
  targetId: string;
  username: string;
  initialFollowing: boolean;
  signedIn: boolean;
  /** Refresh the page after changing (so the counters of a profile update). Lists turn it off: the person stays in place and can be followed again. */
  refreshAfter?: boolean;
};

/** Botón Seguir / Siguiendo. Responde al instante (optimista) y confirma con el servidor. */
export function FollowButton({ targetId, username, initialFollowing, signedIn, refreshAfter = true }: Props) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [optimistic, setOptimistic] = useOptimistic(following);
  const [, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Button asChild variant="secondary" size="lg">
        <Link href={`/login?next=${encodeURIComponent(`/u/${username}`)}`} title={t("loginToFollow")}>
          <PlusIcon aria-hidden="true" />
          {t("follow")}
        </Link>
      </Button>
    );
  }

  const label = optimistic ? t("following") : t("follow");
  const action = optimistic ? t("unfollowAction", { username }) : t("followAction", { username });

  return (
    <Button
      type="button"
      size="lg"
      variant={optimistic ? "outline" : "secondary"}
      aria-pressed={optimistic}
      aria-label={action}
      onClick={() => {
        const target = !optimistic;
        startTransition(async () => {
          setOptimistic(target);
          const result = await toggleFollowAction({ targetId, follow: target });
          if (result.ok) {
            setFollowing(result.following);
            if (refreshAfter) router.refresh(); // actualiza los contadores de seguidores
          } else if (result.reason === "unauthenticated") {
            router.push(localizePath(locale, `/login?next=${encodeURIComponent(`/u/${username}`)}`));
          } else if (result.reason === "rateLimited") {
            toast.error(t("rateLimited"));
          }
          // En cualquier otro error, `following` no cambió y el botón vuelve a su estado anterior.
        });
      }}
    >
      {optimistic ? <CheckIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
      {label}
    </Button>
  );
}
