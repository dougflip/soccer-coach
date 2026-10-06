-- Initial schema: teams, membership, roster, games, append-only game events.
-- Security model: every row belongs to a team; only team members (authenticated)
-- can read/write it. Team + membership rows are created by a seed script (no UI).

-- Exposure is opt-in: don't auto-grant new public objects to API roles.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role, public;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

-- Helpers live in `private`, which the Data API doesn't expose.
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'coach' check (role in ('coach')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_id_idx on public.team_members (user_id);

-- Mutable reference rows: last-write-wins on server-set updated_at.
-- IDs are generated on the client (offline creates).
create table public.players (
  id uuid primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  first_name text not null check (length(first_name) between 1 and 40),
  last_initials text not null default '' check (length(last_initials) <= 10),
  archived_at timestamptz,
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index players_team_updated_idx on public.players (team_id, updated_at);

create table public.games (
  id uuid primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  opponent text not null check (length(opponent) between 1 and 80),
  starts_at timestamptz not null,
  location text check (length(location) <= 120),
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);
create index games_team_updated_idx on public.games (team_id, updated_at);

-- Append-only, immutable. Payload is validated by the client's zod schema
-- (src/domain/events.ts); the DB doesn't interpret event types.
create table public.game_events (
  id uuid primary key,
  team_id uuid not null references public.teams (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  type text not null,
  payload jsonb not null,
  created_at bigint not null,            -- client epoch ms (tie-breaker only)
  created_by uuid not null default auth.uid() references auth.users (id),
  inserted_at timestamptz not null default now()  -- server; pull cursor
);
create index game_events_team_inserted_idx on public.game_events (team_id, inserted_at);
create index game_events_game_idx on public.game_events (game_id);

-- ---------------------------------------------------------------------------
-- updated_at is always server time, so device clocks can't affect LWW/cursors
-- ---------------------------------------------------------------------------

create function private.set_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger players_set_updated_at before insert or update on public.players
  for each row execute function private.set_updated_at();
create trigger games_set_updated_at before insert or update on public.games
  for each row execute function private.set_updated_at();

-- A row can't be moved to another team.
create function private.prevent_team_change() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.team_id <> old.team_id then
    raise exception 'team_id cannot change';
  end if;
  return new;
end;
$$;

create trigger players_prevent_team_change before update on public.players
  for each row execute function private.prevent_team_change();
create trigger games_prevent_team_change before update on public.games
  for each row execute function private.prevent_team_change();

-- ---------------------------------------------------------------------------
-- Access helpers (private schema: not exposed through the Data API)
-- ---------------------------------------------------------------------------

grant usage on schema private to authenticated;

-- Team IDs the current user belongs to. Security definer so policies on
-- team_members don't recurse.
create function private.my_team_ids() returns setof uuid
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select team_id from public.team_members where user_id = (select auth.uid());
$$;
revoke execute on function private.my_team_ids() from public;
grant execute on function private.my_team_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Grants (what each role can reach) + RLS (which rows)
-- ---------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_events enable row level security;

grant select on public.teams, public.team_members to authenticated;
grant select, insert, update on public.players, public.games to authenticated;
grant select, insert on public.game_events to authenticated;  -- immutable: no update/delete
grant all on public.teams, public.team_members, public.players, public.games, public.game_events
  to service_role;

create policy "members read their teams" on public.teams
  for select to authenticated
  using (id in (select private.my_team_ids()));

create policy "members read their teammates" on public.team_members
  for select to authenticated
  using (team_id in (select private.my_team_ids()));

create policy "members read players" on public.players
  for select to authenticated
  using (team_id in (select private.my_team_ids()));
create policy "members add players" on public.players
  for insert to authenticated
  with check (team_id in (select private.my_team_ids()));
create policy "members edit players" on public.players
  for update to authenticated
  using (team_id in (select private.my_team_ids()))
  with check (team_id in (select private.my_team_ids()));

create policy "members read games" on public.games
  for select to authenticated
  using (team_id in (select private.my_team_ids()));
create policy "members add games" on public.games
  for insert to authenticated
  with check (team_id in (select private.my_team_ids()));
create policy "members edit games" on public.games
  for update to authenticated
  using (team_id in (select private.my_team_ids()))
  with check (team_id in (select private.my_team_ids()));

create policy "members read events" on public.game_events
  for select to authenticated
  using (team_id in (select private.my_team_ids()));
create policy "members append events" on public.game_events
  for insert to authenticated
  with check (
    team_id in (select private.my_team_ids())
    and created_by = (select auth.uid())
    -- event's game must belong to the same team
    and exists (select 1 from public.games g where g.id = game_id and g.team_id = game_events.team_id)
  );
