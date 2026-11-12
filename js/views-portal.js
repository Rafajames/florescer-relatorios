import * as api from './api.js';
import { exportPdf } from './export.js';
import { $, esc, fmtDate, shell, loading, pageHeader, backLink, meta, callout, icon } from './ui.js';
import { state } from './state.js';
import { registryText } from './credentials.js';
import { bodyHtml } from './richtext.js';

const alertar = (msg) => import('./ui.js').then((u) => u.toast(msg, 'err'));
const asProfessional = (r) => ({
  full_name: r.professional_name, specialty: r.professional_specialty,
  council_registry: r.professional_registry, clinic_name: r.clinic_name,
});

export async function renderPortal() {
  const main = shell('portal'); loading(main);
  const list = await api.portalReports();
  let ov = { appointments: [], receipts: [] };
  try { ov = (await api.portalOverview()) || ov; } catch { /* banco sem a função: o portal segue só com os relatórios */ }
  const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const quando = (a) => `${new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}${a.time ? ' às ' + String(a.time).slice(0, 5) : ''}`;
  const sessoesHtml = ov.appointments.length ? `<section class="panel"><h2>Próximas sessões</h2>
    <div class="table">${ov.appointments.map((a) => `<div class="tr" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="grow"><b>${esc(quando(a))}</b><br><small class="muted">com ${esc(a.professional_name || 'profissional')}${a.confirm_status === 'confirmado' ? ' · você confirmou' : a.confirm_status === 'remarcar' ? ' · você pediu para remarcar' : ''}</small></span>
      <button class="btn sm ${a.confirm_status === 'confirmado' ? 'quiet' : ''}" data-pc="${a.id}" data-r="confirmado">Confirmo</button>
      <button class="btn quiet sm" data-pc="${a.id}" data-r="remarcar">Preciso remarcar</button></div>`).join('')}</div></section>` : '';
  const recibosHtml = ov.receipts.length ? `<section class="panel"><h2>Recibos</h2>
    <div class="table">${ov.receipts.map((r) => `<div class="tr" style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <span>Recibo nº ${String(r.numero).padStart(4, '0')} · ${fmtDate(r.issued_on)}<small class="muted"> · ${esc(r.professional_name || '')}</small></span><b>${brl(r.total)}</b></div>`).join('')}</div>
    <p class="muted small" style="margin:10px 0 0">Para receber o recibo em PDF, peça ao(à) profissional.</p></section>` : '';
  const pros = [...new Map(list.map((r) => [r.professional_name, r])).values()];
  const proCard = (r) => {
    const c = r.professional_credentials || {};
    const links = [['Instagram', c.instagram], ['Site', c.site], ['Rede', c.other]].filter(([, u]) => /^https?:\/\//.test(u || ''));
    return `<section class="panel pro-card"><h3>${esc(r.professional_name || 'Profissional')}</h3>
      ${meta([esc(c.category || r.professional_specialty || ''), esc(registryText(c) || r.professional_registry || '')])}
      ${links.length ? `<p class="small" style="margin:8px 0 0">${links.map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${l}</a>`).join(' · ')}</p>` : ''}</section>`;
  };
  main.innerHTML = pageHeader('Meus relatórios', 'Aqui aparecem os relatórios que seu profissional revisou e liberou para você.') +
    pros.map(proCard).join('') + sessoesHtml +
    (list.length ? `<div class="list">${list.map((r) => `
      <a class="li" href="#/portal/${r.id}">
        <div class="grow"><div class="t">${esc(r.title)}</div>
        ${meta([esc(r.professional_name || 'Profissional'), r.kind === 'periodo' ? `Período ${fmtDate(r.period_start)} a ${fmtDate(r.period_end)}` : fmtDate(r.session_date)])}</div>
        ${icon('right', 'go')}</a>`).join('')}</div>`
      : `<div class="empty"><b>Você ainda não tem relatórios liberados</b>
         Use o mesmo e-mail (${esc(state.user?.email || '')}) que seu profissional cadastrou. Quando ele liberar um relatório, ele aparecerá aqui.</div>`) + recibosHtml;
  main.querySelectorAll('[data-pc]').forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try { await api.portalConfirm(b.dataset.pc, b.dataset.r); renderPortal(); }
    catch { b.disabled = false; alertar('Não consegui registrar a resposta. Tente de novo.'); }
  }));
}

export async function renderPortalReport(id) {
  const main = shell('portal'); loading(main);
  const r = (await api.portalReports()).find((x) => x.id === id);
  if (!r) { main.innerHTML = backLink('#/portal', 'Meus relatórios') + '<div class="empty"><b>Relatório não encontrado</b>Ele pode ter sido retirado pelo profissional.</div>'; return; }
  main.innerHTML = backLink('#/portal', 'Meus relatórios') +
    pageHeader(r.title, meta([esc(r.professional_name || ''), esc(r.professional_specialty || ''), esc(r.professional_registry || '')]),
      `<button class="btn quiet" id="pdf">${icon('download')}Baixar ou imprimir PDF</button>`) +
    (r.ai_generated ? callout('<p>Documento elaborado com apoio de ferramenta de inteligência artificial e revisado pelo(a) profissional responsável.</p>') : '') + `
    <article class="sheet">
      <div class="sheet-head"><b>${esc(r.clinic_name || r.professional_name || '')}</b><span>${esc(r.professional_name || '')}${r.professional_specialty ? ', ' + esc(r.professional_specialty) : ''}</span></div>
      ${r.sections.map((s) => `<div class="sec ${r.kind === 'documento' ? 'doc-free' : ''}"><div class="sec-side"><div class="sec-title" style="border:0;font-weight:600;color:var(--petrol)">${esc(s.title)}</div></div><div class="rt-view" style="font:17px/1.65 var(--serif)">${bodyHtml(s)}</div></div>`).join('')}
    </article>`;
  $('#pdf').onclick = () => exportPdf({
    report: r, patientName: state.profile?.full_name || '', professional: asProfessional(r), sections: r.sections,
  });
}
