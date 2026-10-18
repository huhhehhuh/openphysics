-- Run this once in the Supabase SQL Editor after the initial schema.
-- Teams may delete only their own journals because the RLS policy checks team_id.

begin;

grant delete on public.journals to authenticated;

create policy journals_team_delete on public.journals
for delete to authenticated
using (team_id = (select private.current_team_id()));

commit;
