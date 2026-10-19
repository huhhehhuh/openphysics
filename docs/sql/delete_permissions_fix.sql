-- Run this once in the Supabase SQL Editor to repair journal/PDF deletion permissions.
-- Teams can delete only their own journals and uploaded PDFs.
-- Teachers can delete journals and PDFs from every team.

begin;

grant delete on public.journals to authenticated;
grant insert (team_id, journal_date, file_path, file_name, content) on public.journals to authenticated;
grant update (team_id, journal_date, file_path, file_name, content) on public.journals to authenticated;

drop policy if exists journals_team_delete on public.journals;
drop policy if exists journals_delete on public.journals;
create policy journals_delete on public.journals
for delete to authenticated
using (
  team_id = (select private.current_team_id())
  or (select private.is_teacher())
);

drop policy if exists experiment_journals_team_delete on storage.objects;
create policy experiment_journals_team_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'experiment-journals'
  and (
    (select private.is_teacher())
    or (storage.foldername(name))[1] = (select private.current_team_id())::text
  )
);

commit;
