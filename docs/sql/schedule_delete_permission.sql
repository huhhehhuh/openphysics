-- 교사가 OP 일정을 삭제할 수 있도록 권한과 RLS 정책을 추가합니다.
begin;

grant delete on public.op_days to authenticated;

drop policy if exists op_days_teacher_delete on public.op_days;
create policy op_days_teacher_delete on public.op_days
for delete to authenticated
using ((select private.is_teacher()));

commit;
