-- ---------------------------------------------------------------------
-- Administração (v5): configurações do sistema editáveis sem mexer no código.
-- O administrador NÃO enxerga pacientes, relatórios nem transcrições (LGPD).
-- A permissão só é concedida por SQL (veja o final deste arquivo).
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists disabled boolean not null default false;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin and not disabled from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- conta desativada perde o acesso a tudo que é de profissional
create or replace function public.is_professional()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'professional' and not disabled);
$$;

-- ninguém promove a si mesmo: is_admin só muda pelo SQL Editor; disabled só pelo admin
create or replace function public.guard_profile_flags()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if new.is_admin is distinct from old.is_admin then
      raise exception 'row-level security: is_admin só pode ser alterado pelo SQL Editor';
    end if;
    if new.disabled is distinct from old.disabled and not public.is_admin() then
      raise exception 'row-level security: disabled só pode ser alterado pelo administrador';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_flags on public.profiles;
create trigger profiles_guard_flags before update on public.profiles
  for each row execute function public.guard_profile_flags();

-- configurações globais (textos padrão, modelos de IA, aviso, ajuda). Nada secreto aqui.
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to anon, authenticated using (true);
drop policy if exists settings_admin_write on public.app_settings;
create policy settings_admin_write on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
grant select on public.app_settings to anon, authenticated;

-- administrador edita os modelos do sistema (professional_id nulo), nunca os dos profissionais
drop policy if exists templates_admin_system on public.templates;
create policy templates_admin_system on public.templates for all to authenticated
  using (public.is_admin() and professional_id is null)
  with check (public.is_admin() and professional_id is null);

-- lista de profissionais: só dados de cadastro, sem nada clínico
create or replace function public.admin_list_professionals()
returns table (id uuid, full_name text, email text, specialty text, created_at timestamptz, disabled boolean, is_admin boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'row-level security: acesso negado'; end if;
  return query
    select p.id, p.full_name, u.email::text, p.specialty, p.created_at, p.disabled, p.is_admin
    from public.profiles p join auth.users u on u.id = p.id
    where p.role = 'professional' order by p.created_at desc;
end $$;
revoke all on function public.admin_list_professionals() from public, anon;
grant execute on function public.admin_list_professionals() to authenticated;

create or replace function public.admin_set_disabled(uid uuid, off boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'row-level security: acesso negado'; end if;
  if uid = auth.uid() then raise exception 'Você não pode desativar a própria conta.'; end if;
  update public.profiles set disabled = off where id = uid and role = 'professional';
end $$;
revoke all on function public.admin_set_disabled(uuid, boolean) from public, anon;
grant execute on function public.admin_set_disabled(uuid, boolean) to authenticated;

-- Para dar o acesso (rode no SQL Editor, trocando o e-mail):
--   update public.profiles set is_admin = true where id = (select id from auth.users where email = 'SEU@EMAIL');
