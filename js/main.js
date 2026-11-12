import * as api from './api.js';
import { state } from './state.js';
import { $, esc, toast, confirmBox, openModal } from './ui.js';
import { renderSetup, renderAuth, promptNewPassword, renderMfaChallenge } from './views-auth.js';
import * as home from './views-home.js';
import * as session from './views-session.js';
import * as report from './views-report.js';
import * as lists from './views-lists.js';
import * as settings from './views-settings.js';
import * as portal from './views-portal.js';
import { renderHelp, renderAbout } from './views-help.js';
import { renderOnboarding } from './views-onboarding.js';
import { applySettings } from './state.js';
import { PROVIDERS } from './ai.js';
import { applyLook } from './theme.js';
import { brandOf, applyBrand, rememberBrand, cachedBrand, DEFAULT_BRAND } from './brand.js';

const PRO_ROUTES = [
  [/^#\/painel$/, () => home.renderDashboard()],
  [/^#\/pacientes$/, () => home.renderPatients()],
  [/^#\/pacientes\/([\w-]+)$/, (m) => home.renderPatientDetail(m[1])],
  [/^#\/nova$/, (m, q) => session.renderNewSession(q)],
  [/^#\/relatorios$/, (m, q) => lists.renderReports(q)],
  [/^#\/relatorio\/([\w-]+)$/, (m) => report.renderReport(m[1])],
  [/^#\/periodo$/, (m, q) => lists.renderPeriod(q)],
  [/^#\/modelos$/, () => settings.renderTemplates()],
  [/^#\/modelos\/novo$/, () => import('./views-template-editor.js').then((v) => v.renderTemplateEditor('novo'))],
  [/^#\/modelos\/editar\/([\w-]+)$/, (m) => import('./views-template-editor.js').then((v) => v.renderTemplateEditor(m[1]))],
  [/^#\/administrativo$/, (m, q) => import('./views-administrativo.js').then((v) => v.renderAdministrativo(q))],
  [/^#\/financeiro$/, (m, q) => import('./views-financeiro.js').then((v) => v.renderFinanceiro(q))],
  [/^#\/mais$/, () => import('./views-administrativo.js').then((v) => v.renderMore())],
  [/^#\/ajuda$/, () => renderHelp()],
  [/^#\/sobre$/, () => renderAbout()],
  [/^#\/admin$/, () => import('./views-admin.js').then((m) => m.renderAdmin())],
  [/^#\/config$/, (m, q) => settings.renderSettings(q)],
];
const isStaffRole = (p) => p && p.role === 'secretary';
const PATIENT_ROUTES = [
  [/^#\/portal$/, () => portal.renderPortal()],
  [/^#\/sobre$/, () => renderAbout()],
  [/^#\/portal\/([\w-]+)$/, (m) => portal.renderPortalReport(m[1])],
];

applyLook();
let routing = Promise.resolve();
const route = () => (routing = routing.then(doRoute));

async function doRoute() {
  if (typeof window.__cleanup === 'function') { window.__cleanup(); window.__cleanup = null; }
  window.__dirty = false;

  if (!api.configured) return renderSetup();
  // links públicos (#/l/token): sem login, só a tela do link
  const pub = (location.hash.match(/^#\/l\/([\w-]+)/) || [])[1];
  if (pub) return import('./views-public.js').then((m) => m.renderPublicLink(pub));
  // página pública do profissional (#/p/link-proprio): apresentação e contato, sem login
  const pag = (location.hash.match(/^#\/p\/([\w-]+)/) || [])[1];
  if (pag) return import('./views-public.js').then((m) => m.renderPublicProfile(pag));
  try {
    if (!state.settingsLoaded) { try { applySettings(await api.loadSettings(), PROVIDERS); } catch { /* tabela ainda não criada */ } state.settingsLoaded = true; }
    const session = await api.getSession();
    if (!session) {
      state.user = null; state.profile = null;
      // tela de login com a marca do profissional: pelo link próprio (#/c/nome) ou pelo último uso neste navegador
      // #/c/nome = entrada do profissional com a marca; #/paciente (ou #/paciente/nome) = Portal do paciente
      const paciente = /^#\/paciente(\/|$)/.test(location.hash);
      const slug = (location.hash.match(/^#\/(?:c|paciente)\/([\w-]+)/) || [])[1];
      let brand = null;
      if (slug) { try { brand = await api.brandBySlug(slug); } catch { brand = null; } }
      if (brand) brand = { ...brand, slug }; else brand = cachedBrand();
      applyBrand(brand || DEFAULT_BRAND);
      return renderAuth(brand, paciente);
    }
    if (await api.mfaNeedsCode()) return renderMfaChallenge(session.user.email, () => route());
    if (!state.profile || (state.profile._uid || state.profile.id) !== session.user.id) {
      state.user = session.user;
      api.setStaff(null);
      const meu = await api.getProfile();
      if (meu.role === 'secretary' && !meu.disabled) {
        // secretária(o): entra na agenda e no financeiro do profissional que liberou o e-mail dela
        const ctx = await api.staffContext();
        if (!ctx) {
          $('#app').innerHTML = `<div class="auth-wrap"><div class="card auth-card"><h2>Acesso ainda não liberado</h2>
            <p>Sua conta de secretária(o) foi criada com o e-mail <b>${esc(session.user.email)}</b>. Peça ao(à) profissional para liberar este e-mail em Configurações → Equipe. Depois, entre de novo.</p>
            <div class="row"><button class="btn" id="retry">Tentar de novo</button><button class="btn ghost" id="out">Sair</button></div></div></div>`;
          $('#retry').onclick = () => route();
          $('#out').onclick = async () => { await api.signOut(); api.setStaff(null); state.profile = null; route(); };
          return;
        }
        api.setStaff(ctx.professional_id);
        state.profile = { ...ctx, id: ctx.professional_id, role: 'secretary', _uid: session.user.id, staff_name: meu.full_name, onboarded: true, preferences: {} };
      } else state.profile = meu;
    }
    if (state.profile.disabled) {
      $('#app').innerHTML = `<div class="auth-wrap"><div class="card auth-card"><h2>Conta desativada</h2><p>O acesso desta conta foi desativado pela administração. Entre em contato com o suporte.</p><button class="btn ghost" id="out">Sair</button></div></div>`;
      $('#out').onclick = async () => { await api.signOut(); api.setStaff(null); state.profile = null; route(); };
      return;
    }
    const isPatient = state.profile.role === 'patient';
    if (isPatient) applyBrand(DEFAULT_BRAND);
    else {
      const b = brandOf(state.profile); applyBrand(b); rememberBrand(b);
      if (!isStaffRole(state.profile) && !state.profile.onboarded && !state.profile.is_admin) return renderOnboarding(() => { location.hash = '#/painel'; route(); });
    }
    const isStaff = state.profile.role === 'secretary';
    const home = isPatient ? '#/portal' : isStaff ? '#/administrativo' : state.profile.is_admin ? '#/admin' : '#/painel';
    const [path, query = ''] = (location.hash || home).split('?');
    const routes = isPatient ? PATIENT_ROUTES : isStaff ? PRO_ROUTES.filter(([re]) => /administrativo|financeiro|ajuda|sobre/.test(re.source)) : PRO_ROUTES;
    const hit = routes.map(([re, fn]) => [path.match(re), fn]).find(([m]) => m);
    if (!hit) { location.hash = home; return; }
    const TELAS = { painel: 'Início', pacientes: 'Pacientes', nova: 'Nova sessão', relatorios: 'Relatórios', relatorio: 'Relatório', periodo: 'Por período', modelos: 'Modelos', administrativo: 'Administrativo', financeiro: 'Financeiro', mais: 'Mais', ajuda: 'Ajuda', sobre: 'Sobre', admin: 'Administração', config: 'Configurações', portal: 'Portal' };
    const tela = TELAS[path.split('/')[1]];
    if (tela) document.title = `${tela} · ${document.title}`; // document.title já traz a marca (applyBrand)
    await hit[1](hit[0], new URLSearchParams(query));
  } catch (err) {
    console.error(err);
    $('#app').innerHTML = `<div class="auth-wrap"><div class="card auth-card">
      <h2>Algo deu errado</h2><p>${esc(err.message || String(err))}</p>
      <div class="row"><button class="btn" id="retry">Tentar novamente</button>
      <button class="btn ghost" id="out">Sair</button></div></div></div>`;
    $('#retry').onclick = () => route();
    $('#out').onclick = async () => { await api.signOut(); api.setStaff(null); state.profile = null; route(); };
  }
}

window.addEventListener('hashchange', async (e) => {
  if (window.__dirty) {
    const stay = !(await confirmBox('Há alterações não salvas. Sair desta página mesmo assim?', 'Sair sem salvar'));
    if (stay) { history.replaceState(null, '', new URL(e.oldURL).hash); return; }
  }
  route();
});
window.addEventListener('beforeunload', (e) => { if (window.__dirty) { e.preventDefault(); e.returnValue = ''; } });

if (api.configured) {
  api.sb.auth.onAuthStateChange((event, sess) => {
    // não chamar o Supabase dentro do callback: agenda para depois
    if (event === 'SIGNED_OUT') setTimeout(() => { api.setStaff(null); state.profile = null; state.user = null; route(); }, 0);
    else if (event === 'SIGNED_IN' && (!state.user || state.user.id !== sess?.user?.id)) setTimeout(() => { state.profile = null; route(); }, 0);
    else if (event === 'PASSWORD_RECOVERY') setTimeout(() => promptNewPassword(), 0);
  });
}

const SHORTCUTS = [
  ['Ctrl K', 'Buscar paciente ou relatório'],
  ['Ctrl S', 'Salvar o relatório que está aberto'],
  ['Alt N', 'Criar algo novo'],
  ['Alt H', 'Ir para o Início'],
  ['?', 'Abrir esta ajuda'],
];
export function showShortcuts() {
  openModal('Atalhos do teclado', `<dl class="keys">${SHORTCUTS.map(([k, d]) => `<dt>${k.split(' ').map((x) => `<kbd>${x}</kbd>`).join('+')}</dt><dd>${d}</dd>`).join('')}</dl>
    <p class="muted small" style="margin-top:14px">No Mac, use Cmd no lugar de Ctrl. Tamanho da letra, tema e contraste ficam em Configurações, aba Aparência.</p>`, { cancelText: 'Fechar' });
}
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  const pro = state.profile?.role === 'professional';
  if (pro && e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); import('./new-menu.js').then((m) => m.openNewMenu()); }
  else if (pro && e.altKey && e.key.toLowerCase() === 'h') { e.preventDefault(); location.hash = '#/painel'; }
  else if (!typing && !e.ctrlKey && !e.metaKey && e.key === '?') { e.preventDefault(); showShortcuts(); }
});
document.addEventListener('click', (e) => {
  if (e.target.closest('#open-help')) showShortcuts();
  if (e.target.closest('[data-new]')) { e.preventDefault(); import('./new-menu.js').then((m) => m.openNewMenu()); }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && state.profile?.role === 'professional') {
    e.preventDefault(); import('./search.js').then((m) => m.openSearch());
  }
});

document.addEventListener('click', async (e) => {
  if (!e.target.closest('#logout, [data-logout]')) return;
  await api.signOut(); api.setStaff(null); state.profile = null; state.user = null; location.hash = '';
});

route();
void toast;
