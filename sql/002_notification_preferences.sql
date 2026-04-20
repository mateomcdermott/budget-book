-- notification_preferences: stores per-user email notification settings
create table public.notification_preferences (
  user_id             uuid        primary key references auth.users(id) on delete cascade,
  email_notifications boolean     not null default true,
  automated_reminders boolean     not null default true,
  updated_at          timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- Users can only read and write their own row
create policy "Users manage own notification preferences"
  on public.notification_preferences
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
