import { state } from './state.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('pt-BR');
};
export const fmtDateTime = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
export const daysAgoISO = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function toast(msg, kind = 'ok') {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'show ' + kind;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = ''), kind === 'err' ? 5000 : 2600);
}

export function openModal(title, bodyHtml, { okText = 'Salvar', cancelText = 'Cancelar', onOk, wide = false } = {}) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'modal' + (wide ? ' wide' : '');
    d.innerHTML = `<form method="dialog">
      <h3>${esc(title)}</h3>
      <div class="modal-body">${bodyHtml}</div>
      <div class="row end">
        <button type="button" class="btn ghost" data-cancel>${esc(cancelText)}</button>
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
    const first = $('input,select,textarea', d); if (first) first.focus();
  });
}
export const confirmBox = (msg, okText = 'Confirmar') =>
  openModal('Confirmação', `<p>${esc(msg)}</p>`, { okText, onOk: () => true }).then((r) => r === true);

/** Executa fn com o botão desabilitado e texto de progresso. */
export async function busy(btn, text, fn) {
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = text;
  try { return await fn(); }
  catch (err) { toast(err.message || String(err), 'err'); }
  finally { btn.disabled = false; btn.textContent = old; }
}

export const autosize = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };

export const chip = (text, kind = '') => `<span class="chip ${kind}">${esc(text)}</span>`;
export const statusChip = (r) =>
  r.released_to_patient ? chip('Liberado ao paciente', 'blue')
    : r.status === 'revisado' ? chip('Revisado', 'green') : chip('Rascunho', 'amber');

/* ---------- layout ---------- */
const NAV = [
  ['painel', '#/painel', 'Painel'],
  ['pacientes', '#/pacientes', 'Pacientes'],
  ['nova', '#/nova', 'Nova sessão'],
  ['periodo', '#/periodo', 'Relatório por período'],
  ['modelos', '#/modelos', 'Modelos'],
  ['config', '#/config', 'Configurações'],
];

export function shell(active) {
  const p = state.profile;
  const isPatient = p && p.role === 'patient';
  const nav = isPatient ? [['portal', '#/portal', 'Meus relatórios']] : NAV;
  $('#app').innerHTML = `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand"><span class="leaf">🌱</span><span class="brand-name">Florescer</span><span class="brand-sub">Relatórios</span></div>
        <nav>${nav.map(([k, h, l]) => `<a href="${h}" class="${k === active ? 'active' : ''}">${l}</a>`).join('')}</nav>
        <div class="side-foot">
          <div class="who">${esc(p?.full_name || state.user?.email || '')}</div>
          <div class="who-sub">${esc(isPatient ? 'Paciente' : (p?.specialty || 'Profissional'))}</div>
          <button class="link" id="logout">Sair</button>
        </div>
      </aside>
      <main id="main" class="main"></main>
    </div>`;
  return $('#main');
}

export const loading = (main, text = 'Carregando…') => { main.innerHTML = `<p class="muted pad">${esc(text)}</p>`; };
export const pageHeader = (title, sub = '', actions = '') =>
  `<header class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="row">${actions}</div></header>`;
