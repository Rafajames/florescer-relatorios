import { state, settings } from './state.js';
import { icon } from './icons.js';
import { brandOf } from './brand.js';
import { setLook } from './theme.js';

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
  t.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  t.className = 'show ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = ''), kind === 'err' ? 5500 : 2600);
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
    const close = (v) => { d.close(); d.remove(); resolve(v); };
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
  ['relatorios', '#/relatorios', 'file', 'Relatórios'],
  ['periodo', '#/periodo', 'calendar', 'Relatório por período'],
  ['modelos', '#/modelos', 'layout', 'Modelos de documento'],
  ['administrativo', '#/administrativo', 'clipboard', 'Administrativo'],
  ['financeiro', '#/financeiro', 'wallet', 'Financeiro'],
  ['config', '#/config', 'sliders', 'Configurações'],
  ['ajuda', '#/ajuda', 'info', 'Ajuda'],
];
const NAV_SEC = { painel: 'Menu', administrativo: 'Gestão', config: 'Ajustes' };
const NAV_PATIENT = [['portal', '#/portal', 'file', 'Meus relatórios']];
const TAB = [
  ['painel', '#/painel', 'home', 'Início'],
  ['pacientes', '#/pacientes', 'users', 'Pacientes'],
  ['nova', '#/nova', 'plus', 'Novo', true],
  ['relatorios', '#/relatorios', 'file', 'Relatórios'],
  ['mais', '#/mais', 'more', 'Mais'],
];
// itens que ficam no botão "Mais" do celular
export const NAV_MORE = NAV.filter(([k]) => !['painel', 'pacientes', 'relatorios'].includes(k));

const TAB_STAFF = [['administrativo', '#/administrativo', 'clipboard', 'Agenda'], ['financeiro', '#/financeiro', 'wallet', 'Financeiro'], ['sair', '#', 'logout', 'Sair']];
const TAB_ADMIN = [['admin', '#/admin', 'home', 'Início'], ['config', '#/config?aba=seguranca', 'shield', 'Segurança'], ['sair', '#', 'logout', 'Sair']];

export function shell(active) {
  const p = state.profile;
  const isPatient = p && p.role === 'patient';
  const isStaff = Boolean(p && p.role === 'secretary');
  const isAdm = Boolean(p && p.is_admin) || isStaff; // secretária usa a moldura simples: sem busca e sem "Novo"
  const NAV_STAFF = NAV.filter(([k]) => ['administrativo', 'financeiro', 'ajuda'].includes(k));
  const nav = isPatient ? NAV_PATIENT : isStaff ? NAV_STAFF : (p && p.is_admin ? [['admin', '#/admin', 'home', 'Início'], ['config', '#/config?aba=seguranca', 'shield', 'Minha segurança']] : NAV);
  const nt = settings.notice && settings.notice.on && settings.notice.text ? settings.notice : null;
  const br = isPatient ? { logo: '', org_name: '' } : brandOf(p);
  $('#app').innerHTML = `
    <div class="app">
      <aside class="rail">
        <a class="brand" href="${isPatient ? '#/portal' : isStaff ? '#/administrativo' : isAdm ? '#/admin' : '#/painel'}"><span class="mark ${br.logo ? 'has-logo' : ''}">${br.logo ? `<img src="${esc(br.logo)}" alt="">` : icon('flower')}</span><b>${esc(br.org_name || 'Potira')}</b></a>
        <nav class="nav" aria-label="Principal">
          ${nav.map(([k, h, ic, l]) => `${NAV_SEC[k] && nav === NAV ? `<span class="nav-sec">${NAV_SEC[k]}</span>` : ''}<a href="${h}" class="${k === active ? 'on' : ''}" ${k === active ? 'aria-current="page"' : ''}>${icon(ic)}${l}</a>`).join('')}
        </nav>
        <div class="theme-row"><span>${icon('sun')}Tema</span><span class="theme-tog" role="group" aria-label="Tema"><button type="button" data-theme-set="light" title="Claro" aria-label="Tema claro">${icon('sun')}</button><button type="button" data-theme-set="dark" title="Escuro" aria-label="Tema escuro">${icon('moon')}</button></span></div>
        <a class="rail-credit" href="#/sobre">${icon('info')}Sobre a Potira</a>
        <div class="rail-foot">
          <span class="avatar">${esc(initials((isStaff ? p.staff_name : p?.full_name) || state.user?.email))}</span>
          <div class="who"><b>${esc((isStaff ? p.staff_name : p?.full_name) || state.user?.email || '')}</b><span>${esc(isPatient ? 'Paciente' : isStaff ? `Secretária(o) de ${p.full_name}` : isAdm ? 'Administrador' : (p?.specialty || 'Profissional'))}</span></div>
          <button class="icon-btn" id="logout" title="Sair" aria-label="Sair">${icon('logout')}</button>
        </div>
      </aside>
      <div class="stage">
        <div class="topbar">
          <button class="icon-btn back-btn" id="go-back" title="Voltar" aria-label="Voltar">${icon('left')}</button>
          <button class="icon-btn theme-btn" data-theme-flip title="Alternar tema claro/escuro" aria-label="Alternar tema">${icon('moon')}</button>
          ${isPatient || isAdm ? '<span class="grow"></span>' : `
          <button class="search-trigger" id="open-search" aria-label="Buscar">${icon('search')}<span>Buscar paciente ou relatório</span><kbd>Ctrl K</kbd></button>
          <button class="icon-btn help-btn" id="open-help" title="Atalhos do teclado (?)" aria-label="Atalhos do teclado">${icon('info')}</button>
          <a class="btn bloom" href="#/nova" data-new>${icon('plus')}<span>Novo</span></a>`}
        </div>
        ${nt ? `<div class="notice ${nt.level === 'warn' ? 'warn' : ''}" role="status">${icon('info')}<span>${esc(nt.text)}</span></div>` : ''}
        <main id="main" class="page"></main>
      </div>
      ${isPatient ? '' : `<nav class="tabbar" aria-label="Atalhos" ${isAdm ? 'style="grid-template-columns:repeat(3,1fr)"' : ''}>
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
