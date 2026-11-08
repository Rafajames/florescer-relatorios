import * as api from './api.js';
import { exportPdf } from './export.js';
import { $, esc, fmtDate, shell, loading, pageHeader, backLink, meta, callout, icon } from './ui.js';
import { state } from './state.js';
import { registryText } from './credentials.js';
import { bodyHtml } from './richtext.js';

const asProfessional = (r) => ({
  full_name: r.professional_name, specialty: r.professional_specialty,
  council_registry: r.professional_registry, clinic_name: r.clinic_name,
});

export async function renderPortal() {
  const main = shell('portal'); loading(main);
  const list = await api.portalReports();
  const pros = [...new Map(list.map((r) => [r.professional_name, r])).values()];
  const proCard = (r) => {
    const c = r.professional_credentials || {};
    const links = [['Instagram', c.instagram], ['Site', c.site], ['Rede', c.other]].filter(([, u]) => /^https?:\/\//.test(u || ''));
    return `<section class="panel pro-card"><h3>${esc(r.professional_name || 'Profissional')}</h3>
      ${meta([esc(c.category || r.professional_specialty || ''), esc(registryText(c) || r.professional_registry || '')])}
      ${links.length ? `<p class="small" style="margin:8px 0 0">${links.map(([l, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${l}</a>`).join(' · ')}</p>` : ''}</section>`;
  };
  main.innerHTML = pageHeader('Meus relatórios', 'Aqui aparecem os relatórios que seu profissional revisou e liberou para você.') +
    pros.map(proCard).join('') +
    (list.length ? `<div class="list">${list.map((r) => `
      <a class="li" href="#/portal/${r.id}">
        <div class="grow"><div class="t">${esc(r.title)}</div>
        ${meta([esc(r.professional_name || 'Profissional'), r.kind === 'periodo' ? `Período ${fmtDate(r.period_start)} a ${fmtDate(r.period_end)}` : fmtDate(r.session_date)])}</div>
        ${icon('right', 'go')}</a>`).join('')}</div>`
      : `<div class="empty"><b>Você ainda não tem relatórios liberados</b>
         Use o mesmo e-mail (${esc(state.user?.email || '')}) que seu profissional cadastrou. Quando ele liberar um relatório, ele aparecerá aqui.</div>`);
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
