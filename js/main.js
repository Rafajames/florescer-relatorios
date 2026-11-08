import * as api from './api.js';
import { state } from './state.js';
import { $, esc, toast, confirmBox } from './ui.js';
import { renderSetup, renderAuth, promptNewPassword } from './views-auth.js';
import * as home from './views-home.js';
import * as session from './views-session.js';
import * as report from './views-report.js';
import * as lists from './views-lists.js';
import * as settings from './views-settings.js';
import * as portal from './views-portal.js';
import { renderOnboarding } from './views-onboarding.js';
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
  [/^#\/config$/, (m, q) => settings.renderSettings(q)],
];
const PATIENT_ROUTES = [
  [/^#\/portal$/, () => portal.renderPortal()],
  [/^#\/portal\/([\w-]+)$/, (m) => portal.renderPortalReport(m[1])],
];

let routing = Promise.resolve();
const route = () => (routing = routing.then(doRoute));

async function doRoute() {
  if (typeof window.__cleanup === 'function') { window.__cleanup(); window.__cleanup = null; }
  window.__dirty = false;

  if (!api.configured) return renderSetup();
  try {
    const session = await api.getSession();
    if (!session) {
      state.user = null; state.profile = null;
      // tela de login com a marca do profissional: pelo link próprio (#/c/nome) ou pelo último uso neste navegador
      const slug = (location.hash.match(/^#\/c\/([\w-]+)/) || [])[1];
      let brand = null;
      if (slug) { try { brand = await api.brandBySlug(slug); } catch { brand = null; } }
      if (brand) brand = { ...brand, slug }; else brand = cachedBrand();
      applyBrand(brand || DEFAULT_BRAND);
      return renderAuth(brand);
    }
    if (!state.profile || state.profile.id !== session.user.id) {
      state.user = session.user;
      state.profile = await api.getProfile();
    }
    const isPatient = state.profile.role === 'patient';
    if (isPatient) applyBrand(DEFAULT_BRAND);
    else {
      const b = brandOf(state.profile); applyBrand(b); rememberBrand(b);
      if (!state.profile.onboarded) return renderOnboarding(() => { location.hash = '#/painel'; route(); });
    }
    const home = isPatient ? '#/portal' : '#/painel';
    const [path, query = ''] = (location.hash || home).split('?');
    const routes = isPatient ? PATIENT_ROUTES : PRO_ROUTES;
    const hit = routes.map(([re, fn]) => [path.match(re), fn]).find(([m]) => m);
    if (!hit) { location.hash = home; return; }
    await hit[1](hit[0], new URLSearchParams(query));
  } catch (err) {
    console.error(err);
    $('#app').innerHTML = `<div class="auth-wrap"><div class="card auth-card">
      <h2>Algo deu errado</h2><p>${esc(err.message || String(err))}</p>
      <div class="row"><button class="btn" id="retry">Tentar novamente</button>
      <button class="btn ghost" id="out">Sair</button></div></div></div>`;
    $('#retry').onclick = () => route();
    $('#out').onclick = async () => { await api.signOut(); state.profile = null; route(); };
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
    if (event === 'SIGNED_OUT') setTimeout(() => { state.profile = null; state.user = null; route(); }, 0);
    else if (event === 'SIGNED_IN' && (!state.user || state.user.id !== sess?.user?.id)) setTimeout(() => { state.profile = null; route(); }, 0);
    else if (event === 'PASSWORD_RECOVERY') setTimeout(() => promptNewPassword(), 0);
  });
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && state.profile?.role === 'professional') {
    e.preventDefault(); import('./search.js').then((m) => m.openSearch());
  }
});

document.addEventListener('click', async (e) => {
  if (!e.target.closest('#logout, [data-logout]')) return;
  await api.signOut(); state.profile = null; state.user = null; location.hash = '';
});

route();
void toast;
