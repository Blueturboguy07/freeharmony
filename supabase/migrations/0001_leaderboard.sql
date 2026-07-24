-- Leaderboard: the only server-side feature in FreeHarmony.
-- Stores scores and nicknames ONLY — never photos, never landmarks.
-- Submissions are anonymous, insert-only for the anon role; reads go through
-- owner views so the table itself is never directly selectable.

create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  overall_score numeric(4, 1) not null,
  area_scores jsonb not null default '{}'::jsonb,
  sex text not null default 'neutral',
  engine_version text not null default '0.1.0',
  week_key text not null,
  created_at timestamptz not null default now(),

  constraint nickname_shape check (nickname ~ '^[A-Za-z0-9_ ]{3,20}$'),
  constraint score_bounds check (overall_score >= 0 and overall_score <= 100),
  constraint sex_values check (sex in ('masculine', 'feminine', 'neutral')),
  constraint week_key_shape check (week_key ~ '^\d{4}-W\d{2}$')
);

alter table public.leaderboard_entries enable row level security;

-- Anonymous users may only INSERT. No select/update/delete policies exist,
-- so the raw table is write-only from the client's perspective.
create policy "anon can submit scores"
  on public.leaderboard_entries
  for insert
  to anon
  with check (true);

-- Coarse abuse brake: cap global insert volume per minute via trigger.
create or replace function public.leaderboard_rate_ok()
returns trigger
language plpgsql
security definer
as $$
declare
  recent_count int;
begin
  select count(*) into recent_count
  from public.leaderboard_entries
  where created_at > now() - interval '1 minute';
  if recent_count >= 120 then
    raise exception 'leaderboard is busy — try again in a minute';
  end if;
  return new;
end;
$$;

create trigger leaderboard_rate_limit
  before insert on public.leaderboard_entries
  for each row execute function public.leaderboard_rate_ok();

-- Read surface: best score per nickname, top 100. Views run as owner and
-- therefore bypass table RLS deliberately — they ARE the public read API.
create or replace view public.leaderboard_all_time as
  select distinct on (nickname)
    nickname, overall_score, area_scores, sex, created_at
  from public.leaderboard_entries
  order by nickname, overall_score desc, created_at asc
  limit 100;

create or replace view public.leaderboard_weekly as
  select distinct on (nickname)
    nickname, overall_score, area_scores, sex, created_at, week_key
  from public.leaderboard_entries
  where week_key = to_char(now(), 'IYYY-"W"IW')
  order by nickname, overall_score desc, created_at asc
  limit 100;

grant select on public.leaderboard_all_time to anon;
grant select on public.leaderboard_weekly to anon;
