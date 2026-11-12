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
  if (/(preferences|branding|slug|onboarded|meta|notes|report_versions|brand_by_slug|appointments|patient_admin|expenses)/i.test(m) && /column|schema cache|does not exist|function/i.test(m)) return 'O banco precisa ser atualizado: rode de novo o arquivo supabase/schema.sql no SQL Editor do Supabase.';
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
export const mfaEnroll = () => sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Potira ' + Date.now() }).then(unwrap);
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
const LIST_COLS = 'id,title,kind,session_date,period_start,period_end,status,released_to_patient,ai_generated,patient_id,created_at,goal_ids,patients(name,email)';
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
export const saveAppointments = (rows) => {
  // sessões criadas juntas (repetição) ganham o mesmo series_id, para mover ou excluir a série
  const series_id = rows.length > 1 ? crypto.randomUUID() : null;
  return sb.from('appointments').insert(rows.map((r) => ({ ...r, series_id }))).select().then(unwrap);
};
/** Exclui da série as sessões ainda agendadas a partir de uma data. */
export const deleteSeriesFrom = (seriesId, fromDate) =>
  sb.from('appointments').delete().eq('series_id', seriesId).gte('date', fromDate).eq('status', 'agendado').select('id').then(unwrap);

/* ---------- agenda: bloqueios e lista de espera ---------- */
const upsertRow = (table) => (row) => {
  const { id, ...rest } = row;
  return id ? sb.from(table).update(rest).eq('id', id).select().single().then(unwrap) : sb.from(table).insert(rest).select().single().then(unwrap);
};
const delRow = (table) => (id) => sb.from(table).delete().eq('id', id).then(unwrap);
/** Bloqueios que tocam o período (feriado, folga, horário sem sessão). */
export const listBlocks = async ({ from, to } = {}) => {
  const rows = await sb.from('agenda_blocks').select('*').order('date').then(unwrap);
  return rows.filter((b) => (!to || b.date <= to) && (!from || (b.end_date || b.date) >= from));
};
export const saveBlock = upsertRow('agenda_blocks');
export const deleteBlock = delRow('agenda_blocks');
export const listWaitlist = () => sb.from('waitlist').select('*').order('created_at').then(unwrap);
export const saveWaitlist = upsertRow('waitlist');
export const deleteWaitlist = delRow('waitlist');

/* ---------- clínico: metas e escalas ---------- */
export const listGoals = (patientId) => sb.from('goals').select('*').eq('patient_id', patientId).order('created_at').then(unwrap);
export const saveGoal = (g) => upsertRow('goals')({ ...g, updated_at: new Date().toISOString() });
export const deleteGoal = delRow('goals');
export const listScales = () => sb.from('scales').select('*').order('name').then(unwrap);
export const saveScale = upsertRow('scales');
export const deleteScale = delRow('scales');
export const listScores = (patientId) => sb.from('scale_scores').select('*').eq('patient_id', patientId).order('date').then(unwrap);
export const saveScore = upsertRow('scale_scores');
export const deleteScore = delRow('scale_scores');

/* ---------- financeiro: cobranças que não são sessão, recibos e pesquisa ---------- */
export const listCharges = ({ open, paidFrom, paidTo, patientId } = {}) => {
  let q = sb.from('charges').select('*,patients(name)').order('due_date');
  if (open) q = q.neq('payment_status', 'pago');
  if (paidFrom) q = q.eq('payment_status', 'pago').gte('paid_on', paidFrom).lte('paid_on', paidTo);
  if (patientId) q = q.eq('patient_id', patientId);
  return q.then(unwrap);
};
export const saveCharge = upsertRow('charges');
export const deleteCharge = delRow('charges');
/** Cria a mensalidade do mês para quem paga por mês e ainda não tem a do mês (uma por paciente e mês). */
export const ensureMonthlyCharges = async (month, label) => {
  const [admins, ja] = await Promise.all([
    sb.from('patient_admin').select('patient_id,monthly_fee,billing_day').eq('billing_mode', 'mensal').gt('monthly_fee', 0).then(unwrap),
    sb.from('charges').select('patient_id').eq('kind', 'mensalidade').eq('ref_month', month).then(unwrap),
  ]);
  const tem = new Set(ja.map((c) => c.patient_id));
  const novas = admins.filter((a) => !tem.has(a.patient_id)).map((a) => ({
    patient_id: a.patient_id, kind: 'mensalidade', ref_month: month, description: `Mensalidade de ${label}`,
    amount: a.monthly_fee, due_date: `${month}-${String(a.billing_day || 5).padStart(2, '0')}` }));
  if (novas.length) await sb.from('charges').insert(novas).then(unwrap);
  return novas.length;
};
/** Despesas fixas: copia para o mês as do mês anterior que ainda não existem nele (entram como "a pagar"). */
export const ensureFixedExpenses = async (month) => {
  const [y, m] = month.split('-').map(Number);
  const pm = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const fim = (mm) => { const [yy, mo] = mm.split('-').map(Number); return `${mm}-${String(new Date(yy, mo, 0).getDate()).padStart(2, '0')}`; };
  const [antes, agora] = await Promise.all([
    sb.from('expenses').select('*').eq('fixed', true).gte('date', `${pm}-01`).lte('date', fim(pm)).then(unwrap),
    sb.from('expenses').select('description').eq('fixed', true).gte('date', `${month}-01`).lte('date', fim(month)).then(unwrap),
  ]);
  const tem = new Set(agora.map((e) => e.description));
  const novas = antes.filter((e) => !tem.has(e.description)).map((e) => ({
    date: `${month}-${String(Math.min(28, Number(e.date.slice(8, 10)))).padStart(2, '0')}`, description: e.description, category: e.category, amount: e.amount, fixed: true, paid: false }));
  if (novas.length) await sb.from('expenses').insert(novas).then(unwrap);
  return novas.length;
};
export const listReceipts = () => sb.from('receipts').select('*,patients(name)').order('numero', { ascending: false }).limit(200).then(unwrap);
export const saveReceipt = (r) => sb.from('receipts').insert(r).select().single().then(unwrap);
export const listSurveyAnswers = () => sb.from('survey_answers').select('*').order('created_at', { ascending: false }).limit(500).then(unwrap);
export const getSurveyLink = () => sb.from('share_links').select('id,token,expires_at').eq('kind', 'pesquisa').order('created_at', { ascending: false }).limit(1).then(unwrap).then((r) => r[0] || null);
export const updateAppointment = (id, patch) =>
  sb.from('appointments').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single().then(unwrap);
export const deleteAppointment = (id) => sb.from('appointments').delete().eq('id', id).then(unwrap);
/** Ao registrar a evolução de uma sessão, marca como realizada a sessão agendada do paciente naquele dia (a primeira do horário). Retorna a sessão marcada ou null. */
export const markSessionRealized = async (patientId, date) => {
  const { data, error } = await sb.from('appointments').select('id,patient_id,amount,status,payment_method').eq('patient_id', patientId).eq('date', date).eq('status', 'agendado')
    .order('time', { nullsFirst: true }).limit(1);
  if (error) throw error;
  const a = data && data[0];
  if (!a) return null;
  return setAppointmentStatus(a, 'realizado');
};
/**
 * Muda a situação da sessão. Ao virar "realizado":
 * - cobrança por sessão: grava o valor (preço do paciente naquele momento), para mudanças de preço não alterarem o passado;
 * - mensalidade: a sessão entra com valor zero, já quitada pela mensalidade;
 * - pacote com saldo: valor zero, quitada pelo pacote, e o saldo de sessões diminui.
 * Ao sair de "realizado", desfaz o que a mensalidade ou o pacote tinham feito.
 */
export const setAppointmentStatus = async (a, status) => {
  const patch = { status };
  const adm = (status === 'realizado' || a.status === 'realizado') ? await getPatientAdmin(a.patient_id).catch(() => null) : null;
  if (status === 'realizado' && a.status !== 'realizado') {
    if (adm && adm.billing_mode === 'mensal') Object.assign(patch, { amount: 0, payment_status: 'pago', paid_on: a.date || null, payment_method: 'mensalidade' });
    else if (adm && adm.billing_mode === 'pacote' && adm.package_balance > 0) {
      Object.assign(patch, { amount: 0, payment_status: 'pago', paid_on: a.date || null, payment_method: 'pacote' });
      await savePatientAdmin({ patient_id: a.patient_id, package_balance: adm.package_balance - 1 });
    } else if (a.amount == null && adm && adm.session_price != null) patch.amount = adm.session_price;
  } else if (status !== 'realizado' && a.status === 'realizado' && ['pacote', 'mensalidade'].includes(a.payment_method)) {
    Object.assign(patch, { amount: null, payment_status: 'pendente', paid_on: null, payment_method: null });
    if (a.payment_method === 'pacote' && adm) await savePatientAdmin({ patient_id: a.patient_id, package_balance: (adm.package_balance || 0) + 1 });
  }
  return updateAppointment(a.id, patch);
};
/** Tudo o que está em aberto (qualquer data): sessões realizadas ou faltas, ainda não pagas. */
export const listOpenCharges = () =>
  sb.from('appointments').select('*,patients(name)').neq('payment_status', 'pago').in('status', ['realizado', 'falta']).order('date').order('time', { nullsFirst: true }).then(unwrap);
/** Pagamentos recebidos no período, pela data do pagamento (e não pela data da sessão). */
export const listPaidBetween = (from, to) =>
  sb.from('appointments').select('*,patients(name)').eq('payment_status', 'pago').gte('paid_on', from).lte('paid_on', to).then(unwrap);
export const getPatientAdmin = (patientId) =>
  sb.from('patient_admin').select('*').eq('patient_id', patientId).maybeSingle().then(unwrap);
export const savePatientAdmin = (row) =>
  sb.from('patient_admin').upsert({ ...row, updated_at: new Date().toISOString() }).select().single().then(unwrap);

/* ---------- financeiro: despesas e dados administrativos de todos os pacientes ---------- */
export const listPatientAdmins = () => sb.from('patient_admin').select('*').then(unwrap);
export const listExpenses = ({ from, to } = {}) => {
  let q = sb.from('expenses').select('*').order('date', { ascending: false });
  if (from) q = q.gte('date', from);
  if (to) q = q.lte('date', to);
  return q.then(unwrap);
};
export const saveExpense = (row) => {
  const { id, ...rest } = row;
  return id
    ? sb.from('expenses').update(rest).eq('id', id).select().single().then(unwrap)
    : sb.from('expenses').insert(rest).select().single().then(unwrap);
};
export const deleteExpense = (id) => sb.from('expenses').delete().eq('id', id).then(unwrap);

/* ---------- portal do paciente ---------- */
export const portalReports = () => sb.rpc('portal_list_reports').then(unwrap);

/* ---------- links públicos (anamnese para o paciente responder; relatório para ler/baixar) ---------- */
export const createShareLink = (row) => sb.from('share_links').insert(row).select('id,token,kind,expires_at').single().then(unwrap);
export const listShareLinks = (patientId) =>
  sb.from('share_links').select('id,token,kind,expires_at,responded_at,opened_at,created_at,report_id,template_id,appointment_id,fields').eq('patient_id', patientId).order('created_at', { ascending: false }).then(unwrap);
export const revokeShareLink = (id) => sb.from('share_links').delete().eq('id', id).then(unwrap);
export const getPublicLink = (token, passwordHash = null) =>
  sb.rpc('public_get_link', { p_token: token, p_password_hash: passwordHash }).then(unwrap);
export const submitPublicAnamnese = (token, answers, consentText) =>
  sb.rpc('public_submit_anamnese', { p_token: token, p_answers: answers, p_consent_text: consentText }).then(unwrap);

/** Links de confirmação de presença já criados para estas sessões. */
export const listConfirmLinks = (appointmentIds) => (appointmentIds.length
  ? sb.from('share_links').select('token,appointment_id,expires_at').eq('kind', 'confirmacao').in('appointment_id', appointmentIds).then(unwrap) : Promise.resolve([]));
export const publicConfirm = (token, answer) => sb.rpc('public_confirm', { p_token: token, p_answer: answer }).then(unwrap);
export const publicSubmitSurvey = (token, score, comment) => sb.rpc('public_submit_survey', { p_token: token, p_score: score, p_comment: comment }).then(unwrap);

/** Registra uma exportação (auditoria). Falha em silêncio: não deve travar o download. */
export const logExport = (entity, entityId, detail) =>
  sb.rpc('log_export', { p_entity: entity, p_entity_id: entityId || null, p_detail: detail || null }).then(() => {}, () => {});
