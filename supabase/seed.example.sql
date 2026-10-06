-- Team + coach setup (no invite UI in Phase 1).
-- 1. Create both coaches in Dashboard > Authentication > Users > Add user (auto-confirm).
-- 2. Copy to seed.local.sql (gitignored), fill in, run in the SQL editor (or via MCP).
with team as (
  insert into public.teams (name) values ('<Team name>') returning id
)
insert into public.team_members (team_id, user_id)
select team.id, u.id
from team, auth.users u
where u.email in ('<coach1@example.com>', '<coach2@example.com>');
