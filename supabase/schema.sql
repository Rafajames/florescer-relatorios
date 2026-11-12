-- =====================================================================
-- Florescer Relatórios — esquema do banco (Supabase / PostgreSQL)
-- Cole este arquivo inteiro em: Supabase > SQL Editor > New query > Run
-- Pode ser executado de novo sem erro (idempotente) para atualizar.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Perfis (um por usuário de login: profissional ou paciente)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  role             text not null check (role in ('professional','patient')),
  full_name        text not null default '',
  specialty        text,
  council_registry text,            -- ex.: CRP 20/12345
  clinic_name      text,
  consent_text     text,            -- texto de consentimento personalizado
  preferences      jsonb not null default '{}'::jsonb, -- preferências do profissional (IA, editor)
  created_at       timestamptz not null default now()
);
alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
-- marca própria (logo, cores, nome da clínica, rodapé) e link personalizado
alter table public.profiles add column if not exists branding jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists slug text;
create unique index if not exists profiles_slug_key on public.profiles (lower(slug)) where slug is not null;
alter table public.profiles add column if not exists onboarded boolean not null default false;

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'professional');
begin
  if v_role not in ('professional','patient') then v_role := 'professional'; end if;
  insert into public.profiles (id, role, full_name, specialty, council_registry)
  values (
    new.id, v_role,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'specialty', ''),
    nullif(new.raw_user_meta_data->>'council_registry', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Pacientes (pertencem a UM profissional)
-- ---------------------------------------------------------------------
create table if not exists public.patients (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name            text not null,
  email           text,             -- e-mail usado pelo paciente no portal
  phone           text,
  birth_date      date,
  notes           text,
  archived        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists patients_prof_idx on public.patients (professional_id);
create index if not exists patients_email_idx on public.patients (lower(email));

-- ---------------------------------------------------------------------
-- Consentimentos (LGPD) por paciente
-- ---------------------------------------------------------------------
create table if not exists public.consents (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  patient_id      uuid not null references public.patients(id) on delete cascade,
  consent_text    text not null,
  channel         text not null check (channel in ('presencial','escrito','digital')),
  granted_at      timestamptz not null default now(),
  revoked_at      timestamptz
);
create index if not exists consents_patient_idx on public.consents (patient_id);

-- ---------------------------------------------------------------------
-- Modelos de relatório (professional_id nulo = modelo do sistema)
-- sections: [{ "title": "...", "hint": "orientação para a IA" }]
-- ---------------------------------------------------------------------
create table if not exists public.templates (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid references public.profiles(id) on delete cascade,
  name            text not null,
  specialty       text,
  kind            text not null default 'sessao' check (kind in ('sessao','periodo')),
  sections        jsonb not null,
  created_at      timestamptz not null default now()
);
create index if not exists templates_prof_idx on public.templates (professional_id);
alter table public.templates add column if not exists meta jsonb not null default '{}'::jsonb; -- origem (arquivo importado), observações
-- aceita também o tipo 'anamnese' (recria a restrição de forma idempotente)
alter table public.templates drop constraint if exists templates_kind_check;
alter table public.templates add constraint templates_kind_check check (kind in ('sessao','periodo','anamnese'));

-- ---------------------------------------------------------------------
-- Relatórios (de sessão ou de período)
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id                  uuid primary key default gen_random_uuid(),
  professional_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  patient_id          uuid not null references public.patients(id) on delete cascade,
  template_id         uuid references public.templates(id) on delete set null,
  kind                text not null default 'sessao' check (kind in ('sessao','periodo')),
  title               text not null,
  session_date        date not null default current_date,
  period_start        date,
  period_end          date,
  transcript          text,                       -- registro para auditoria (o áudio NÃO é guardado)
  sections            jsonb not null default '[]', -- [{ "title": "...", "text": "..." }]
  status              text not null default 'rascunho' check (status in ('rascunho','revisado')),
  ai_generated        boolean not null default false,
  released_to_patient boolean not null default false,
  released_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint released_only_if_reviewed check (not released_to_patient or status = 'revisado')
);
create index if not exists reports_prof_idx on public.reports (professional_id, session_date desc);
create index if not exists reports_patient_idx on public.reports (patient_id, session_date desc);
alter table public.reports add column if not exists notes text;  -- anotações do profissional durante a sessão
alter table public.reports drop constraint if exists reports_kind_check;
alter table public.reports add constraint reports_kind_check check (kind in ('sessao','periodo','anamnese','documento'));

-- ---------------------------------------------------------------------
-- Versões do relatório: guarda o texto anterior a cada alteração relevante
-- (no máximo uma versão a cada 5 minutos por relatório)
-- ---------------------------------------------------------------------
create table if not exists public.report_versions (
  id              bigint generated always as identity primary key,
  report_id       uuid not null references public.reports(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  title           text,
  sections        jsonb not null,
  saved_at        timestamptz not null default now()
);
create index if not exists report_versions_idx on public.report_versions (report_id, saved_at desc);

create or replace function public.keep_report_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.sections is distinct from new.sections or old.title is distinct from new.title then
    if not exists (select 1 from public.report_versions v where v.report_id = old.id and v.saved_at > now() - interval '5 minutes') then
      insert into public.report_versions (report_id, professional_id, title, sections) values (old.id, old.professional_id, old.title, old.sections);
      delete from public.report_versions where report_id = old.id and id not in
        (select id from public.report_versions where report_id = old.id order by saved_at desc limit 30);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists reports_versions on public.reports;
create trigger reports_versions before update on public.reports
  for each row execute function public.keep_report_version();

-- ---------------------------------------------------------------------
-- Trilha de auditoria (não guarda conteúdo clínico, só quem fez o quê)
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  user_id    uuid,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_entity_idx on public.audit_log (entity_id, created_at desc);

-- ---------------------------------------------------------------------
-- Gatilhos: updated_at e auditoria
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists patients_touch on public.patients;
create trigger patients_touch before update on public.patients
  for each row execute function public.touch_updated_at();

drop trigger if exists reports_touch on public.reports;
create trigger reports_touch before update on public.reports
  for each row execute function public.touch_updated_at();

create or replace function public.write_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_detail jsonb := '{}'::jsonb;
begin
  if tg_op = 'DELETE' then v_id := old.id; else v_id := new.id; end if;

  if tg_table_name = 'reports' and tg_op <> 'DELETE' then
    v_detail := jsonb_build_object('status', new.status, 'released', new.released_to_patient, 'kind', new.kind);
  elsif tg_table_name = 'consents' and tg_op <> 'DELETE' then
    v_detail := jsonb_build_object('channel', new.channel, 'revoked', new.revoked_at is not null);
  end if;

  insert into public.audit_log (user_id, action, entity, entity_id, detail)
  values (auth.uid(), lower(tg_op), tg_table_name, v_id, v_detail);

  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists reports_audit on public.reports;
create trigger reports_audit after insert or update or delete on public.reports
  for each row execute function public.write_audit();

drop trigger if exists consents_audit on public.consents;
create trigger consents_audit after insert or update or delete on public.consents
  for each row execute function public.write_audit();

drop trigger if exists patients_audit on public.patients;
create trigger patients_audit after insert or update or delete on public.patients
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------
-- Segurança por linha (RLS): cada profissional só enxerga o que é seu
-- ---------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.patients   enable row level security;
alter table public.consents   enable row level security;
alter table public.templates  enable row level security;
alter table public.reports    enable row level security;
alter table public.audit_log  enable row level security;

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Só profissionais mexem em pacientes/consentimentos/relatórios/modelos
create or replace function public.is_professional()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'professional');
$$;

-- patients
drop policy if exists patients_all_own on public.patients;
create policy patients_all_own on public.patients
  for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());

-- consents (o paciente precisa ser do próprio profissional)
drop policy if exists consents_all_own on public.consents;
create policy consents_all_own on public.consents
  for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (
    professional_id = auth.uid() and public.is_professional()
    and exists (select 1 from public.patients p where p.id = patient_id and p.professional_id = auth.uid())
  );

-- templates: lê os do sistema e os próprios; altera só os próprios
drop policy if exists templates_select on public.templates;
create policy templates_select on public.templates
  for select to authenticated
  using (professional_id is null or professional_id = auth.uid());
drop policy if exists templates_write_own on public.templates;
create policy templates_write_own on public.templates
  for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());

-- reports
drop policy if exists reports_all_own on public.reports;
create policy reports_all_own on public.reports
  for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (
    professional_id = auth.uid() and public.is_professional()
    and exists (select 1 from public.patients p where p.id = patient_id and p.professional_id = auth.uid())
  );

-- versões: só o próprio profissional lê (e restaura pelo editor)
alter table public.report_versions enable row level security;
drop policy if exists versions_select_own on public.report_versions;
create policy versions_select_own on public.report_versions
  for select to authenticated using (professional_id = auth.uid());

-- audit_log: cada um lê só o próprio histórico; ninguém escreve direto (só os gatilhos)
drop policy if exists audit_select_own on public.audit_log;
create policy audit_select_own on public.audit_log
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Portal do paciente: função que devolve SOMENTE relatórios revisados e
-- liberados, para o paciente cujo e-mail de login é o e-mail cadastrado.
-- (a transcrição nunca é exposta)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists credentials jsonb;

drop function if exists public.portal_list_reports();
create or replace function public.portal_list_reports()
returns table (
  id uuid, title text, kind text, session_date date,
  period_start date, period_end date, sections jsonb, ai_generated boolean,
  released_at timestamptz, professional_name text, professional_specialty text,
  professional_registry text, clinic_name text, professional_credentials jsonb
)
language sql stable security definer set search_path = public as $$
  select r.id, r.title, r.kind, r.session_date, r.period_start, r.period_end,
         -- só as seções que o profissional deixou visíveis ao paciente
         (select coalesce(jsonb_agg(sec order by ord), '[]'::jsonb)
            from jsonb_array_elements(r.sections) with ordinality as t(sec, ord)
           where coalesce((sec->>'patient_visible')::boolean, true)) as sections,
         r.ai_generated, r.released_at,
         pr.full_name, pr.specialty, pr.council_registry, pr.clinic_name, pr.credentials
  from public.reports r
  join public.patients p  on p.id = r.patient_id
  join public.profiles pr on pr.id = r.professional_id
  where r.released_to_patient
    and r.status = 'revisado'
    and p.email is not null
    and lower(p.email) = lower(auth.jwt() ->> 'email')
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'patient')
  order by coalesce(r.released_at, r.created_at) desc;
$$;

-- Marca pública de um profissional (para a tela de login personalizada).
-- Expõe SOMENTE nome, logo, cores e frase de apresentação — nada de pacientes.
create or replace function public.brand_by_slug(p_slug text)
returns table (org_name text, logo text, color text, accent text, tagline text)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(branding->>'org_name',''), nullif(clinic_name,''), full_name),
         branding->>'logo', branding->>'color', branding->>'accent', branding->>'tagline'
  from public.profiles
  where role = 'professional' and slug is not null and lower(slug) = lower(p_slug)
  limit 1;
$$;
revoke all on function public.brand_by_slug(text) from public;
grant execute on function public.brand_by_slug(text) to anon, authenticated;

revoke all on function public.portal_list_reports() from public, anon;
grant execute on function public.portal_list_reports() to authenticated;
revoke all on function public.is_professional() from public, anon;
grant execute on function public.is_professional() to authenticated;

-- ---------------------------------------------------------------------
-- Modelos do sistema (inseridos só se ainda não existirem)
-- ---------------------------------------------------------------------
do $seed$
begin
if not exists (select 1 from public.templates where professional_id is null) then
insert into public.templates (professional_id, name, specialty, kind, sections) values
(null, 'Evolução clínica', 'Psicologia', 'sessao', '[
  {"title":"Demanda e queixa da sessão","hint":"O que o paciente trouxe e o motivo do atendimento hoje."},
  {"title":"Conteúdos e temas abordados","hint":"Assuntos tratados, relatos relevantes do paciente."},
  {"title":"Intervenções realizadas","hint":"Técnicas e condutas aplicadas pelo profissional."},
  {"title":"Observações clínicas","hint":"Observações sobre humor, comportamento, evolução. Apenas o que consta na transcrição."},
  {"title":"Encaminhamentos e plano","hint":"Combinados, tarefas e foco da próxima sessão."}
]'::jsonb),
(null, 'SOAP (geral)', 'Geral', 'sessao', '[
  {"title":"Subjetivo (S)","hint":"Relato do paciente: queixas, sintomas, percepções."},
  {"title":"Objetivo (O)","hint":"Dados observados/mensurados descritos na sessão."},
  {"title":"Avaliação (A)","hint":"Análise do profissional sobre a situação do paciente."},
  {"title":"Plano (P)","hint":"Condutas, orientações e próximos passos."}
]'::jsonb),
(null, 'Evolução fonoaudiológica', 'Fonoaudiologia', 'sessao', '[
  {"title":"Queixa e contexto","hint":"Relato inicial e intercorrências desde o último atendimento."},
  {"title":"Objetivos terapêuticos da sessão","hint":"Metas trabalhadas."},
  {"title":"Atividades e condutas","hint":"O que foi realizado em sessão."},
  {"title":"Resposta do paciente","hint":"Desempenho, dificuldades e progressos descritos."},
  {"title":"Orientações e plano","hint":"Orientações a paciente/família e próximos passos."}
]'::jsonb),
(null, 'Evolução fisioterapêutica', 'Fisioterapia', 'sessao', '[
  {"title":"Queixa e sintomas relatados","hint":"Dor, limitações e relatos do paciente. Não inventar escalas ou valores."},
  {"title":"Achados da avaliação","hint":"Somente achados descritos na sessão."},
  {"title":"Condutas realizadas","hint":"Técnicas, exercícios e recursos utilizados."},
  {"title":"Resposta ao tratamento","hint":"Reação e evolução descritas."},
  {"title":"Orientações e plano","hint":"Orientações domiciliares e próximos passos."}
]'::jsonb),
(null, 'Evolução nutricional', 'Nutrição', 'sessao', '[
  {"title":"Relato alimentar e queixas","hint":"O que o paciente relatou sobre alimentação e sintomas."},
  {"title":"Evolução desde o último atendimento","hint":"Mudanças relatadas ou observadas."},
  {"title":"Condutas e orientações","hint":"Orientações dadas. Não inventar quantidades."},
  {"title":"Metas e retorno","hint":"Metas combinadas e data/ideia de retorno."}
]'::jsonb),
(null, 'Evolução em terapia ocupacional', 'Terapia Ocupacional', 'sessao', '[
  {"title":"Objetivos da sessão","hint":"Metas trabalhadas."},
  {"title":"Atividades realizadas","hint":"Atividades e recursos utilizados."},
  {"title":"Desempenho observado","hint":"Participação, autonomia e dificuldades descritas."},
  {"title":"Orientações e plano","hint":"Orientações e próximos passos."}
]'::jsonb),
(null, 'Relatório de acompanhamento', 'Geral', 'periodo', '[
  {"title":"Período e identificação do acompanhamento","hint":"Período coberto e número de atendimentos considerados."},
  {"title":"Panorama do acompanhamento","hint":"Visão geral do que foi trabalhado no período."},
  {"title":"Evolução e padrões observados","hint":"Mudanças e temas recorrentes entre as sessões."},
  {"title":"Situação atual","hint":"Estado atual segundo os registros."},
  {"title":"Recomendações e continuidade","hint":"Encaminhamentos e plano. Apenas o que consta nos registros."}
]'::jsonb);
end if;
end
$seed$;

-- ---------------------------------------------------------------------
-- Modelos de anamnese do sistema (idempotente)
-- tipos de campo: curto | longo | data | marcar | escolha
-- ---------------------------------------------------------------------
do $seed2$
begin
if not exists (select 1 from public.templates where professional_id is null and kind = 'anamnese') then
insert into public.templates (professional_id, name, specialty, kind, sections) values
(null, 'Anamnese geral', 'Geral', 'anamnese', '[
  {"title":"Queixa principal","hint":"Motivo da consulta, nas palavras do paciente.","type":"longo"},
  {"title":"História da queixa atual","hint":"Início, evolução, fatores que pioram ou melhoram.","type":"longo"},
  {"title":"Histórico de saúde","hint":"Doenças, cirurgias, internações, alergias.","type":"longo"},
  {"title":"Medicamentos em uso","hint":"Somente os citados pelo paciente.","type":"longo"},
  {"title":"Histórico familiar","hint":"Condições de saúde relevantes na família.","type":"longo"},
  {"title":"Rotina e hábitos","hint":"Sono, alimentação, atividade física, trabalho.","type":"longo"},
  {"title":"Acompanhamentos anteriores","hint":"Tratamentos e profissionais anteriores.","type":"longo"},
  {"title":"Expectativas e objetivos","hint":"O que o paciente espera do acompanhamento.","type":"longo"}
]'::jsonb),
(null, 'Anamnese psicológica', 'Psicologia', 'anamnese', '[
  {"title":"Queixa principal e demanda","hint":"Motivo da busca por atendimento.","type":"longo"},
  {"title":"História da queixa","hint":"Quando começou, como evoluiu, impactos.","type":"longo"},
  {"title":"Histórico de saúde mental e acompanhamentos","hint":"Terapias, psiquiatra, internações.","type":"longo"},
  {"title":"Uso de medicação","hint":"Somente o relatado.","type":"longo"},
  {"title":"Contexto familiar e social","hint":"Convivência, rede de apoio, relações.","type":"longo"},
  {"title":"Trabalho e/ou estudos","hint":"Rotina, dificuldades, satisfação.","type":"longo"},
  {"title":"Sono, alimentação e hábitos","hint":"Rotina diária relatada.","type":"longo"},
  {"title":"Expectativas e objetivos da terapia","hint":"O que deseja trabalhar.","type":"longo"}
]'::jsonb),
(null, 'Anamnese nutricional', 'Nutrição', 'anamnese', '[
  {"title":"Objetivo e queixa principal","hint":"Motivo da consulta.","type":"longo"},
  {"title":"Histórico de saúde e doenças","hint":"Condições relatadas.","type":"longo"},
  {"title":"Medicamentos e suplementos","hint":"Somente os citados.","type":"longo"},
  {"title":"Histórico alimentar e rotina","hint":"Refeições, horários, preferências, restrições.","type":"longo"},
  {"title":"Hidratação e funcionamento intestinal","hint":"Relato do paciente.","type":"longo"},
  {"title":"Atividade física e sono","hint":"Frequência e qualidade relatadas.","type":"longo"},
  {"title":"Histórico familiar","hint":"Condições relevantes.","type":"longo"},
  {"title":"Metas combinadas","hint":"Metas iniciais acordadas.","type":"longo"}
]'::jsonb),
(null, 'Anamnese fonoaudiológica', 'Fonoaudiologia', 'anamnese', '[
  {"title":"Queixa principal","hint":"Motivo do encaminhamento ou busca.","type":"longo"},
  {"title":"História do desenvolvimento","hint":"Marcos relatados de fala, linguagem, audição.","type":"longo"},
  {"title":"Histórico de saúde","hint":"Condições, cirurgias, otites, internações.","type":"longo"},
  {"title":"Alimentação e hábitos orais","hint":"Mastigação, deglutição, chupeta, respiração.","type":"longo"},
  {"title":"Escolaridade e contexto familiar","hint":"Escola, convivência, rede de apoio.","type":"longo"},
  {"title":"Acompanhamentos anteriores","hint":"Terapias e avaliações prévias.","type":"longo"},
  {"title":"Expectativas da família","hint":"O que esperam do atendimento.","type":"longo"}
]'::jsonb),
(null, 'Anamnese fisioterapêutica', 'Fisioterapia', 'anamnese', '[
  {"title":"Queixa principal","hint":"Dor ou limitação principal, nas palavras do paciente.","type":"longo"},
  {"title":"História da lesão ou doença atual","hint":"Início, causa, evolução.","type":"longo"},
  {"title":"Localização e características da dor","hint":"Somente o relatado; não inventar escalas.","type":"longo"},
  {"title":"Histórico de saúde e cirurgias","hint":"Condições e procedimentos.","type":"longo"},
  {"title":"Medicamentos em uso","hint":"Somente os citados.","type":"longo"},
  {"title":"Atividades e rotina de trabalho","hint":"Impactos funcionais relatados.","type":"longo"},
  {"title":"Objetivos do paciente","hint":"O que deseja recuperar ou alcançar.","type":"longo"}
]'::jsonb);
end if;
end
$seed2$;

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

-- v5.2: o administrador não conta como profissional
create or replace function public.admin_list_professionals() returns table (id uuid, full_name text, email text, specialty text, created_at timestamptz, disabled boolean, is_admin boolean) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'row-level security: acesso negado'; end if;
  return query select p.id, p.full_name, u.email::text, p.specialty, p.created_at, p.disabled, p.is_admin from public.profiles p join auth.users u on u.id = p.id where p.role = 'professional' and not p.is_admin order by p.created_at desc;
end $$;

-- ---------------------------------------------------------------------
-- v6: Administrativo (agenda, frequência e dados administrativos do paciente)
-- Separado dos dados clínicos. Cada profissional vê só os próprios registros.
-- ---------------------------------------------------------------------
create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  patient_id      uuid not null references public.patients(id) on delete cascade,
  date            date not null,
  time            time,
  duration_min    int not null default 50 check (duration_min between 5 and 600),
  status          text not null default 'agendado' check (status in ('agendado','realizado','falta','falta_justificada','cancelado')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists appointments_prof_date_idx on public.appointments (professional_id, date);
create index if not exists appointments_patient_idx on public.appointments (patient_id, date);

create table if not exists public.patient_admin (
  patient_id      uuid primary key references public.patients(id) on delete cascade,
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  guardian        text,   -- responsável
  insurer         text,   -- convênio (vazio = particular)
  approach        text,   -- especialidade/abordagem de atendimento
  updated_at      timestamptz not null default now()
);

alter table public.appointments  enable row level security;
alter table public.patient_admin enable row level security;
drop policy if exists appointments_all_own on public.appointments;
create policy appointments_all_own on public.appointments
  for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional()
    and exists (select 1 from public.patients p where p.id = patient_id and p.professional_id = auth.uid()));
drop policy if exists patient_admin_all_own on public.patient_admin;
create policy patient_admin_all_own on public.patient_admin
  for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional()
    and exists (select 1 from public.patients p where p.id = patient_id and p.professional_id = auth.uid()));
grant select, insert, update, delete on public.appointments, public.patient_admin to authenticated;

-- Modelos de terapia ocupacional da profissional Ianara: aplicados como modelos próprios dela (migração v7 e v8).
-- Não ficam no seed público para não aparecer para outras profissionais de TO.

-- ---------------------------------------------------------------------
-- v9: Financeiro (valores, cobranças, despesas) e dados de pagamento
alter table public.patient_admin add column if not exists session_price numeric(10,2);
alter table public.appointments add column if not exists amount numeric(10,2);
alter table public.appointments add column if not exists payment_status text not null default 'pendente'
  check (payment_status in ('pendente','pago'));
alter table public.appointments add column if not exists paid_on date;
alter table public.appointments add column if not exists payment_method text;

create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  date            date not null,
  description     text not null,
  category        text,
  amount          numeric(10,2) not null check (amount >= 0),
  created_at      timestamptz not null default now()
);
create index if not exists expenses_prof_date_idx on public.expenses (professional_id, date);
alter table public.expenses enable row level security;
drop policy if exists expenses_all_own on public.expenses;
create policy expenses_all_own on public.expenses for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());
grant select, insert, update, delete on public.expenses to authenticated;

-- ---------------------------------------------------------------------
-- v10: links públicos com validade (anamnese para o paciente responder,
-- relatório revisado para ler/baixar) e registro de exportações
-- ---------------------------------------------------------------------
create table if not exists public.share_links (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  kind            text not null check (kind in ('anamnese','relatorio')),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  patient_id      uuid not null references public.patients(id) on delete cascade,
  template_id     uuid references public.templates(id) on delete set null,
  report_id       uuid references public.reports(id) on delete cascade,
  password_hash   text,
  expires_at      timestamptz not null,
  responded_at    timestamptz,
  consent_at      timestamptz,
  consent_text    text,
  created_at      timestamptz not null default now(),
  constraint share_relatorio_tem_relatorio check (kind <> 'relatorio' or report_id is not null),
  constraint share_anamnese_tem_modelo check (kind <> 'anamnese' or template_id is not null)
);
create index if not exists share_links_patient_idx on public.share_links (patient_id, created_at desc);
alter table public.share_links enable row level security;
drop policy if exists share_links_own on public.share_links;
create policy share_links_own on public.share_links for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());

-- Leitura pública pelo token: só o necessário para a tela do link.
create or replace function public.public_get_link(p_token text, p_password_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.share_links; p public.profiles; pat public.patients; t public.templates; r public.reports;
begin
  select * into l from public.share_links where token = p_token;
  if not found or l.expires_at < now() then raise exception 'link_invalido'; end if;
  select * into p from public.profiles where id = l.professional_id;
  select * into pat from public.patients where id = l.patient_id;
  if l.kind = 'anamnese' then
    select * into t from public.templates where id = l.template_id;
    if not found then raise exception 'link_invalido'; end if;
    return jsonb_build_object('kind','anamnese','expires_at',l.expires_at,'responded', l.responded_at is not null,
      'patient_name', pat.name, 'professional_name', p.full_name, 'specialty', p.specialty,
      'title', t.name, 'sections', t.sections);
  end if;
  if l.password_hash is not null and (p_password_hash is null or p_password_hash <> l.password_hash) then
    return jsonb_build_object('kind','relatorio','needs_password', true, 'expires_at', l.expires_at);
  end if;
  select * into r from public.reports where id = l.report_id;
  if not found or r.status <> 'revisado' then raise exception 'relatorio_indisponivel'; end if;
  return jsonb_build_object('kind','relatorio','needs_password', false, 'expires_at', l.expires_at,
    'patient_name', pat.name, 'professional_name', p.full_name, 'specialty', p.specialty, 'council_registry', p.council_registry,
    'branding', coalesce(p.branding, '{}'::jsonb) - 'payment' - 'insurers' - 'recibo_seq',
    'report_kind', r.kind, 'title', r.title, 'session_date', r.session_date, 'period_start', r.period_start, 'period_end', r.period_end,
    'sections', (select coalesce(jsonb_agg(s), '[]'::jsonb) from jsonb_array_elements(r.sections) s
                 where coalesce((s->>'patient_visible')::boolean, true)));
end $$;

-- Envio da anamnese pelo paciente: vira um registro em rascunho para o profissional revisar.
create or replace function public.public_submit_anamnese(p_token text, p_answers jsonb, p_consent_text text)
returns void language plpgsql security definer set search_path = public as $$
declare l public.share_links; t public.templates; secs jsonb := '[]'::jsonb; item jsonb; idx int := 0;
begin
  select * into l from public.share_links where token = p_token for update;
  if not found or l.kind <> 'anamnese' or l.expires_at < now() then raise exception 'link_invalido'; end if;
  if l.responded_at is not null then raise exception 'ja_respondido'; end if;
  if coalesce(length(trim(p_consent_text)), 0) = 0 then raise exception 'consentimento_obrigatorio'; end if;
  select * into t from public.templates where id = l.template_id;
  for item in select * from jsonb_array_elements(t.sections) loop
    secs := secs || jsonb_build_array(jsonb_build_object('title', item->>'title',
      'text', left(coalesce(p_answers->>(idx::text), ''), 20000)));
    idx := idx + 1;
  end loop;
  insert into public.reports (professional_id, patient_id, template_id, kind, title, session_date, sections, status)
  values (l.professional_id, l.patient_id, l.template_id, 'anamnese', t.name,
          (now() at time zone 'America/Sao_Paulo')::date, secs, 'rascunho');
  update public.share_links set responded_at = now(), consent_at = now(), consent_text = p_consent_text where id = l.id;
end $$;

-- Registro de exportações (auditoria): só profissionais logados.
create or replace function public.log_export(p_entity text, p_entity_id uuid, p_detail jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (user_id, action, entity, entity_id, detail)
  values (auth.uid(), 'export', p_entity, p_entity_id, p_detail);
$$;

revoke all on function public.public_get_link(text, text) from public;
revoke all on function public.public_submit_anamnese(text, jsonb, text) from public;
revoke all on function public.log_export(text, uuid, jsonb) from public, anon;
grant execute on function public.public_get_link(text, text) to anon, authenticated;
grant execute on function public.public_submit_anamnese(text, jsonb, text) to anon, authenticated;
grant execute on function public.log_export(text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- v11: anamnese por link com campos próprios (o profissional monta as
-- perguntas na hora de enviar; não depende de um modelo)
-- ---------------------------------------------------------------------
alter table public.share_links add column if not exists fields jsonb;
alter table public.share_links drop constraint if exists share_anamnese_tem_modelo;
alter table public.share_links add constraint share_anamnese_tem_modelo
  check (kind <> 'anamnese' or template_id is not null or fields is not null);
alter table public.share_links drop constraint if exists share_fields_lista;
alter table public.share_links add constraint share_fields_lista
  check (fields is null or (jsonb_typeof(fields) = 'array' and jsonb_array_length(fields) between 1 and 60));

create or replace function public.public_get_link(p_token text, p_password_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.share_links; p public.profiles; pat public.patients; t public.templates; r public.reports;
begin
  select * into l from public.share_links where token = p_token;
  if not found or l.expires_at < now() then raise exception 'link_invalido'; end if;
  select * into p from public.profiles where id = l.professional_id;
  select * into pat from public.patients where id = l.patient_id;
  if l.kind = 'anamnese' then
    if l.fields is null then
      select * into t from public.templates where id = l.template_id;
      if not found then raise exception 'link_invalido'; end if;
    end if;
    return jsonb_build_object('kind','anamnese','expires_at',l.expires_at,'responded', l.responded_at is not null,
      'patient_name', pat.name, 'professional_name', p.full_name, 'specialty', p.specialty,
      'title', coalesce(t.name, 'Anamnese'), 'sections', coalesce(l.fields, t.sections));
  end if;
  if l.password_hash is not null and (p_password_hash is null or p_password_hash <> l.password_hash) then
    return jsonb_build_object('kind','relatorio','needs_password', true, 'expires_at', l.expires_at);
  end if;
  select * into r from public.reports where id = l.report_id;
  if not found or r.status <> 'revisado' then raise exception 'relatorio_indisponivel'; end if;
  return jsonb_build_object('kind','relatorio','needs_password', false, 'expires_at', l.expires_at,
    'patient_name', pat.name, 'professional_name', p.full_name, 'specialty', p.specialty, 'council_registry', p.council_registry,
    'branding', coalesce(p.branding, '{}'::jsonb) - 'payment' - 'insurers' - 'recibo_seq',
    'report_kind', r.kind, 'title', r.title, 'session_date', r.session_date, 'period_start', r.period_start, 'period_end', r.period_end,
    'sections', (select coalesce(jsonb_agg(s), '[]'::jsonb) from jsonb_array_elements(r.sections) s
                 where coalesce((s->>'patient_visible')::boolean, true)));
end $$;

create or replace function public.public_submit_anamnese(p_token text, p_answers jsonb, p_consent_text text)
returns void language plpgsql security definer set search_path = public as $$
declare l public.share_links; t public.templates; src jsonb; secs jsonb := '[]'::jsonb; item jsonb; idx int := 0;
begin
  select * into l from public.share_links where token = p_token for update;
  if not found or l.kind <> 'anamnese' or l.expires_at < now() then raise exception 'link_invalido'; end if;
  if l.responded_at is not null then raise exception 'ja_respondido'; end if;
  if coalesce(length(trim(p_consent_text)), 0) = 0 then raise exception 'consentimento_obrigatorio'; end if;
  if l.fields is null then
    select * into t from public.templates where id = l.template_id;
    if not found then raise exception 'link_invalido'; end if;
  end if;
  src := coalesce(l.fields, t.sections);
  for item in select * from jsonb_array_elements(src) loop
    secs := secs || jsonb_build_array(jsonb_build_object('title', item->>'title',
      'text', left(coalesce(p_answers->>(idx::text), ''), 20000)));
    idx := idx + 1;
  end loop;
  insert into public.reports (professional_id, patient_id, template_id, kind, title, session_date, sections, status)
  values (l.professional_id, l.patient_id, l.template_id, 'anamnese', coalesce(t.name, 'Anamnese'),
          (now() at time zone 'America/Sao_Paulo')::date, secs, 'rascunho');
  update public.share_links set responded_at = now(), consent_at = now(), consent_text = p_consent_text where id = l.id;
end $$;

-- ---------------------------------------------------------------------
-- v12: cobrança agendada por paciente (dia fixo do mês ou data avulsa),
-- marca do profissional na anamnese por link e timbre do modelo no
-- relatório por link
-- ---------------------------------------------------------------------
alter table public.patient_admin add column if not exists billing_day smallint;
alter table public.patient_admin drop constraint if exists patient_admin_billing_day_check;
alter table public.patient_admin add constraint patient_admin_billing_day_check check (billing_day is null or billing_day between 1 and 28);
alter table public.patient_admin add column if not exists next_charge_on date;   -- cobrança avulsa agendada
alter table public.patient_admin add column if not exists last_charged_on date;  -- última cobrança enviada

create or replace function public.public_get_link(p_token text, p_password_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.share_links; p public.profiles; pat public.patients; t public.templates; r public.reports;
begin
  select * into l from public.share_links where token = p_token;
  if not found or l.expires_at < now() then raise exception 'link_invalido'; end if;
  select * into p from public.profiles where id = l.professional_id;
  select * into pat from public.patients where id = l.patient_id;
  if l.kind = 'anamnese' then
    if l.fields is null then
      select * into t from public.templates where id = l.template_id;
      if not found then raise exception 'link_invalido'; end if;
    end if;
    return jsonb_build_object('kind','anamnese','expires_at',l.expires_at,'responded', l.responded_at is not null,
      'patient_name', pat.name, 'professional_name', p.full_name, 'specialty', p.specialty,
      'branding', jsonb_build_object('org_name', p.branding->>'org_name', 'logo', p.branding->>'logo', 'color', p.branding->>'color'),
      'title', coalesce(t.name, 'Anamnese'), 'sections', coalesce(l.fields, t.sections));
  end if;
  if l.password_hash is not null and (p_password_hash is null or p_password_hash <> l.password_hash) then
    return jsonb_build_object('kind','relatorio','needs_password', true, 'expires_at', l.expires_at);
  end if;
  select * into r from public.reports where id = l.report_id;
  if not found or r.status <> 'revisado' then raise exception 'relatorio_indisponivel'; end if;
  return jsonb_build_object('kind','relatorio','needs_password', false, 'expires_at', l.expires_at,
    'patient_name', pat.name, 'professional_name', p.full_name, 'specialty', p.specialty, 'council_registry', p.council_registry,
    'branding', coalesce(p.branding, '{}'::jsonb) - 'payment' - 'insurers' - 'recibo_seq',
    'layout', (select tp.meta->'layout' from public.templates tp where tp.id = r.template_id
               and tp.meta ? 'layout' and coalesce((tp.meta->'layout'->>'use')::boolean, true)),
    'report_kind', r.kind, 'title', r.title, 'session_date', r.session_date, 'period_start', r.period_start, 'period_end', r.period_end,
    'sections', (select coalesce(jsonb_agg(s), '[]'::jsonb) from jsonb_array_elements(r.sections) s
                 where coalesce((s->>'patient_visible')::boolean, true)));
end $$;

-- ---------------------------------------------------------------------
-- v13: agenda (séries, confirmação, bloqueios, lista de espera), clínico
-- (metas, escalas, anexos), novos links públicos (confirmação de presença,
-- orientações, pesquisa) e financeiro (cobranças avulsas, mensalidade,
-- pacotes, convênio, recibos guardados)
-- ---------------------------------------------------------------------
alter table public.appointments add column if not exists series_id uuid;          -- sessões criadas juntas (repetição)
alter table public.appointments add column if not exists confirm_status text;     -- resposta do paciente pelo link
alter table public.appointments drop constraint if exists appointments_confirm_status_check;
alter table public.appointments add constraint appointments_confirm_status_check check (confirm_status is null or confirm_status in ('confirmado','remarcar'));
alter table public.appointments add column if not exists confirmed_at timestamptz;
create index if not exists appointments_series_idx on public.appointments (series_id);

create table if not exists public.agenda_blocks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  date date not null, end_date date, start_time time, end_time time, reason text,
  created_at timestamptz not null default now()
);
alter table public.agenda_blocks enable row level security;
drop policy if exists agenda_blocks_all_own on public.agenda_blocks;
create policy agenda_blocks_all_own on public.agenda_blocks for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());
grant select, insert, update, delete on public.agenda_blocks to authenticated;

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null, phone text, preference text, notes text,
  status text not null default 'aguardando' check (status in ('aguardando','chamado','encerrado')),
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
drop policy if exists waitlist_all_own on public.waitlist;
create policy waitlist_all_own on public.waitlist for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());
grant select, insert, update, delete on public.waitlist to authenticated;

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null, description text, due_date date,
  status text not null default 'em_andamento' check (status in ('em_andamento','alcancada','pausada')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists goals_patient_idx on public.goals (patient_id);
alter table public.goals enable row level security;
drop policy if exists goals_all_own on public.goals;
create policy goals_all_own on public.goals for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());
grant select, insert, update, delete on public.goals to authenticated;

alter table public.reports add column if not exists goal_ids uuid[] not null default '{}'; -- metas trabalhadas na sessão

create table if not exists public.scales (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null, items jsonb not null, created_at timestamptz not null default now()
);
alter table public.scales enable row level security;
drop policy if exists scales_all_own on public.scales;
create policy scales_all_own on public.scales for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());
grant select, insert, update, delete on public.scales to authenticated;

create table if not exists public.scale_scores (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  scale_id uuid not null references public.scales(id) on delete cascade,
  date date not null, vals jsonb not null, total numeric(10,2) not null, notes text,
  created_at timestamptz not null default now()
);
create index if not exists scale_scores_patient_idx on public.scale_scores (patient_id, date);
alter table public.scale_scores enable row level security;
drop policy if exists scale_scores_all_own on public.scale_scores;
create policy scale_scores_all_own on public.scale_scores for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());
grant select, insert, update, delete on public.scale_scores to authenticated;

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null, path text not null unique, size int, mime text,
  kind text not null default 'documento' check (kind in ('documento','comprovante')),
  created_at timestamptz not null default now()
);
create index if not exists attachments_patient_idx on public.attachments (patient_id, created_at desc);
alter table public.attachments enable row level security;
drop policy if exists attachments_all_own on public.attachments;
create policy attachments_all_own on public.attachments for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());
grant select, insert, update, delete on public.attachments to authenticated;

-- Arquivos (anexos e comprovantes): pasta privada por profissional. O caminho começa pelo id do profissional.
insert into storage.buckets (id, name, public, file_size_limit) values ('anexos', 'anexos', false, 10485760)
  on conflict (id) do update set public = false, file_size_limit = 10485760;
drop policy if exists anexos_do_profissional on storage.objects;
create policy anexos_do_profissional on storage.objects for all to authenticated
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_professional())
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_professional());

-- Links públicos: novos tipos
alter table public.share_links drop constraint if exists share_links_kind_check;
alter table public.share_links add constraint share_links_kind_check check (kind in ('anamnese','relatorio','confirmacao','orientacao','pesquisa'));
alter table public.share_links add column if not exists appointment_id uuid references public.appointments(id) on delete cascade;
alter table public.share_links add column if not exists content text;
alter table public.share_links add column if not exists opened_at timestamptz;
alter table public.share_links alter column patient_id drop not null;
alter table public.share_links drop constraint if exists share_links_tipo_dados;
alter table public.share_links add constraint share_links_tipo_dados check (
  (kind <> 'confirmacao' or appointment_id is not null) and (kind <> 'orientacao' or content is not null) and (kind = 'pesquisa' or patient_id is not null));

create table if not exists public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  link_id uuid not null references public.share_links(id) on delete cascade,
  score smallint not null check (score between 0 and 10), comment text,
  created_at timestamptz not null default now()
);
alter table public.survey_answers alter column professional_id drop default;
alter table public.survey_answers enable row level security;
drop policy if exists survey_answers_read_own on public.survey_answers;
create policy survey_answers_read_own on public.survey_answers for select to authenticated
  using (professional_id = auth.uid() and public.is_professional());
drop policy if exists survey_answers_del_own on public.survey_answers;
create policy survey_answers_del_own on public.survey_answers for delete to authenticated
  using (professional_id = auth.uid() and public.is_professional());
grant select, delete on public.survey_answers to authenticated;

-- Financeiro: cobranças que não são sessão (mensalidade, pacote, avulsa)
create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  kind text not null check (kind in ('mensalidade','pacote','avulsa')),
  description text not null, amount numeric(10,2) not null check (amount >= 0),
  due_date date not null, ref_month text,
  payment_status text not null default 'pendente' check (payment_status in ('pendente','pago')),
  paid_on date, payment_method text,
  created_at timestamptz not null default now()
);
create unique index if not exists charges_mensalidade_uma_por_mes on public.charges (patient_id, ref_month) where kind = 'mensalidade';
create index if not exists charges_prof_idx on public.charges (professional_id, due_date);
alter table public.charges enable row level security;
drop policy if exists charges_all_own on public.charges;
create policy charges_all_own on public.charges for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());
grant select, insert, update, delete on public.charges to authenticated;

alter table public.patient_admin add column if not exists billing_mode text not null default 'sessao';
alter table public.patient_admin drop constraint if exists patient_admin_billing_mode_check;
alter table public.patient_admin add constraint patient_admin_billing_mode_check check (billing_mode in ('sessao','mensal','pacote'));
alter table public.patient_admin add column if not exists monthly_fee numeric(10,2);
alter table public.patient_admin add column if not exists package_size smallint;
alter table public.patient_admin add column if not exists package_price numeric(10,2);
alter table public.patient_admin add column if not exists package_balance int not null default 0;  -- sessões que restam do pacote
alter table public.patient_admin add column if not exists insurer_pays boolean not null default false; -- quem paga é o convênio

create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  numero int not null, issued_on date not null default current_date, total numeric(10,2) not null,
  data jsonb not null,  -- o que foi impresso (para a segunda via)
  created_at timestamptz not null default now()
);
create index if not exists receipts_prof_idx on public.receipts (professional_id, numero desc);
alter table public.receipts enable row level security;
drop policy if exists receipts_all_own on public.receipts;
create policy receipts_all_own on public.receipts for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());
grant select, insert, update, delete on public.receipts to authenticated;

create or replace function public.public_get_link(p_token text, p_password_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l public.share_links; p public.profiles; pat public.patients; t public.templates; r public.reports; ap public.appointments;
begin
  select * into l from public.share_links where token = p_token;
  if not found or l.expires_at < now() then raise exception 'link_invalido'; end if;
  select * into p from public.profiles where id = l.professional_id;
  select * into pat from public.patients where id = l.patient_id;
  if l.opened_at is null then update public.share_links set opened_at = now() where id = l.id; end if;
  if l.kind = 'confirmacao' then
    select * into ap from public.appointments where id = l.appointment_id;
    if not found then raise exception 'link_invalido'; end if;
    return jsonb_build_object('kind','confirmacao','expires_at',l.expires_at,
      'patient_name', pat.name, 'professional_name', p.full_name, 'specialty', p.specialty,
      'branding', jsonb_build_object('org_name', p.branding->>'org_name', 'logo', p.branding->>'logo', 'color', p.branding->>'color'),
      'date', ap.date, 'time', ap.time, 'duration_min', ap.duration_min, 'status', ap.status, 'confirm_status', ap.confirm_status);
  end if;
  if l.kind = 'orientacao' then
    return jsonb_build_object('kind','orientacao','expires_at',l.expires_at,
      'patient_name', pat.name, 'professional_name', p.full_name, 'specialty', p.specialty,
      'branding', jsonb_build_object('org_name', p.branding->>'org_name', 'logo', p.branding->>'logo', 'color', p.branding->>'color'),
      'title', coalesce(l.fields->>'title', 'Orientações'), 'content', l.content, 'created_at', l.created_at);
  end if;
  if l.kind = 'pesquisa' then
    return jsonb_build_object('kind','pesquisa','expires_at',l.expires_at, 'professional_name', p.full_name, 'specialty', p.specialty,
      'branding', jsonb_build_object('org_name', p.branding->>'org_name', 'logo', p.branding->>'logo', 'color', p.branding->>'color'));
  end if;
  if l.kind = 'anamnese' then
    if l.fields is null then
      select * into t from public.templates where id = l.template_id;
      if not found then raise exception 'link_invalido'; end if;
    end if;
    return jsonb_build_object('kind','anamnese','expires_at',l.expires_at,'responded', l.responded_at is not null,
      'patient_name', pat.name, 'professional_name', p.full_name, 'specialty', p.specialty,
      'branding', jsonb_build_object('org_name', p.branding->>'org_name', 'logo', p.branding->>'logo', 'color', p.branding->>'color'),
      'title', coalesce(t.name, 'Anamnese'), 'sections', coalesce(l.fields, t.sections));
  end if;
  if l.password_hash is not null and (p_password_hash is null or p_password_hash <> l.password_hash) then
    return jsonb_build_object('kind','relatorio','needs_password', true, 'expires_at', l.expires_at);
  end if;
  select * into r from public.reports where id = l.report_id;
  if not found or r.status <> 'revisado' then raise exception 'relatorio_indisponivel'; end if;
  return jsonb_build_object('kind','relatorio','needs_password', false, 'expires_at', l.expires_at,
    'patient_name', pat.name, 'professional_name', p.full_name, 'specialty', p.specialty, 'council_registry', p.council_registry,
    'branding', coalesce(p.branding, '{}'::jsonb) - 'payment' - 'insurers' - 'recibo_seq',
    'layout', (select tp.meta->'layout' from public.templates tp where tp.id = r.template_id
               and tp.meta ? 'layout' and coalesce((tp.meta->'layout'->>'use')::boolean, true)),
    'report_kind', r.kind, 'title', r.title, 'session_date', r.session_date, 'period_start', r.period_start, 'period_end', r.period_end,
    'sections', (select coalesce(jsonb_agg(s), '[]'::jsonb) from jsonb_array_elements(r.sections) s
                 where coalesce((s->>'patient_visible')::boolean, true)));
end $$;

-- Paciente confirma presença ou pede para remarcar.
create or replace function public.public_confirm(p_token text, p_answer text)
returns void language plpgsql security definer set search_path = public as $$
declare l public.share_links;
begin
  select * into l from public.share_links where token = p_token for update;
  if not found or l.kind <> 'confirmacao' or l.expires_at < now() then raise exception 'link_invalido'; end if;
  if p_answer not in ('confirmado','remarcar') then raise exception 'resposta_invalida'; end if;
  update public.appointments set confirm_status = p_answer, confirmed_at = now() where id = l.appointment_id and status = 'agendado';
  update public.share_links set responded_at = now() where id = l.id;
end $$;

-- Pesquisa de satisfação anônima (várias respostas pelo mesmo link).
create or replace function public.public_submit_survey(p_token text, p_score int, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare l public.share_links;
begin
  select * into l from public.share_links where token = p_token;
  if not found or l.kind <> 'pesquisa' or l.expires_at < now() then raise exception 'link_invalido'; end if;
  if p_score is null or p_score < 0 or p_score > 10 then raise exception 'resposta_invalida'; end if;
  if (select count(*) from public.survey_answers where link_id = l.id) >= 2000 then raise exception 'link_invalido'; end if;
  insert into public.survey_answers (professional_id, link_id, score, comment)
  values (l.professional_id, l.id, p_score, nullif(left(trim(coalesce(p_comment, '')), 2000), ''));
end $$;
revoke all on function public.public_confirm(text, text) from public;
revoke all on function public.public_submit_survey(text, int, text) from public;
grant execute on function public.public_confirm(text, text) to anon, authenticated;
grant execute on function public.public_submit_survey(text, int, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- v14: controle de gastos (despesa fixa, paga ou a pagar) e informações
-- do pagamento lidas do comprovante (o arquivo não é guardado)
-- ---------------------------------------------------------------------
alter table public.expenses add column if not exists fixed boolean not null default false; -- repete todo mês
alter table public.expenses add column if not exists paid boolean not null default true;   -- false = a pagar
alter table public.appointments add column if not exists payment_note text;                -- ex.: pagador lido do comprovante
alter table public.charges add column if not exists payment_note text;

-- ---------------------------------------------------------------------
-- v15: acesso de secretária (só agenda e financeiro de um profissional),
-- página pública do profissional e portal do paciente com próximas sessões
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('professional','patient','secretary'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'professional');
  v_code text;
begin
  if v_role not in ('professional','patient','secretary') then v_role := 'professional'; end if;
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

-- Quem o profissional autorizou como secretária(o), pelo e-mail.
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  email text not null, name text, active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists staff_prof_email_idx on public.staff (professional_id, lower(email));
alter table public.staff enable row level security;
drop policy if exists staff_all_own on public.staff;
create policy staff_all_own on public.staff for all to authenticated
  using (professional_id = auth.uid() and public.is_professional())
  with check (professional_id = auth.uid() and public.is_professional());
grant select, insert, update, delete on public.staff to authenticated;

-- Profissional para quem a pessoa logada trabalha como secretária (ou null).
create or replace function public.staff_of()
returns uuid language sql stable security definer set search_path = public as $$
  select s.professional_id from public.staff s
  join public.profiles me on me.id = auth.uid() and me.role = 'secretary' and not me.disabled
  join public.profiles pr on pr.id = s.professional_id and pr.role = 'professional' and not pr.disabled
  where s.active and lower(s.email) = lower(auth.jwt() ->> 'email')
  order by s.created_at limit 1;
$$;
-- Dono dos dados ou secretária autorizada: vale só para agenda e financeiro.
create or replace function public.can_manage(pid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (pid = auth.uid() and public.is_professional()) or pid = public.staff_of();
$$;
revoke all on function public.staff_of() from public, anon;
revoke all on function public.can_manage(uuid) from public, anon;
grant execute on function public.staff_of() to authenticated;
grant execute on function public.can_manage(uuid) to authenticated;

-- Agenda e financeiro: profissional ou secretária. Registros clínicos continuam só do profissional.
drop policy if exists appointments_all_own on public.appointments;
create policy appointments_all_own on public.appointments for all to authenticated
  using (public.can_manage(professional_id))
  with check (public.can_manage(professional_id)
    and exists (select 1 from public.patients p where p.id = patient_id and p.professional_id = appointments.professional_id));
drop policy if exists patient_admin_all_own on public.patient_admin;
create policy patient_admin_all_own on public.patient_admin for all to authenticated
  using (public.can_manage(professional_id))
  with check (public.can_manage(professional_id)
    and exists (select 1 from public.patients p where p.id = patient_id and p.professional_id = patient_admin.professional_id));
drop policy if exists expenses_all_own on public.expenses;
create policy expenses_all_own on public.expenses for all to authenticated
  using (public.can_manage(professional_id)) with check (public.can_manage(professional_id));
drop policy if exists charges_all_own on public.charges;
create policy charges_all_own on public.charges for all to authenticated
  using (public.can_manage(professional_id)) with check (public.can_manage(professional_id));
drop policy if exists agenda_blocks_all_own on public.agenda_blocks;
create policy agenda_blocks_all_own on public.agenda_blocks for all to authenticated
  using (public.can_manage(professional_id)) with check (public.can_manage(professional_id));
drop policy if exists waitlist_all_own on public.waitlist;
create policy waitlist_all_own on public.waitlist for all to authenticated
  using (public.can_manage(professional_id)) with check (public.can_manage(professional_id));
drop policy if exists receipts_all_own on public.receipts;
create policy receipts_all_own on public.receipts for all to authenticated
  using (public.can_manage(professional_id)) with check (public.can_manage(professional_id));
-- secretária cria e lê só os links de confirmação de presença (dos lembretes)
drop policy if exists share_links_staff on public.share_links;
create policy share_links_staff on public.share_links for all to authenticated
  using (kind = 'confirmacao' and professional_id = public.staff_of())
  with check (kind = 'confirmacao' and professional_id = public.staff_of());

-- O que a secretária precisa saber do profissional (nome, marca e dados de pagamento para cobrar).
create or replace function public.staff_context()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('professional_id', p.id, 'full_name', p.full_name, 'specialty', p.specialty,
    'council_registry', p.council_registry, 'clinic_name', p.clinic_name, 'branding', coalesce(p.branding, '{}'::jsonb))
  from public.profiles p where p.id = public.staff_of();
$$;
-- Pacientes sem nada clínico: só o necessário para agendar e cobrar.
create or replace function public.staff_list_patients()
returns table (id uuid, name text, phone text, email text, archived boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.phone, p.email, p.archived from public.patients p
  where p.professional_id = public.staff_of() order by p.name;
$$;
create or replace function public.staff_save_patient(p_name text, p_phone text, p_email text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_prof uuid := public.staff_of(); v_id uuid;
begin
  if v_prof is null then raise exception 'sem_permissao'; end if;
  if coalesce(length(trim(p_name)), 0) = 0 then raise exception 'nome_obrigatorio'; end if;
  insert into public.patients (professional_id, name, phone, email)
  values (v_prof, left(trim(p_name), 160), nullif(trim(coalesce(p_phone, '')), ''), nullif(lower(trim(coalesce(p_email, ''))), ''))
  returning id into v_id;
  return v_id;
end $$;
-- Próximo número de recibo (a sequência fica no perfil do profissional).
create or replace function public.next_receipt_number()
returns int language plpgsql security definer set search_path = public as $$
declare v_prof uuid := coalesce(public.staff_of(), case when public.is_professional() then auth.uid() end); v_n int;
begin
  if v_prof is null then raise exception 'sem_permissao'; end if;
  update public.profiles set branding = jsonb_set(coalesce(branding, '{}'::jsonb), '{recibo_seq}',
    to_jsonb(coalesce((branding->>'recibo_seq')::int, 0) + 1)) where id = v_prof
  returning (branding->>'recibo_seq')::int into v_n;
  return v_n;
end $$;
revoke all on function public.staff_context() from public, anon;
revoke all on function public.staff_list_patients() from public, anon;
revoke all on function public.staff_save_patient(text, text, text) from public, anon;
revoke all on function public.next_receipt_number() from public, anon;
grant execute on function public.staff_context() to authenticated;
grant execute on function public.staff_list_patients() to authenticated;
grant execute on function public.staff_save_patient(text, text, text) to authenticated;
grant execute on function public.next_receipt_number() to authenticated;

-- Página pública do profissional (só quando ele liga em Configurações): apresentação e contato.
create or replace function public.public_profile(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', coalesce(nullif(branding->>'org_name',''), nullif(clinic_name,''), full_name),
    'full_name', full_name, 'specialty', specialty, 'council_registry', council_registry,
    'logo', branding->>'logo', 'color', branding->>'color', 'accent', branding->>'accent', 'tagline', branding->>'tagline',
    'page', branding->'public')
  from public.profiles
  where role = 'professional' and not disabled and slug is not null and lower(slug) = lower(p_slug)
    and coalesce((branding->'public'->>'on')::boolean, false)
  limit 1;
$$;
revoke all on function public.public_profile(text) from public;
grant execute on function public.public_profile(text) to anon, authenticated;

-- Portal do paciente: próximas sessões e recibos (pelo e-mail do paciente logado).
create or replace function public.portal_overview()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'appointments', coalesce((select jsonb_agg(x order by x.date, x.time) from (
        select a.id, a.date, a.time, a.duration_min, a.confirm_status, pr.full_name as professional_name
        from public.appointments a join public.patients p on p.id = a.patient_id join public.profiles pr on pr.id = a.professional_id
        where a.status = 'agendado' and a.date >= current_date and p.email is not null and lower(p.email) = lower(auth.jwt() ->> 'email')
        order by a.date, a.time limit 20) x), '[]'::jsonb),
    'receipts', coalesce((select jsonb_agg(y order by y.issued_on desc) from (
        select r.numero, r.issued_on, r.total, pr.full_name as professional_name
        from public.receipts r join public.patients p on p.id = r.patient_id join public.profiles pr on pr.id = r.professional_id
        where p.email is not null and lower(p.email) = lower(auth.jwt() ->> 'email')
        order by r.issued_on desc limit 24) y), '[]'::jsonb))
  where exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'patient');
$$;
create or replace function public.portal_confirm(p_appointment uuid, p_answer text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_answer not in ('confirmado','remarcar') then raise exception 'resposta_invalida'; end if;
  if not exists (select 1 from public.profiles me where me.id = auth.uid() and me.role = 'patient') then raise exception 'sem_permissao'; end if;
  update public.appointments a set confirm_status = p_answer, confirmed_at = now()
  from public.patients p
  where a.id = p_appointment and p.id = a.patient_id and a.status = 'agendado'
    and p.email is not null and lower(p.email) = lower(auth.jwt() ->> 'email');
  if not found then raise exception 'link_invalido'; end if;
end $$;
revoke all on function public.portal_overview() from public, anon;
revoke all on function public.portal_confirm(uuid, text) from public, anon;
grant execute on function public.portal_overview() to authenticated;
grant execute on function public.portal_confirm(uuid, text) to authenticated;
