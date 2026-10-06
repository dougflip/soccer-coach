-- Follow-up from security/performance advisors on initial_schema.

-- 1. Default privileges had also granted REFERENCES/TRIGGER/TRUNCATE. Reset to exactly what's needed.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

revoke all on public.teams, public.team_members, public.players, public.games, public.game_events
  from anon, authenticated;
grant select on public.teams, public.team_members to authenticated;
grant select, insert, update on public.players, public.games to authenticated;
grant select, insert on public.game_events to authenticated;

-- 2. Supabase's auto-RLS event-trigger helper shouldn't be callable via /rpc.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 3. Cover the created_by foreign key.
create index game_events_created_by_idx on public.game_events (created_by);
