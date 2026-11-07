import * as api from './api.js';
import { exportPdf } from './export.js';
import { $, $$, esc, fmtDate, shell, loading, pageHeader, toast } from './ui.js';
import { state } from './state.js';

const asProfessional = (r) => ({
  full_name: r.professional_name, specialty: r.professional_specialty,
  council_registry: r.professional_registry, clinic_name: r.clinic_name,
});

export async function renderPortal() {
  const main = shell('portal'); loading(main);
  const list = await api.portalReports();
  main.innerHTML = pageHeader('Meus relatórios', 'Aqui aparecem apenas os relatórios que seu profissional revisou e liberou para você.') +
    (list.length ? `<div class="card">${list.map((r) => `
      <a class="row-item" href="#/portal/${r.id}">
        <div><div class="t">${esc(r.title)}</div>
        <div class="muted small">${esc(r.professional_name || 'Profissional')} · ${r.kind === 'periodo' ? `Período ${fmtDate(r.period_start)} a ${fmtDate(r.period_end)}` : fmtDate(r.session_date)}</div></div>
        <span class="muted">Abrir →</span></a>`).join('')}</div>`
      : `<div class="card"><p>Você ainda não tem relatórios liberados.</p>
         <p class="muted small">Use o mesmo e-mail (${esc(state.user?.email || '')}) que seu profissional cadastrou para você. Quando ele liberar um relatório, ele aparecerá aqui.</p></div>`);
}

export async function renderPortalReport(id) {
  const main = shell('portal'); loading(main);
  const r = (await api.portalReports()).find((x) => x.id === id);
  if (!r) { main.innerHTML = '<p class="pad">Relatório não encontrado ou não está mais disponível.</p><a href="#/portal">Voltar</a>'; return; }
  main.innerHTML = `
    <p class="crumb"><a href="#/portal">← Meus relatórios</a></p>
    ${pageHeader(r.title, `${esc(r.professional_name || '')}${r.professional_specialty ? ' · ' + esc(r.professional_specialty) : ''}${r.professional_registry ? ' · ' + esc(r.professional_registry) : ''}`,
      '<button class="btn ghost" id="pdf">Baixar / imprimir PDF</button>')}
    ${r.ai_generated ? '<div class="notice">Documento elaborado com apoio de ferramenta de inteligência artificial e revisado pelo(a) profissional responsável.</div>' : ''}
    ${r.sections.map((s) => `<section class="card"><h3>${esc(s.title)}</h3><p class="pre">${esc(s.text)}</p></section>`).join('')}`;
  $('#pdf').onclick = () => exportPdf({
    report: r, patientName: state.profile?.full_name || '', professional: asProfessional(r), sections: r.sections,
  });
  void $$; void toast;
}
