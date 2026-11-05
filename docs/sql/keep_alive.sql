-- Supabase Free 플랜의 비활성 일시중지 예방용 최소 RPC입니다.
-- SQL Editor에서 한 번만 실행하세요.
-- 이 함수는 데이터를 읽거나 수정하지 않고 DB 요청만 처리합니다.

create or replace function public.keep_alive()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object('ok', true, 'checked_at', now());
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;
