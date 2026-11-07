import { state } from './state.js';
import { icon } from './icons.js';

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
  t.textContent = msg;
  t.className = 'show ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = ''), kind === 'err' ? 5500 : 2600);
}

export function openModal(title, bodyHtml, { okText = 'Salvar', cancelText = 'Cancelar', onOk, onOpen, wide = false } = {}) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'modal' + (wide ? ' wide' : '');
    d.innerHTML = `<form method="dialog">
      <h3>${esc(title)}</h3>
      <div class="modal-body">${bodyHtml}</div>
      <div class="row end">
        <button type="button" class="btn quiet" data-cancel>${esc(cancelText)}</button>
        ${onOk ? `<button type="submit" class="btn" data-ok>${esc(okText)}</button>` : ''}
      </div></form>`;
    document.body.appendChild(d);
    const close = (v) => { d.close(); d.remove(); resolve(v); };
    $('[data-cancel]', d).onclick = () => close(null);
    d.addEventListener('cancel', (e) => { e.preventDefault(); close(null); });
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
  ['relatorios', '#/relatorios', 'file', 'Relatórios'],
  ['periodo', '#/periodo', 'calendar', 'Por período'],
  ['modelos', '#/modelos', 'layout', 'Modelos'],
  ['config', '#/config', 'sliders', 'Configurações'],
];
const NAV_PATIENT = [['portal', '#/portal', 'file', 'Meus relatórios']];
const TAB = [
  ['painel', '#/painel', 'home', 'Início'],
  ['pacientes', '#/pacientes', 'users', 'Pacientes'],
  ['nova', '#/nova', 'plus', 'Nova', true],
  ['relatorios', '#/relatorios', 'file', 'Relatórios'],
  ['config', '#/config', 'sliders', 'Ajustes'],
];

export function shell(active) {
  const p = state.profile;
  const isPatient = p && p.role === 'patient';
  const nav = isPatient ? NAV_PATIENT : NAV;
  $('#app').innerHTML = `
    <div class="app">
      <aside class="rail">
        <a class="brand" href="${isPatient ? '#/portal' : '#/painel'}"><span class="mark">${icon('flower')}</span><b>Florescer</b></a>
        <nav class="nav" aria-label="Principal">
          ${nav.map(([k, h, ic, l]) => `<a href="${h}" class="${k === active ? 'on' : ''}" ${k === active ? 'aria-current="page"' : ''}>${icon(ic)}${l}</a>`).join('')}
        </nav>
        <div class="rail-foot">
          <span class="avatar">${esc(initials(p?.full_name || state.user?.email))}</span>
          <div class="who"><b>${esc(p?.full_name || state.user?.email || '')}</b><span>${esc(isPatient ? 'Paciente' : (p?.specialty || 'Profissional'))}</span></div>
          <button class="icon-btn" id="logout" title="Sair" aria-label="Sair">${icon('logout')}</button>
        </div>
      </aside>
      <div class="stage">
        ${isPatient ? '' : `<div class="topbar">
          <button class="search-trigger" id="open-search" aria-label="Buscar">${icon('search')}<span>Buscar paciente ou relatório</span><kbd>Ctrl K</kbd></button>
          <a class="btn bloom" href="#/nova">${icon('plus')}<span>Nova sessão</span></a>
        </div>`}
        <main id="main" class="page"></main>
      </div>
      ${isPatient ? '' : `<nav class="tabbar" aria-label="Atalhos">
        ${TAB.map(([k, h, ic, l, cta]) => `<a href="${h}" class="${k === active ? 'on' : ''} ${cta ? 'cta' : ''}">${cta ? `<span class="circle">${icon(ic)}</span>` : icon(ic)}${l}</a>`).join('')}
      </nav>`}
    </div>`;
  const s = $('#open-search');
  if (s) s.onclick = () => import('./search.js').then((m) => m.openSearch());
  return $('#main');
}

export const loading = (main, text = 'Carregando…') => { main.innerHTML = `<p class="muted pad">${esc(text)}</p>`; };
export const pageHeader = (title, sub = '', actions = '') =>
  `<header class="head"><div class="grow"><h1>${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="row">${actions}</div></header>`;
export const backLink = (href, text) => `<a class="back" href="${href}">${icon('left')}${esc(text)}</a>`;
export { icon };
