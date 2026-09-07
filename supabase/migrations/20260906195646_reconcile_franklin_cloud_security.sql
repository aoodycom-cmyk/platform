alter table public.franklin_user_state enable row level security;
alter table public.franklin_audit_sessions enable row level security;

drop policy if exists franklin_state_owner_select on public.franklin_user_state;
drop policy if exists franklin_state_owner_insert on public.franklin_user_state;
drop policy if exists franklin_state_owner_update on public.franklin_user_state;
drop policy if exists franklin_audit_owner_all on public.franklin_audit_sessions;

drop policy if exists franklin_user_state_select_own on public.franklin_user_state;
drop policy if exists franklin_user_state_insert_own on public.franklin_user_state;
drop policy if exists franklin_user_state_update_own on public.franklin_user_state;
drop policy if exists franklin_user_state_delete_own on public.franklin_user_state;
create policy franklin_user_state_select_own on public.franklin_user_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy franklin_user_state_insert_own on public.franklin_user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy franklin_user_state_update_own on public.franklin_user_state
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy franklin_user_state_delete_own on public.franklin_user_state
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists franklin_audit_sessions_select_own on public.franklin_audit_sessions;
drop policy if exists franklin_audit_sessions_insert_own on public.franklin_audit_sessions;
drop policy if exists franklin_audit_sessions_update_own on public.franklin_audit_sessions;
drop policy if exists franklin_audit_sessions_delete_own on public.franklin_audit_sessions;
create policy franklin_audit_sessions_select_own on public.franklin_audit_sessions
  for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy franklin_audit_sessions_insert_own on public.franklin_audit_sessions
  for insert to authenticated with check ((select auth.uid()) = owner_user_id);
create policy franklin_audit_sessions_update_own on public.franklin_audit_sessions
  for update to authenticated using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);
create policy franklin_audit_sessions_delete_own on public.franklin_audit_sessions
  for delete to authenticated using ((select auth.uid()) = owner_user_id);

create or replace function public.franklin_save_state(
  p_expected_revision bigint,
  p_state jsonb,
  p_device_id text default null
)
returns table(revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if jsonb_typeof(p_state) <> 'object' then
    raise exception 'STATE_MUST_BE_OBJECT' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    insert into public.franklin_user_state(user_id, state, revision, device_id)
    values (v_user_id, p_state, 1, p_device_id)
    on conflict (user_id) do nothing
    returning franklin_user_state.revision, franklin_user_state.updated_at
      into revision, updated_at;
    if revision is null then
      raise exception 'REVISION_CONFLICT' using errcode = '40001';
    end if;
    return next;
    return;
  end if;

  update public.franklin_user_state
     set state = p_state,
         revision = franklin_user_state.revision + 1,
         device_id = p_device_id,
         updated_at = now()
   where user_id = v_user_id
     and franklin_user_state.revision = p_expected_revision
  returning franklin_user_state.revision, franklin_user_state.updated_at
    into revision, updated_at;
  if revision is null then
    raise exception 'REVISION_CONFLICT' using errcode = '40001';
  end if;
  return next;
end;
$$;

revoke all on public.franklin_user_state from public, anon, authenticated;
grant select, insert, update, delete on public.franklin_user_state to authenticated;
revoke all on public.franklin_audit_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.franklin_audit_sessions to authenticated;
revoke all on function public.franklin_save_state(bigint, jsonb, text) from public, anon;
grant execute on function public.franklin_save_state(bigint, jsonb, text) to authenticated;
