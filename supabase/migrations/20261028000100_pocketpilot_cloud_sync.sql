-- PocketPilot v3.0.0: authenticated cloud sync with per-user isolation.
-- Safe to apply to a dedicated Supabase project. This migration does not delete app data.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object'),
  expenses jsonb not null default '[]'::jsonb
    check (jsonb_typeof(expenses) = 'array' and jsonb_array_length(expenses) <= 10000),
  goals jsonb not null default '[]'::jsonb
    check (jsonb_typeof(goals) = 'array' and jsonb_array_length(goals) <= 1000),
  schema_version integer not null default 1 check (schema_version = 1),
  revision bigint not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now()
);

create index if not exists user_state_updated_at_idx on public.user_state (updated_at);

alter table public.profiles enable row level security;
alter table public.user_state enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
revoke all on table public.user_state from public, anon, authenticated;
grant select on table public.user_state to authenticated;

drop policy if exists "Profiles are readable by their owner" on public.profiles;
create policy "Profiles are readable by their owner"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can read their own state" on public.user_state;
create policy "Users can read their own state"
  on public.user_state for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own state" on public.user_state;
create policy "Users can insert their own state"
  on public.user_state for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own state" on public.user_state;
create policy "Users can update their own state"
  on public.user_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own state" on public.user_state;
create policy "Users can delete their own state"
  on public.user_state for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.handle_pocketpilot_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, updated_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    now()
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

revoke all on function public.handle_pocketpilot_user() from public, anon, authenticated;

drop trigger if exists on_pocketpilot_auth_user_changed on auth.users;
create trigger on_pocketpilot_auth_user_changed
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_pocketpilot_user();

create or replace function public.save_pocketpilot_state(
  p_settings jsonb,
  p_expenses jsonb,
  p_goals jsonb,
  p_expected_revision bigint
)
returns table (revision bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $
declare
  v_user_id uuid := auth.uid();
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if jsonb_typeof(p_settings) is distinct from 'object'
     or jsonb_typeof(p_expenses) is distinct from 'array'
     or jsonb_typeof(p_goals) is distinct from 'array' then
    raise exception 'Invalid PocketPilot state shape' using errcode = '22023';
  end if;

  if jsonb_array_length(p_expenses) > 10000
     or jsonb_array_length(p_goals) > 1000
     or octet_length(p_settings::text) > 100000
     or octet_length(p_expenses::text) > 2000000
     or octet_length(p_goals::text) > 1000000 then
    raise exception 'PocketPilot state is too large' using errcode = '22023';
  end if;

  if jsonb_typeof(p_settings -> 'allowance') is distinct from 'number'
     or jsonb_typeof(p_settings -> 'savingsGoal') is distinct from 'number'
     or jsonb_typeof(p_settings -> 'collegeBudget') is distinct from 'number'
     or jsonb_typeof(p_settings -> 'printoutBudget') is distinct from 'number'
     or jsonb_typeof(p_settings -> 'foodBudget') is distinct from 'number'
     or jsonb_typeof(p_settings -> 'emergencyBudget') is distinct from 'number' then
    raise exception 'Invalid settings values' using errcode = '22023';
  end if;

  if (p_settings ->> 'allowance')::numeric < 0
     or (p_settings ->> 'savingsGoal')::numeric < 0
     or (p_settings ->> 'collegeBudget')::numeric < 0
     or (p_settings ->> 'printoutBudget')::numeric < 0
     or (p_settings ->> 'foodBudget')::numeric < 0
     or (p_settings ->> 'emergencyBudget')::numeric < 0 then
    raise exception 'Negative settings values are not allowed' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_expenses) as item(value)
     where jsonb_typeof(item.value) is distinct from 'object'
        or jsonb_typeof(item.value -> 'name') is distinct from 'string'
        or length(trim(item.value ->> 'name')) = 0
        or jsonb_typeof(item.value -> 'amount') is distinct from 'number'
        or (item.value ->> 'amount')::numeric <= 0
        or coalesce(item.value ->> 'category', '') not in ('Food', 'College', 'Printouts', 'Transport', 'Shopping', 'Emergency', 'Other')
        or coalesce(item.value ->> 'type', '') not in ('Need', 'Craving')
        or coalesce(item.value ->> 'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}

  update public.user_state as s
     set settings = p_settings,
         expenses = p_expenses,
         goals = p_goals,
         revision = s.revision + 1,
         updated_at = now()
   where s.user_id = v_user_id
     and s.revision = p_expected_revision
  returning s.revision, s.updated_at into v_revision, v_updated_at;

  if found then
    return query select v_revision, v_updated_at;
    return;
  end if;

  if p_expected_revision = 0 then
    insert into public.user_state (user_id, settings, expenses, goals, schema_version, revision, updated_at)
    values (v_user_id, p_settings, p_expenses, p_goals, 1, 1, now())
    on conflict (user_id) do nothing
    returning user_state.revision, user_state.updated_at into v_revision, v_updated_at;

    if found then
      return query select v_revision, v_updated_at;
      return;
    end if;
  end if;

  raise exception 'PocketPilot cloud state changed elsewhere; reload and merge before saving'
    using errcode = '40001';
end;
$$;

revoke all on function public.save_pocketpilot_state(jsonb, jsonb, jsonb, bigint) from public, anon;
grant execute on function public.save_pocketpilot_state(jsonb, jsonb, jsonb, bigint) to authenticated;

-- Backfill profiles for existing Auth users without changing their credentials.
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data ->> 'display_name', '')
from auth.users
on conflict (id) do nothing;

  ) then
    raise exception 'Invalid expense record' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_goals) as item(value)
     where jsonb_typeof(item.value) is distinct from 'object'
        or jsonb_typeof(item.value -> 'name') is distinct from 'string'
        or length(trim(item.value ->> 'name')) = 0
        or jsonb_typeof(item.value -> 'target') is distinct from 'number'
        or (item.value ->> 'target')::numeric <= 0
        or (item.value ? 'contributions' and jsonb_typeof(item.value -> 'contributions') is distinct from 'array')
  ) then
    raise exception 'Invalid goal record' using errcode = '22023';
  end if;

  update public.user_state as s
     set settings = p_settings,
         expenses = p_expenses,
         goals = p_goals,
         revision = s.revision + 1,
         updated_at = now()
   where s.user_id = v_user_id
     and s.revision = p_expected_revision
  returning s.revision, s.updated_at into v_revision, v_updated_at;

  if found then
    return query select v_revision, v_updated_at;
    return;
  end if;

  if p_expected_revision = 0 then
    insert into public.user_state (user_id, settings, expenses, goals, schema_version, revision, updated_at)
    values (v_user_id, p_settings, p_expenses, p_goals, 1, 1, now())
    on conflict (user_id) do nothing
    returning user_state.revision, user_state.updated_at into v_revision, v_updated_at;

    if found then
      return query select v_revision, v_updated_at;
      return;
    end if;
  end if;

  raise exception 'PocketPilot cloud state changed elsewhere; reload and merge before saving'
    using errcode = '40001';
end;
$$;

revoke all on function public.save_pocketpilot_state(jsonb, jsonb, jsonb, bigint) from public, anon;
grant execute on function public.save_pocketpilot_state(jsonb, jsonb, jsonb, bigint) to authenticated;

-- Backfill profiles for existing Auth users without changing their credentials.
insert into public.profiles (id, email, display_name)
select id, email, coalesce(raw_user_meta_data ->> 'display_name', '')
from auth.users
on conflict (id) do nothing;
