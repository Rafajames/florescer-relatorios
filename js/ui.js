import { state, settings } from './state.js';
import { icon } from './icons.js';
import { setLook } from './theme.js';
import { logoMenu, simboloColorido } from './marca.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('pt-BR');
};
export const fmtDateTime = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const fmtTime = (d = new Date()) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const daysAgoISO = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
export const longDate = () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const wordCount = (s) => (String(s || '').trim().match(/\S+/g) || []).length;

export function toast(msg, kind = 'ok') {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.innerHTML = (kind === 'ok' ? '<svg class="t-check" viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '') + esc(msg);
  t.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  t.className = 'show ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = ''), kind === 'err' ? 5500 : 2600);
}

// Animações de entrada (painéis em sequência, números contando) só na primeira visita do dia; depois, a tela aparece direto.
let jaViuHoje = false;
try { const hoje = new Date().toISOString().slice(0, 10); jaViuHoje = localStorage.getItem('potira-anim-dia') === hoje;
  if (jaViuHoje) document.documentElement.classList.add('ja-viu'); else setTimeout(() => { try { localStorage.setItem('potira-anim-dia', hoje); } catch { /* sem armazenamento */ } }, 8000);
} catch { /* sem armazenamento */ }
const calmo = () => jaViuHoje || matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Comemoração discreta: uma flor que se abre (primeiro paciente, primeiro relatório liberado). Uma vez por marco, neste navegador. */
export function celebrar(marco, texto) {
  try { if (localStorage.getItem('potira-marco-' + marco)) return; localStorage.setItem('potira-marco-' + marco, '1'); } catch { /* sem armazenamento: comemora mesmo assim */ }
  const el = document.createElement('div'); el.className = 'celebra'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="celebra-flor">${'<i></i>'.repeat(6)}<b></b></div><p>${esc(texto)}</p>`;
  document.body.appendChild(el); setTimeout(() => el.classList.add('sai'), 2600); setTimeout(() => el.remove(), 3200);
}

/** Item apagado encolhe e some antes de sair da lista. */
export function sumir(el) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) { el && el.remove(); return Promise.resolve(); }
  el.style.height = el.offsetHeight + 'px'; el.classList.add('sumindo');
  return new Promise((ok) => setTimeout(() => { el.remove(); ok(); }, 320));
}

/** Números dos resumos (R$ e contagens) sobem contando quando aparecem. */
function contar(b) {
  const txt = b.textContent; const m = txt.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d{2})?|-?\d+/); if (!m) return;
  const dec = m[0].includes(','); const alvo = Number(m[0].replace(/\./g, '').replace(',', '.')); if (!alvo) return;
  const fmt = (v) => dec ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(Math.round(v));
  const t0 = performance.now(), dur = 650;
  const passo = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    b.textContent = txt.replace(m[0], fmt(alvo * e)); if (k < 1) requestAnimationFrame(passo); else b.textContent = txt; };
  requestAnimationFrame(passo);
}
if (typeof MutationObserver !== 'undefined') {
  new MutationObserver(() => { if (calmo()) return; document.querySelectorAll('.stat b:not([data-contou]), .stats b:not([data-contou])').forEach((b) => { b.dataset.contou = '1'; contar(b); }); })
    .observe(document.documentElement, { childList: true, subtree: true });
}

export function openModal(title, bodyHtml, { okText = 'Salvar', cancelText = 'Cancelar', onOk, onOpen, wide = false } = {}) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'modal' + (wide ? ' wide' : '');
    d.innerHTML = `<form method="dialog">
      <button type="button" class="modal-x" data-x aria-label="Fechar" title="Fechar (Esc)">${icon('x')}</button>
      <h3>${esc(title)}</h3>
      <div class="modal-body">${bodyHtml}</div>
      <div class="row end">
        <button type="button" class="btn quiet" data-cancel>${esc(cancelText)}</button>
        ${onOk ? `<button type="submit" class="btn" data-ok>${esc(okText)}</button>` : ''}
      </div></form>`;
    document.body.appendChild(d);
    const close = (v) => { resolve(v); if (matchMedia('(prefers-reduced-motion: reduce)').matches) { d.close(); d.remove(); return; } d.classList.add('fechando'); setTimeout(() => { d.close(); d.remove(); }, 160); };
    $('[data-cancel]', d).onclick = () => close(null);
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
    $('[data-x]', d).onclick = () => close(null);
    // Clicar fora fecha, desde que nada tenha sido digitado (para não perder o que foi escrito).
    let dirty = false, downOut = false;
    const fora = (e) => { const r = d.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
    d.addEventListener('input', () => { dirty = true; });
    d.addEventListener('mousedown', (e) => { downOut = e.target === d && fora(e); });
    d.addEventListener('click', (e) => { if (downOut && e.target === d && fora(e) && !dirty) close(null); downOut = false; });
    $('form', d).addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!onOk) return close(null);
      const btn = $('[data-ok]', d);
      btn.disabled = true;
      try { const r = await onOk(d); if (r !== false) close(r ?? true); }
      catch (err) { toast(err.message || String(err), 'err'); }
      finally { btn.disabled = false; }
    });
    d.showModal();
    if (onOpen) onOpen(d);
    const first = $('input:not([type=checkbox]),select,textarea', d); if (first) first.focus();
  });
}
export const confirmBox = (msg, okText = 'Confirmar') =>
  openModal('Confirmação', `<p>${esc(msg)}</p>`, { okText, onOk: () => true }).then((r) => r === true);

/** Executa fn com o botão desabilitado e texto de progresso. */
export async function busy(btn, text, fn) {
  btn = (btn.closest && btn.closest('button, a')) || btn; // clique pode vir de um ícone dentro do botão
  const old = btn.innerHTML;
  btn.disabled = true; btn.textContent = text;
  try { return await fn(); }
  catch (err) { toast(err.message || String(err), 'err'); }
  finally { btn.disabled = false; btn.innerHTML = old; }
}

export const autosize = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };

export const chip = (text, kind = '') => `<span class="chip ${kind}">${esc(text)}</span>`;
export const statusChip = (r) =>
  r.released_to_patient ? chip('Liberado ao paciente', 'ok')
    : r.status === 'revisado' ? chip('Revisado', 'petrol') : chip('Rascunho', 'warn');
export const meta = (parts) => `<div class="meta">${parts.filter(Boolean).map((p) => `<span>${p}</span>`).join('')}</div>`;
export const callout = (html, kind = '', action = '') =>
  `<div class="callout ${kind}">${icon('info')}<div class="grow">${html}</div>${action}</div>`;

/* ---------- estrutura da página ---------- */
const NAV = [
  ['painel', '#/painel', 'home', 'Início'],
  ['pacientes', '#/pacientes', 'users', 'Pacientes'],
  ['administrativo', '#/administrativo', 'calendar', 'Agenda'],
  ['relatorios', '#/relatorios', 'clipboard', 'Atendimentos'],
  ['modelos', '#/modelos', 'file', 'Documentos'],
  ['financeiro', '#/financeiro', 'wallet', 'Financeiro'],
  ['periodo', '#/periodo', 'chart', 'Relatórios'],
  ['config', '#/config', 'sliders', 'Configurações'],
  ['ajuda', '#/ajuda', 'help', 'Ajuda e Suporte'],
];
const NAV_PATIENT = [['portal', '#/portal', 'file', 'Meus relatórios']];
const TAB = [
  ['painel', '#/painel', 'home', 'Início'],
  ['pacientes', '#/pacientes', 'users', 'Pacientes'],
  ['nova', '#/nova', 'plus', 'Novo', true],
  ['administrativo', '#/administrativo', 'calendar', 'Agenda'],
  ['mais', '#/mais', 'more', 'Mais'],
];
// itens que ficam no botão "Mais" do celular
export const NAV_MORE = NAV.filter(([k]) => !['painel', 'pacientes', 'administrativo'].includes(k));

// versão carimbada por tools/stamp.py (?v= no endereço deste arquivo)
const VERSAO = new URL(import.meta.url).searchParams.get('v') || 'teste';
const TAB_STAFF = [['administrativo', '#/administrativo', 'calendar', 'Agenda'], ['financeiro', '#/financeiro', 'wallet', 'Financeiro'], ['ajuda', '#/ajuda', 'help', 'Ajuda']];
const TAB_ADMIN = [['admin', '#/admin', 'home', 'Início'], ['config', '#/config?aba=seguranca', 'shield', 'Segurança']];

/* Profissão a partir da área de atuação, no feminino ou no masculino.
   Usa a escolha do perfil (credentials.tratamento: 'f' ou 'm'); sem ela, tenta pelo primeiro nome (termina em "a" → feminino). */
const PROFISSAO = {
  'Psicologia': ['Psicóloga', 'Psicólogo'], 'Fonoaudiologia': ['Fonoaudióloga', 'Fonoaudiólogo'], 'Fisioterapia': ['Fisioterapeuta', 'Fisioterapeuta'],
  'Nutrição': ['Nutricionista', 'Nutricionista'], 'Terapia Ocupacional': ['Terapeuta ocupacional', 'Terapeuta ocupacional'],
  'Medicina': ['Médica', 'Médico'], 'Psiquiatria': ['Médica psiquiatra', 'Médico psiquiatra'], 'Psiquiatria / Medicina': ['Médica', 'Médico'], 'Enfermagem': ['Enfermeira', 'Enfermeiro'], 'Serviço Social': ['Assistente social', 'Assistente social'],
};
export function profissao(p) {
  if (!p || !p.specialty || p.specialty === 'Outra') return (p && p.credentials && p.credentials.category) || 'Profissional';
  const par = PROFISSAO[p.specialty];
  if (!par) return p.specialty;
  const t = p.credentials && p.credentials.tratamento;
  const fem = t ? t === 'f' : /a$/i.test(String(p.full_name || '').trim().split(/\s+/)[0] || '');
  return par[fem ? 0 : 1];
}

export function shell(active) {
  const p = state.profile;
  const isPatient = p && p.role === 'patient';
  const isStaff = Boolean(p && p.role === 'secretary');
  const isAdm = Boolean(p && p.is_admin) || isStaff; // secretária usa a moldura simples: sem busca e sem "Novo"
  const NAV_STAFF = NAV.filter(([k]) => ['administrativo', 'financeiro', 'ajuda'].includes(k));
  const nav = isPatient ? NAV_PATIENT : isStaff ? NAV_STAFF : (p && p.is_admin ? [['admin', '#/admin', 'home', 'Início'], ['config', '#/config?aba=seguranca', 'shield', 'Minha segurança']] : NAV);
  const nt = settings.notice && settings.notice.on && settings.notice.text ? settings.notice : null;
  // A logo do profissional fica só nos documentos; na moldura aparece sempre a Potira.
  // Foto do perfil: a da conta Google (quando entrou pelo Google e ela tem foto); senão, as iniciais.
  const meta = state.user?.user_metadata || {};
  const foto = isStaff ? '' : String(meta.avatar_url || meta.picture || '');
  const home = isPatient ? '#/portal' : isStaff ? '#/administrativo' : isAdm ? '#/admin' : '#/painel';
  let railMin = false; try { railMin = localStorage.getItem('potira.menu.recolhido') === '1'; } catch { /* sem armazenamento */ }
  const quem = (isStaff ? p.staff_name : p?.full_name) || state.user?.email || '';
  const papel = isPatient ? 'Paciente' : isStaff ? `Secretária(o) de ${p.full_name}` : isAdm ? 'Administrador' : profissao(p);
  const isHome = ['painel', 'admin', 'portal'].includes(active) || (isStaff && active === 'administrativo');
  $('#app').innerHTML = `
    <div class="app ${railMin ? 'rail-min' : ''}">
      <button type="button" class="skip" id="skip">Pular para o conteúdo</button>
      <aside class="rail">
        <a class="brand" href="${home}" aria-label="Potira, início"><span class="brand-full">${logoMenu()}</span><span class="brand-sim">${simboloColorido()}</span></a>
        <nav class="nav" aria-label="Principal">
          ${nav.filter(([k]) => k !== 'ajuda').map(([k, h, ic, l]) => `<a href="${h}" class="${k === active ? 'on' : ''}" title="${esc(l)}" ${k === active ? 'aria-current="page"' : ''}>${icon(ic)}<span class="nl">${l}</span></a>`).join('')}
        </nav>
        ${nav.some(([k]) => k === 'ajuda') ? `<a class="rail-help ${active === 'ajuda' ? 'on' : ''}" href="#/ajuda" title="Ajuda e Suporte" ${active === 'ajuda' ? 'aria-current="page"' : ''}>${icon('help')}<span class="nl">Ajuda e Suporte</span></a>` : ''}
        <button type="button" class="rail-tog" id="rail-tog" title="Recolher ou abrir o menu" aria-label="${railMin ? 'Abrir menu' : 'Recolher menu'}" aria-pressed="${railMin}">${icon('left')}<span class="nl">Recolher menu</span></button>
        <div class="theme-row"><span>${icon('sun')}Tema</span><span class="theme-tog" role="group" aria-label="Tema"><button type="button" data-theme-set="light" title="Claro" aria-label="Tema claro">${icon('sun')}</button><button type="button" data-theme-set="dark" title="Escuro" aria-label="Tema escuro">${icon('moon')}</button></span></div>
      </aside>
      <div class="stage">
        <div class="topbar ${isHome ? 'top-home' : ''}">
          <a class="top-brand" href="${home}" aria-label="Potira, início"><span class="mark potira">${simboloColorido()}</span></a>
          <button class="icon-btn back-btn" id="go-back" title="Voltar" aria-label="Voltar">${icon('left')}</button>
          <button class="icon-btn theme-btn" data-theme-flip title="Alternar tema claro/escuro" aria-label="Alternar tema">${icon('moon')}</button>
          ${isPatient || isAdm ? '<span class="grow"></span>' : `
          <button class="search-trigger" id="open-search" aria-label="Buscar">${icon('search')}<span>Buscar paciente ou relatório</span><kbd>Ctrl K</kbd></button>
          <button class="icon-btn help-btn" id="open-help" title="Atalhos do teclado (?)" aria-label="Atalhos do teclado">${icon('info')}</button>
          <a class="btn bloom" href="#/nova" data-new>${icon('plus')}<span>Novo</span></a>`}
          <details class="top-user">
            <summary aria-label="Menu do perfil"><span class="tu-ic">${icon('users')}</span><span class="tu-nome">${esc(quem)}</span>${icon('chev', 'tu-seta')}<span class="avatar">${foto ? `<img src="${esc(foto)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${esc(initials(quem))}</span></summary>
            <div class="tu-menu" role="menu">
              <div class="tu-head"><b>${esc(quem)}</b><span>${esc(papel)}</span></div>
              ${isPatient || isStaff || isAdm ? '' : `<a href="#/config?aba=perfil" role="menuitem">${icon('users')}Meu perfil</a>`}
              <a href="#/sobre" role="menuitem">${icon('info')}Sobre a Potira</a>
              <button type="button" id="logout" role="menuitem">${icon('logout')}Sair</button>
            </div>
          </details>
        </div>
        ${nt ? `<div class="notice ${nt.level === 'warn' ? 'warn' : ''}" role="status">${icon('info')}<span>${esc(nt.text)}</span></div>` : ''}
        <main id="main" class="page"></main>
        <footer class="app-foot">
          <span class="af-seg">${icon('shield')}Seus dados estão seguros</span><span class="af-sep" aria-hidden="true"></span>
          <span class="af-seg af-lema">Potira · Cuidado, tecnologia e bem-estar</span>
          <span class="af-dir"><span>Versão ${esc(VERSAO)}</span><span class="af-on ${navigator.onLine ? '' : 'off'}" id="af-on">${navigator.onLine ? 'Online' : 'Sem internet'}</span></span>
        </footer>
      </div>
      ${isPatient ? '' : `<nav class="tabbar" aria-label="Atalhos" ${isAdm ? `style="grid-template-columns:repeat(${isStaff ? 3 : 2},1fr)"` : ''}>
        ${(isStaff ? TAB_STAFF : isAdm ? TAB_ADMIN : TAB).map(([k, h, ic, l, cta]) => `<a href="${h}" ${cta ? 'data-new' : ''} ${k === 'sair' ? 'data-logout' : ''} class="${k === active || (k === 'mais' && NAV_MORE.some(([m]) => m === active)) ? 'on' : ''} ${cta ? 'cta' : ''}">${cta ? `<span class="circle">${icon(ic)}</span>` : icon(ic)}${l}</a>`).join('')}
      </nav>`}
    </div>`;
  // tema claro/escuro direto no menu
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
  const markTheme = () => { const d = isDark(); $$('[data-theme-set]').forEach((b) => b.classList.toggle('on', (b.dataset.themeSet === 'dark') === d)); };
  $$('[data-theme-set]').forEach((b) => (b.onclick = () => { setLook({ theme: b.dataset.themeSet }); markTheme(); }));
  $$('[data-theme-flip]').forEach((b) => (b.onclick = () => { setLook({ theme: isDark() ? 'light' : 'dark' }); markTheme(); }));
  markTheme();
  const s = $('#open-search');
  if (s) s.onclick = () => import('./search.js').then((m) => m.openSearch());
  const rt = $('#rail-tog');
  if (rt) rt.onclick = () => {
    const min = !$('.app').classList.contains('rail-min');
    $('.app').classList.toggle('rail-min', min); rt.setAttribute('aria-pressed', String(min)); rt.setAttribute('aria-label', min ? 'Abrir menu' : 'Recolher menu');
    try { localStorage.setItem('potira.menu.recolhido', min ? '1' : '0'); } catch { /* sem armazenamento */ }
  };
  const um = $('.top-user');
  if (um) document.addEventListener('click', (e) => { if (um.open && !um.contains(e.target)) um.open = false; });
  const on = () => { const el = $('#af-on'); if (el) { el.textContent = navigator.onLine ? 'Online' : 'Sem internet'; el.classList.toggle('off', !navigator.onLine); } };
  window.onoffline = on; window.ononline = on;
  const skip = $('#skip');
  if (skip) skip.onclick = () => { const m = $('#main'); m.setAttribute('tabindex', '-1'); m.focus(); };
  // Voltar: usa o histórico do navegador; sem histórico, vai para o início do perfil.
  const back = $('#go-back');
  if (back) back.onclick = () => {
    if (history.length > 1) history.back();
    else location.hash = isPatient ? '#/portal' : isStaff ? '#/administrativo' : isAdm ? '#/admin' : '#/painel';
  };
  return $('#main');
}

export const loading = (main, text = 'Carregando') => {
  main.innerHTML = `<div role="status" aria-label="${esc(text)}"><div class="skel skel-h"></div><div class="skel skel-p"></div>
    <div class="skel-cards"><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div></div>
    <div class="skel skel-row"></div><div class="skel skel-row"></div><div class="skel skel-row"></div></div>`;
};

/** Estado vazio: ilustração simples, o que aconteceu e o próximo passo. */
export const emptyState = (title, text = '', action = '') => `<div class="empty">
  <svg class="art" viewBox="0 0 120 90" aria-hidden="true"><rect class="a" x="14" y="14" width="76" height="62" rx="10"/><path class="b" d="M30 36h44M30 48h30M30 60h38"/><circle class="c" cx="92" cy="60" r="14"/><path class="b" style="stroke:#fff" d="M86 60h12M92 54v12"/></svg>
  <b>${esc(title)}</b>${text ? `<p>${text}</p>` : ''}${action}</div>`;

/** Área de arrastar arquivo com prévia. onFile(file, setPreview) é chamado ao escolher. */
export function dropzone({ id, accept, title, hint, name = '' }) {
  return `<label class="drop" data-drop><input type="file" ${id ? `id="${id}"` : ''} ${name ? `name="${name}"` : ''} accept="${esc(accept)}">
    <span class="d-ico">${icon('download')}</span><span class="grow"><b>${esc(title)}</b><small>${esc(hint || 'Arraste o arquivo para cá ou clique para escolher.')}</small></span></label>`;
}
export function bindDrops(root = document, onPick, { preview = true } = {}) {
  $$('[data-drop]', root).forEach((z) => {
    const input = $('input[type=file]', z);
    const show = (file) => {
      if (!file || !preview) return;
      z.classList.add('has');
      const ico = $('.d-ico', z), b = $('b', z), sm = $('small', z);
      if (/^image\//.test(file.type)) { const u = URL.createObjectURL(file); ico.innerHTML = `<img src="${u}" alt="">`; }
      else ico.innerHTML = icon('check');
      b.textContent = file.name; sm.textContent = `${Math.max(1, Math.round(file.size / 1024))} KB · clique para trocar`;
    };
    input.addEventListener('change', () => { show(input.files[0]); if (onPick) onPick(input, input.files[0]); });
    ['dragenter', 'dragover'].forEach((ev) => z.addEventListener(ev, (e) => { e.preventDefault(); z.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => z.addEventListener(ev, (e) => { e.preventDefault(); z.classList.remove('over'); }));
    z.addEventListener('drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files[0]; if (!f) return;
      try { const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; } catch { /* navegador sem DataTransfer */ }
      input.dispatchEvent(new Event('change'));
    });
  });
}

export const pageHeader = (title, sub = '', actions = '') =>
  `<header class="head"><div class="grow"><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="row">${actions}</div></header>`;
export const backLink = (href, text) => `<a class="back" href="${href}">${icon('left')}${esc(text)}</a>`;
export { icon };

// Menus suspensos (<details class="menu">): clicar fora ou escolher um item fecha o que estiver aberto.
document.addEventListener('click', (e) => {
  document.querySelectorAll('details.menu[open]').forEach((m) => { if (!m.contains(e.target) || e.target.closest('.menu-list a, .menu-list button')) m.removeAttribute('open'); });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('details.menu[open]').forEach((m) => m.removeAttribute('open')); });

/** Janela "O que fazer agora?": cada ação é um botão grande; ao terminar a ação, a janela fecha. */
export function acoesModal(title, introHtml, acoes) {
  return openModal(title, `${introHtml}<div class="acoes-grid">${acoes.filter(Boolean).map((a, i) =>
    `<button type="button" class="acao-btn" data-acao="${i}">${icon(a.icon || 'check')}<span><b>${esc(a.label)}</b>${a.sub ? `<small>${esc(a.sub)}</small>` : ''}</span></button>`).join('')}</div>`,
  { cancelText: 'Fechar', wide: true, onOpen: (d) => {
    const lista = acoes.filter(Boolean);
    d.querySelectorAll('[data-acao]').forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      try { const r = await lista[+b.dataset.acao].run(d); if (r !== false) d.querySelector('[data-cancel]').click(); }
      catch (err) { toast(err.message || String(err), 'err'); }
      b.disabled = false;
    }));
  } });
}
