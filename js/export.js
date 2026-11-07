import { esc, fmtDate } from './ui.js';

const slug = (s) => String(s || 'relatorio').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9\- ]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'relatorio';

const para = (t) => esc(t).replace(/\n/g, '<br>');

/**
 * report: { title, kind, session_date, period_start, period_end, ai_generated }
 * professional: { full_name, specialty, council_registry, clinic_name }
 */
function buildHtml({ report, patientName, professional, sections }) {
  const when = report.kind === 'periodo' && report.period_start
    ? `${fmtDate(report.period_start)} a ${fmtDate(report.period_end)}`
    : fmtDate(report.session_date);
  const reg = [professional.specialty, professional.council_registry].filter(Boolean).join(' · ');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(report.title)}</title>
<style>
  @page { margin: 22mm 20mm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 11.5pt; color: #1b2420; line-height: 1.5; }
  .hdr { border-bottom: 2px solid #2F4B3C; padding-bottom: 8px; margin-bottom: 16px; }
  .clinic { font-size: 15pt; font-weight: bold; color: #2F4B3C; }
  .prof { font-size: 10.5pt; color: #4a554d; }
  h1 { font-size: 17pt; color: #2F4B3C; margin: 8px 0 10px; }
  h2 { font-size: 12.5pt; color: #2F4B3C; margin: 16px 0 4px; }
  table.meta td { padding: 2px 14px 2px 0; font-size: 10.5pt; }
  .lab { color: #4a554d; }
  p { margin: 0 0 6px; }
  .sign { margin-top: 48px; width: 280px; border-top: 1px solid #333; padding-top: 4px; font-size: 10.5pt; }
  .foot { margin-top: 28px; font-size: 8.5pt; color: #6a746d; border-top: 1px solid #ccc; padding-top: 6px; }
</style></head><body>
  <div class="hdr">
    <div class="clinic">${esc(professional.clinic_name || professional.full_name || '')}</div>
    <div class="prof">${esc(professional.full_name || '')}${reg ? ' — ' + esc(reg) : ''}</div>
  </div>
  <h1>${esc(report.title)}</h1>
  <table class="meta">
    <tr><td class="lab">Paciente:</td><td><b>${esc(patientName || '')}</b></td></tr>
    <tr><td class="lab">${report.kind === 'periodo' ? 'Período:' : 'Data:'}</td><td>${esc(when)}</td></tr>
  </table>
  ${sections.map((s) => `<h2>${esc(s.title)}</h2><p>${para(s.text)}</p>`).join('\n')}
  <div class="sign">${esc(professional.full_name || '')}<br>${esc(reg)}</div>
  <div class="foot">${report.ai_generated ? 'Documento elaborado com apoio de ferramenta de inteligência artificial e revisado pelo(a) profissional responsável. ' : ''}Documento confidencial, contém dados pessoais sensíveis de saúde (LGPD – Lei nº 13.709/2018).</div>
</body></html>`;
}

export function exportWord(args) {
  const html = buildHtml(args);
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(args.report.title)}.doc`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function exportPdf(args) {
  const html = buildHtml(args);
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.onload = () => {
    f.contentWindow.focus();
    f.contentWindow.print();
    setTimeout(() => f.remove(), 60000);
  };
  f.srcdoc = html;
}
