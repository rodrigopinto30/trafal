-- ---------------------------------------------------------------------------------------------
-- Notifications: «seen» is not «read».
--
-- Opening the bell's menu shows the latest notifications, so the number on the bell goes away (they were seen), but each one stays
-- highlighted in the notifications screen until the person opens it or marks it as read. `seen_at` is what the bell counts;
-- `read_at` is what the screen highlights. Reading a notification also sees it, so a read notification never counts on the bell.
-- ---------------------------------------------------------------------------------------------

alter table public.notifications add column seen_at timestamptz;

update public.notifications set seen_at = read_at where read_at is not null;

create index notifications_unseen_idx on public.notifications (user_id) where seen_at is null and read_at is null;

grant update (seen_at) on public.notifications to authenticated;
