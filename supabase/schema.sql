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
alter table public.reports add constraint reports_kind_check check (kind in ('sessao','periodo','anamnese'));

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
create or replace function public.portal_list_reports()
returns table (
  id uuid, title text, kind text, session_date date,
  period_start date, period_end date, sections jsonb, ai_generated boolean,
  released_at timestamptz, professional_name text, professional_specialty text,
  professional_registry text, clinic_name text
)
language sql stable security definer set search_path = public as $$
  select r.id, r.title, r.kind, r.session_date, r.period_start, r.period_end,
         -- só as seções que o profissional deixou visíveis ao paciente
         (select coalesce(jsonb_agg(sec order by ord), '[]'::jsonb)
            from jsonb_array_elements(r.sections) with ordinality as t(sec, ord)
           where coalesce((sec->>'patient_visible')::boolean, true)) as sections,
         r.ai_generated, r.released_at,
         pr.full_name, pr.specialty, pr.council_registry, pr.clinic_name
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
