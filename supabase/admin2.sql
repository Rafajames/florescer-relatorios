-- v5.1: registro de ações do admin, convites, números de uso e reset do autenticador (MFA)
create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid default auth.uid(),
  action text not null, target text, old_value jsonb, new_value jsonb
);
alter table public.admin_log enable row level security;
drop policy if exists admin_log_all on public.admin_log;
create policy admin_log_all on public.admin_log for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.invites (
  code text primary key, note text, created_at timestamptz not null default now(),
  active boolean not null default true, used_by uuid, used_at timestamptz
);
alter table public.invites enable row level security;
drop policy if exists invites_admin on public.invites;
create policy invites_admin on public.invites for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- cadastro de profissional exige convite quando a opção "invite_required" estiver ligada
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'professional');
  v_code text;
begin
  if v_role not in ('professional','patient') then v_role := 'professional'; end if;
  if v_role = 'professional' and coalesce((select value = 'true'::jsonb from public.app_settings where key = 'invite_required'), false) then
    v_code := upper(trim(coalesce(new.raw_user_meta_data->>'invite_code', '')));
    update public.invites set active = false, used_by = new.id, used_at = now()
      where code = v_code and active and used_by is null;
    if not found then raise exception 'Código de convite inválido ou já usado.'; end if;
  end if;
  insert into public.profiles (id, role, full_name, specialty, council_registry)
  values (new.id, v_role, coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'specialty', ''), nullif(new.raw_user_meta_data->>'council_registry', ''))
  on conflict (id) do nothing;
  return new;
end $$;

-- totais (sem nenhum conteúdo clínico)
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'row-level security: acesso negado'; end if;
  return jsonb_build_object(
    'professionals', (select count(*) from public.profiles where role = 'professional'),
    'patient_accounts', (select count(*) from public.profiles where role = 'patient'),
    'new_professionals_30d', (select count(*) from public.profiles where role = 'professional' and created_at > now() - interval '30 days'),
    'patients', (select count(*) from public.patients),
    'reports', (select count(*) from public.reports),
    'reports_7d', (select count(*) from public.reports where created_at > now() - interval '7 days'),
    'released', (select count(*) from public.reports where released_to_patient),
    'with_mfa', (select count(distinct user_id) from auth.mfa_factors where status = 'verified'));
end $$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- admin remove o autenticador de alguém que não consegue entrar
create or replace function public.admin_reset_mfa(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'row-level security: acesso negado'; end if;
  delete from auth.mfa_factors where user_id = uid;
end $$;
revoke all on function public.admin_reset_mfa(uuid) from public, anon;
grant execute on function public.admin_reset_mfa(uuid) to authenticated;

-- a própria pessoa remove o autenticador, mas só depois de entrar por link enviado ao e-mail (prova que a caixa é dela)
create or replace function public.mfa_self_reset() returns void
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if auth.uid() is null then raise exception 'row-level security: acesso negado'; end if;
  select exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) e
    where e->>'method' in ('otp','recovery','magiclink')
      and (e->>'timestamp')::bigint > extract(epoch from now()) - 1800) into ok;
  if not ok then raise exception 'row-level security: confirme pelo link enviado ao seu e-mail'; end if;
  delete from auth.mfa_factors where user_id = auth.uid();
end $$;
revoke all on function public.mfa_self_reset() from public, anon;
grant execute on function public.mfa_self_reset() to authenticated;
