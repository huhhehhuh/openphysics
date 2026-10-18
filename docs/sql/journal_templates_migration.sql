-- Run this once in the Supabase SQL Editor after the initial schema.
-- It keeps the original journals.content column so existing records are preserved.

begin;

alter table public.journals
  add column if not exists template_type text not null default 'basic',
  add column if not exists form_data jsonb not null default '{}'::jsonb;

alter table public.journals
  drop constraint if exists journals_template_type_check;

alter table public.journals
  add constraint journals_template_type_check
  check (template_type in ('basic', 'advanced', 'cumulative'));

grant insert (team_id, op_day_id, content, template_type, form_data) on public.journals to authenticated;
grant update (template_type, form_data) on public.journals to authenticated;

commit;
