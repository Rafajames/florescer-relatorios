import { esc, fmtDate } from './ui.js';
import { settings } from './state.js';
import { brandOf, darken } from './brand.js';
import { bodyHtml } from './richtext.js';

const slug = (s) => String(s || 'relatorio').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9\- ]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'relatorio';

const para = (t) => esc(t).replace(/\n/g, '<br>');

export const KIND_LABEL = { sessao: 'Evolução', anamnese: 'Anamnese', periodo: 'Relatório por período', documento: 'Documento' };

const FONTS = { classica: "Georgia, 'Times New Roman', serif", moderna: "Calibri, Arial, sans-serif" };
const MARGINS = { estreita: '14mm 14mm', normal: '22mm 20mm', ampla: '28mm 26mm' };

const css = (c, st = {}) => `
  @page { margin: ${MARGINS[st.doc_margin] || MARGINS.normal}; }
  body { font-family: ${FONTS[st.doc_font] || FONTS.moderna}; font-size: 11.5pt; color: #1b2420; line-height: 1.5; }
  ${st.doc_header === 'center' ? '.hdr { text-align: center; } .hdr table { margin: 0 auto; width: auto; } .logo { margin: 0 14px 0 0; }' : ''}
  .hdr { border-bottom: 2px solid ${c}; padding-bottom: 8px; margin-bottom: 16px; }
  .hdr table { width: 100%; border-collapse: collapse; } .hdr td { vertical-align: middle; padding: 0; }
  .logo { max-height: 64px; max-width: 160px; margin-right: 14px; }
  .clinic { font-size: 15pt; font-weight: bold; color: ${c}; }
  .prof { font-size: 10.5pt; color: #4a554d; }
  .tag { font-size: 9.5pt; color: #6a746d; }
  h1 { font-size: 17pt; color: ${c}; margin: 8px 0 10px; }
  h2 { font-size: 12.5pt; color: ${c}; margin: 16px 0 4px; }
  h3 { font-size: 12pt; color: ${darken(c, 0.1)}; margin: 22px 0 4px; }
  table.meta td { padding: 2px 14px 2px 0; font-size: 10.5pt; }
  .lab { color: #4a554d; }
  p { margin: 0 0 6px; } .rt table { border-collapse: collapse; width: 100%; } .rt td, .rt th { border: 1px solid #999; padding: 4px 6px; } .rt h3 { font-size: 12pt; margin: 8px 0 3px; } .rt ul, .rt ol { margin: 0 0 6px 20px; padding: 0; }
  .sign { margin-top: 40px; width: 300px; font-size: 10.5pt; }
  .sign img { max-height: 70px; max-width: 240px; display: block; }
  .sign .line { border-top: 1px solid #333; padding-top: 4px; }
  .foot { margin-top: 28px; font-size: 8.5pt; color: #6a746d; border-top: 1px solid #ccc; padding-top: 6px; }
  .brk { page-break-before: always; }`;

function header(professional) {
  const b = brandOf(professional);
  const reg = [professional.specialty, professional.council_registry].filter(Boolean).join(' · ');
  const name = b.org_name || professional.clinic_name || professional.full_name || '';
  return {
    b, reg,
    html: `<div class="hdr"><table><tr>
      ${b.logo ? `<td style="width:1%;white-space:nowrap"><img class="logo" src="${b.logo}" alt=""></td>` : ''}
      <td><div class="clinic">${esc(name)}</div>
      <div class="prof">${esc(professional.full_name || '')}${reg ? ' — ' + esc(reg) : ''}</div>
      ${b.tagline ? `<div class="tag">${esc(b.tagline)}</div>` : ''}</td></tr></table></div>`,
  };
}

const footer = (b, ai) => `<div class="foot">${(b.footer || settings.doc_footer) ? esc(b.footer || settings.doc_footer) + '<br>' : ''}${ai ? 'Documento elaborado com apoio de ferramenta de inteligência artificial e revisado pelo(a) profissional responsável. ' : ''}Documento confidencial, contém dados pessoais sensíveis de saúde (LGPD – Lei nº 13.709/2018).</div>`;

const signature = (professional, b, reg) => `<div class="sign">${b.signature ? `<img src="${b.signature}" alt="">` : ''}<div class="line">${esc(professional.full_name || '')}<br>${esc(reg)}</div></div>`;

const whenOf = (r) => (r.kind === 'periodo' && r.period_start ? `${fmtDate(r.period_start)} a ${fmtDate(r.period_end)}` : fmtDate(r.session_date));

/** report: { title, kind, session_date, period_start, period_end, ai_generated } */
function buildHtml({ report, patientName, professional, sections }) {
  const h = header(professional);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>${css(h.b.color, h.b)}</style></head><body>
  ${h.html}
  <h1>${esc(report.title)}</h1>
  <table class="meta">
    <tr><td class="lab">Paciente:</td><td><b>${esc(patientName || '')}</b></td></tr>
    <tr><td class="lab">${report.kind === 'periodo' ? 'Período:' : 'Data:'}</td><td>${esc(whenOf(report))}</td></tr>
  </table>
  ${sections.map((s) => `${report && report.kind === 'documento' ? '' : `<h2>${esc(s.title)}</h2>`}<div class="rt">${bodyHtml(s)}</div>`).join('\n')}
  ${signature(professional, h.b, h.reg)}
  ${footer(h.b, report.ai_generated)}
</body></html>`;
}

/** Prontuário completo: anamnese, evoluções e relatórios, em ordem cronológica. */
function buildDossier({ patient, professional, reports, only }) {
  const h = header(professional);
  const order = { anamnese: 0, sessao: 1, periodo: 2, documento: 3 };
  const list = [...reports].sort((a, b) => (order[a.kind] - order[b.kind]) || String(a.session_date).localeCompare(String(b.session_date)));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Prontuário — ${esc(patient.name)}</title><style>${css(h.b.color, h.b)}</style></head><body>
  ${h.html}
  <h1>Prontuário</h1>
  <table class="meta"><tr><td class="lab">Paciente:</td><td><b>${esc(patient.name)}</b></td></tr>
  ${patient.birth_date ? `<tr><td class="lab">Nascimento:</td><td>${esc(fmtDate(patient.birth_date))}</td></tr>` : ''}
  <tr><td class="lab">Emitido em:</td><td>${esc(fmtDate(new Date().toISOString()))}</td></tr>
  <tr><td class="lab">Registros:</td><td>${list.length}</td></tr></table>
  ${list.map((r, i) => `<h3 ${i ? 'class="brk"' : ''}>${esc(KIND_LABEL[r.kind] || 'Registro')} — ${esc(r.title)} (${esc(whenOf(r))})</h3>
    ${(only ? (r.sections || []).filter((s) => s.patient_visible !== false) : (r.sections || [])).map((s) => `${r.kind === 'documento' ? '' : `<h2>${esc(s.title)}</h2>`}<div class="rt">${bodyHtml(s)}</div>`).join('\n')}`).join('\n')}
  ${signature(professional, h.b, h.reg)}
  ${footer(h.b, list.some((r) => r.ai_generated))}
</body></html>`;
}

const toWord = (html, name) => {
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(name)}.doc`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
const toPdf = (html) => {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.onload = () => {
    f.contentWindow.focus();
    f.contentWindow.print();
    setTimeout(() => f.remove(), 60000);
  };
  f.srcdoc = html;
};

export const previewHtml = (args) => buildHtml(args);
export const exportWord = (args) => toWord(buildHtml(args), args.report.title);
export const exportPdf = (args) => toPdf(buildHtml(args));
export const exportDossierWord = (args) => toWord(buildDossier(args), `Prontuario ${args.patient.name}`);
export const exportDossierPdf = (args) => toPdf(buildDossier(args));
