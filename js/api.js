import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const sb = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

function friendly(error) {
  const m = (error && error.message) || String(error);
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar (veja a caixa de entrada).';
  if (/already registered|already been registered/i.test(m)) return 'Este e-mail já está cadastrado.';
  if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/convite/i.test(m) || /Database error saving new user/i.test(m)) return 'Código de convite inválido ou já usado.';
  if (/confirme pelo link/i.test(m)) return 'Confirme pelo link enviado ao seu e-mail e tente de novo.';
  if (/row-level security/i.test(m)) return 'Você não tem permissão para esta ação.';
  if (/profiles_slug_key|duplicate key.*slug/i.test(m)) return 'Este endereço já está em uso por outro profissional. Escolha outro.';
  if (/(preferences|branding|slug|onboarded|meta|notes|report_versions|brand_by_slug|appointments|patient_admin)/i.test(m) && /column|schema cache|does not exist|function/i.test(m)) return 'O banco precisa ser atualizado: rode de novo o arquivo supabase/schema.sql no SQL Editor do Supabase.';
  if (/released_only_if_reviewed/i.test(m)) return 'Só é possível liberar ao paciente um relatório já revisado.';
  return m;
}
const unwrap = ({ data, error }) => { if (error) throw new Error(friendly(error)); return data; };

/* ---------- autenticação ---------- */
export const getSession = async () => (await sb.auth.getSession()).data.session;
export const signIn = (email, password) => sb.auth.signInWithPassword({ email, password }).then(unwrap);
export const signOut = () => sb.auth.signOut();
export const signUp = (email, password, meta) =>
  sb.auth.signUp({ email, password, options: { data: meta, emailRedirectTo: location.origin + location.pathname } }).then(unwrap);
export const resetPassword = (email) =>
  sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }).then(unwrap);
export const setNewPassword = (password) => sb.auth.updateUser({ password }).then(unwrap);

/* ---------- perfil ---------- */
export const getProfile = () => sb.from('profiles').select('*').single().then(unwrap);
export const updateProfile = (id, patch) =>
  sb.from('profiles').update(patch).eq('id', id).select().single().then(unwrap);

/* ---------- administração ---------- */
export const loadSettings = () => sb.from('app_settings').select('key,value').then(unwrap);
export const saveSetting = (key, value) =>
  sb.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() }).then(unwrap);
export const adminProfessionals = () => sb.rpc('admin_list_professionals').then(unwrap);
export const adminSetDisabled = (uid, off) => sb.rpc('admin_set_disabled', { uid, off }).then(unwrap);

export const adminStats = () => sb.rpc('admin_stats').then(unwrap);
export const adminResetMfa = (uid) => sb.rpc('admin_reset_mfa', { uid }).then(unwrap);
export const listInvites = () => sb.from('invites').select('*').order('created_at', { ascending: false }).then(unwrap);
export const createInvite = (code, note) => sb.from('invites').insert({ code, note }).then(unwrap);
export const setInviteActive = (code, active) => sb.from('invites').update({ active }).eq('code', code).then(unwrap);
export const deleteInvite = (code) => sb.from('invites').delete().eq('code', code).then(unwrap);
export const listAdminLog = () => sb.from('admin_log').select('*').order('at', { ascending: false }).limit(60).then(unwrap);
export const addAdminLog = (action, target, old_value, new_value) =>
  sb.from('admin_log').insert({ action, target, old_value: old_value ?? null, new_value: new_value ?? null }).then(() => {}, () => {});

/* ---------- autenticador (MFA) ---------- */
export const mfaFactors = async () => ((await sb.auth.mfa.listFactors()).data?.totp || []);
export const mfaEnroll = () => sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Florescer ' + Date.now() }).then(unwrap);
export const mfaVerify = async (factorId, code) => {
  const ch = unwrap(await sb.auth.mfa.challenge({ factorId }));
  unwrap(await sb.auth.mfa.verify({ factorId, challengeId: ch.id, code: String(code).replace(/\s/g, '') }));
};
export const mfaUnenroll = (factorId) => sb.auth.mfa.unenroll({ factorId }).then(unwrap);
export const mfaNeedsCode = async () => {
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  return Boolean(data && data.nextLevel === 'aal2' && data.currentLevel !== 'aal2');
};
export const mfaSelfReset = () => sb.rpc('mfa_self_reset').then(unwrap);

/* ---------- pacientes ---------- */
export const listPatients = (includeArchived = false) => {
  let q = sb.from('patients').select('id,name,email,phone,birth_date,archived,created_at,consents(id,revoked_at),reports(session_date,status,kind)').order('name');
  if (!includeArchived) q = q.eq('archived', false);
  return q.then(unwrap);
};
export const getPatient = (id) => sb.from('patients').select('*').eq('id', id).single().then(unwrap);
export const savePatient = (p) => {
  const { id, ...rest } = p;
  return id
    ? sb.from('patients').update(rest).eq('id', id).select().single().then(unwrap)
    : sb.from('patients').insert(rest).select().single().then(unwrap);
};
export const deletePatient = (id) => sb.from('patients').delete().eq('id', id).then(unwrap);

/* ---------- consentimentos ---------- */
export const listConsents = (patientId) =>
  sb.from('consents').select('*').eq('patient_id', patientId).order('granted_at', { ascending: false }).then(unwrap);
export const addConsent = (c) => sb.from('consents').insert(c).select().single().then(unwrap);
export const revokeConsent = (id) =>
  sb.from('consents').update({ revoked_at: new Date().toISOString() }).eq('id', id).then(unwrap);
export const hasActiveConsent = (consents) => (consents || []).some((c) => !c.revoked_at);

/* ---------- modelos ---------- */
export const listTemplates = () =>
  sb.from('templates').select('*').order('professional_id', { nullsFirst: true }).order('name').then(unwrap);
/** Modelos que o profissional vê: os da área principal, os Gerais e os próprios. Administrador vê tudo. */
export const templatesForMe = (list, profile) => {
  if (!profile || profile.is_admin) return list;
  const area = profile.specialty;
  return list.filter((t) => (t.professional_id ? t.professional_id === profile.id
    : t.specialty === 'Geral' || (Boolean(area) && t.specialty === area)));
};
export const saveTemplate = (t) => {
  const { id, ...rest } = t;
  return id
    ? sb.from('templates').update(rest).eq('id', id).select().single().then(unwrap)
    : sb.from('templates').insert(rest).select().single().then(unwrap);
};
export const deleteTemplate = (id) => sb.from('templates').delete().eq('id', id).then(unwrap);

/* ---------- relatórios ---------- */
const LIST_COLS = 'id,title,kind,session_date,period_start,period_end,status,released_to_patient,ai_generated,patient_id,created_at,patients(name,email)';
export const listReports = ({ patientId, kind, status, limit, from, to, withSections } = {}) => {
  let q = sb.from('reports').select(withSections ? LIST_COLS + ',sections' : LIST_COLS)
    .order('session_date', { ascending: false }).order('created_at', { ascending: false });
  if (patientId) q = q.eq('patient_id', patientId);
  if (kind) q = q.eq('kind', kind);
  if (status) q = q.eq('status', status);
  if (from) q = q.gte('session_date', from);
  if (to) q = q.lte('session_date', to);
  if (limit) q = q.limit(limit);
  return q.then(unwrap);
};
export const getReport = (id) => sb.from('reports').select('*,patients(id,name,email)').eq('id', id).single().then(unwrap);
export const createReport = (r) => sb.from('reports').insert(r).select().single().then(unwrap);
export const updateReport = (id, patch) => sb.from('reports').update(patch).eq('id', id).select().single().then(unwrap);
export const deleteReport = (id) => sb.from('reports').delete().eq('id', id).then(unwrap);
export const updateReports = (ids, patch) => sb.from('reports').update(patch).in('id', ids).select('id').then(unwrap);
export const deleteReports = (ids) => sb.from('reports').delete().in('id', ids).then(unwrap);

/* ---------- versões do relatório ---------- */
export const listVersions = (reportId) =>
  sb.from('report_versions').select('id,title,sections,saved_at').eq('report_id', reportId).order('saved_at', { ascending: false }).limit(30).then(unwrap);

/* ---------- marca pública (tela de login personalizada) ---------- */
export const brandBySlug = async (slug) => {
  const { data, error } = await sb.rpc('brand_by_slug', { p_slug: slug });
  if (error) return null;
  return (data && data[0]) || null;
};

/* ---------- auditoria ---------- */
export const listAudit = (entityId) =>
  sb.from('audit_log').select('action,detail,created_at').eq('entity_id', entityId).order('created_at', { ascending: false }).limit(30).then(unwrap);

export const listAuditAll = () =>
  sb.from('audit_log').select('action,entity,entity_id,detail,created_at').order('created_at', { ascending: false }).limit(100).then(unwrap);

/* ---------- backup dos dados do profissional ---------- */
export async function exportEverything() {
  const [patients, consents, reports, templates] = await Promise.all([
    sb.from('patients').select('*').then(unwrap),
    sb.from('consents').select('*').then(unwrap),
    sb.from('reports').select('*').then(unwrap),
    sb.from('templates').select('*').not('professional_id', 'is', null).then(unwrap),
  ]);
  const appointments = await sb.from('appointments').select('*').then((r) => (r.error ? [] : r.data));
  return { exported_at: new Date().toISOString(), patients, consents, reports, templates, appointments };
}

/* ---------- administrativo: agenda e frequência ---------- */
export const listAppointments = ({ from, to, patientId } = {}) => {
  let q = sb.from('appointments').select('*,patients(name)').order('date').order('time', { nullsFirst: true });
  if (from) q = q.gte('date', from);
  if (to) q = q.lte('date', to);
  if (patientId) q = q.eq('patient_id', patientId);
  return q.then(unwrap);
};
export const saveAppointments = (rows) => sb.from('appointments').insert(rows).select().then(unwrap);
export const updateAppointment = (id, patch) =>
  sb.from('appointments').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single().then(unwrap);
export const deleteAppointment = (id) => sb.from('appointments').delete().eq('id', id).then(unwrap);
export const getPatientAdmin = (patientId) =>
  sb.from('patient_admin').select('*').eq('patient_id', patientId).maybeSingle().then(unwrap);
export const savePatientAdmin = (row) =>
  sb.from('patient_admin').upsert({ ...row, updated_at: new Date().toISOString() }).select().single().then(unwrap);

/* ---------- portal do paciente ---------- */
export const portalReports = () => sb.rpc('portal_list_reports').then(unwrap);
