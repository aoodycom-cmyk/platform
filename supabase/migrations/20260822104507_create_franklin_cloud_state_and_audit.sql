create extension if not exists pgcrypto;

create table if not exists public.franklin_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  schema_version text not null default 'franklin-cloud-state/v1',
  revision bigint not null default 1 check (revision > 0),
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.franklin_audit_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  schema_version text not null default 'franklin-audit-snapshot/v1',
  label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  access_count bigint not null default 0,
  constraint franklin_audit_expiry_after_create check (expires_at > created_at)
);

create index if not exists franklin_audit_sessions_owner_created_idx
  on public.franklin_audit_sessions(owner_user_id, created_at desc);
create index if not exists franklin_audit_sessions_expiry_idx
  on public.franklin_audit_sessions(expires_at) where revoked_at is null;

alter table public.franklin_user_state enable row level security;
alter table public.franklin_audit_sessions enable row level security;

create policy franklin_user_state_select_own on public.franklin_user_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy franklin_user_state_insert_own on public.franklin_user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy franklin_user_state_update_own on public.franklin_user_state
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy franklin_user_state_delete_own on public.franklin_user_state
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy franklin_audit_sessions_select_own on public.franklin_audit_sessions
  for select to authenticated using ((select auth.uid()) = owner_user_id);
create policy franklin_audit_sessions_update_own on public.franklin_audit_sessions
  for update to authenticated using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);
create policy franklin_audit_sessions_delete_own on public.franklin_audit_sessions
  for delete to authenticated using ((select auth.uid()) = owner_user_id);

revoke all on public.franklin_user_state from public, anon, authenticated;
grant select, insert, update, delete on public.franklin_user_state to authenticated;
revoke all on public.franklin_audit_sessions from public, anon, authenticated;
grant select, update, delete on public.franklin_audit_sessions to authenticated;
