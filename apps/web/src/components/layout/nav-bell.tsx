import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { getAuthUser, getMyProfile } from "@/lib/auth/dal";
import { countUnseenNotifications } from "@/lib/notifications/queries";

/** The notifications bell of the bar, only for people with an account and a profile. It reads the session: it goes inside a <Suspense>. */
export async function NavBell() {
  const [user, profile] = await Promise.all([getAuthUser(), getMyProfile()]);
  if (!user || !profile) return null;
  return <NotificationsBell userId={user.id} unread={await countUnseenNotifications()} />;
}
