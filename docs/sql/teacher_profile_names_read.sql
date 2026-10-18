-- Run this once in the Supabase SQL Editor.
-- Authenticated teams can read teacher profiles so feedback shows the teacher's display name.

begin;

drop policy if exists profiles_read on public.profiles;

create policy profiles_read on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_teacher())
  or role = 'teacher'
);

commit;
