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

const contactRows = (b) => {
  const c = b.contact || {};
  const top = [c.phone && `WhatsApp ${c.phone}`, c.instagram && `Instagram ${c.instagram}`, c.email && `E-mail ${c.email}`].filter(Boolean);
  const rows = [];
  if (top.length) rows.push(top.map((x) => esc(x)).join(' &nbsp;·&nbsp; '));
  if (c.address) rows.push(esc(c.address));
  return rows.length ? `<div style="text-align:center;color:${b.accent || '#B83D6F'};font-size:9.5pt;margin-bottom:4px">${rows.join('<br>')}</div>` : '';
};
const footer = (b, ai) => `<div class="foot">${contactRows(b)}${(b.footer || settings.doc_footer) ? esc(b.footer || settings.doc_footer) + '<br>' : ''}${ai ? 'Documento elaborado com apoio de ferramenta de inteligência artificial e revisado pelo(a) profissional responsável. ' : ''}Documento confidencial, contém dados pessoais sensíveis de saúde (LGPD – Lei nº 13.709/2018).</div>`;

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

/* ---------- Administrativo: folha de frequência ---------- */
export const ATT_STATUS = { agendado: 'Agendado', realizado: 'Realizado', falta: 'Falta', falta_justificada: 'Falta justificada', cancelado: 'Cancelado' };
/** { professional, patientName, approach, insurer, period, rows:[{date,time,status}], minRows } */
function buildAttendance({ professional, patientName, approach, insurer, period, rows, minRows = 10 }) {
  const h = header(professional);
  const reg = professional.council_registry ? ` (${professional.council_registry})` : '';
  const lines = [...rows];
  while (lines.length < minRows) lines.push(null);
  const td = 'border:1px solid #777;padding:7px 6px;font-size:10.5pt';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Frequência — ${esc(patientName)}</title><style>${css(h.b.color, h.b)}</style></head><body>
  ${h.html}
  <h1 style="text-align:center">FREQUÊNCIA DE ATENDIMENTO${professional.specialty ? ' – ' + esc(professional.specialty.toUpperCase()) : ''}</h1>
  <table class="meta">
    <tr><td class="lab">Paciente:</td><td><b>${esc(patientName || '')}</b></td></tr>
    <tr><td class="lab">Profissional responsável:</td><td>${esc(professional.full_name || '')}${esc(reg)}</td></tr>
    ${approach ? `<tr><td class="lab">Esp. de atendimento:</td><td>${esc(approach)}</td></tr>` : ''}
    <tr><td class="lab">Convênio:</td><td>${esc(insurer || 'Particular')}</td></tr>
    ${period ? `<tr><td class="lab">Período:</td><td>${esc(period)}</td></tr>` : ''}
  </table>
  <table style="width:100%;border-collapse:collapse;margin-top:14px">
    <tr style="background:#f1f4f5">${['#', 'Data', 'Situação', 'Pagamento', 'Responsável', 'Profissional'].map((c, i) => `<th style="${td};text-align:left;${i === 0 ? 'width:28px' : i === 1 ? 'width:120px' : i === 2 ? 'width:95px' : ''}">${c}</th>`).join('')}</tr>
    ${lines.map((r, i) => `<tr><td style="${td}">${i + 1}</td><td style="${td}">${r ? esc(fmtDate(r.date)) + (r.time ? ' ' + esc(String(r.time).slice(0, 5)) : '') : ''}</td><td style="${td}">${r ? esc(ATT_STATUS[r.status] || '') : ''}</td><td style="${td}"></td><td style="${td}"></td><td style="${td}"></td></tr>`).join('')}
  </table>
  ${signature(professional, h.b, h.reg)}
  ${footer(h.b, false)}
</body></html>`;
}
export const exportAttendancePdf = (args) => toPdf(buildAttendance(args));
export const exportAttendanceWord = (args) => toWord(buildAttendance(args), `Frequencia ${args.patientName} ${args.period || ''}`);

/* ---------- Financeiro e declarações ---------- */
export const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const docPage = (title, professional, body) => {
  const h = header(professional);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css(h.b.color, h.b)}</style></head><body>
  ${h.html}
  <h1 style="text-align:center">${esc(title)}</h1>
  ${body}
  ${signature(professional, h.b, h.reg)}
  ${footer(h.b, false)}
</body></html>`;
};
const payBlock = (pay = {}) => {
  const rows = [['Banco', pay.bank], ['Agência', pay.agency], ['Conta', pay.account], ['Titular', pay.holder], ['PIX', pay.pix], ['Documento', pay.doc]].filter((r) => r[1]);
  if (!rows.length) return '';
  return `<h2>Dados para pagamento</h2><table class="meta">${rows.map(([k, v]) => `<tr><td class="lab">${k}:</td><td>${esc(v)}</td></tr>`).join('')}</table>`
    + (pay.note ? `<p>${esc(pay.note)}</p>` : '');
};

/** args: { professional, patientName, specialty, sessionsPerMonth, unitPrice, monthLabel, payment, validityDays } */
export function buildOrcamento({ professional, patientName, specialty, sessionsPerMonth, unitPrice, monthLabel, payment, validityDays = 15 }) {
  const total = (Number(sessionsPerMonth) || 0) * (Number(unitPrice) || 0);
  const body = `<p>Segue o orçamento para atendimento com ${esc(specialty || 'o(a) profissional')} para <b>${esc(patientName)}</b>, referente ao mês de ${esc(monthLabel)}.</p>
  <table style="width:100%;border-collapse:collapse;margin-top:12px">
    <tr style="background:#f1f4f5">${['Nº de sessões', 'Valor unitário', 'Total do mês'].map((c) => `<th style="border:1px solid #777;padding:7px;text-align:left">${c}</th>`).join('')}</tr>
    <tr><td style="border:1px solid #777;padding:7px">${Number(sessionsPerMonth) || 0} sessões</td><td style="border:1px solid #777;padding:7px">${brl(unitPrice)}</td><td style="border:1px solid #777;padding:7px"><b>${brl(total)}</b></td></tr>
  </table>
  ${payBlock(payment)}
  <p class="muted" style="margin-top:14px">Orçamento válido por ${validityDays} dias a partir da data de emissão. Após o pagamento, envie o comprovante ao contato do consultório.</p>`;
  return docPage('ORÇAMENTO', professional, body).replace(/<body>/, `<body><div style="text-align:right;font-size:10pt">Emitido em ${esc(fmtDate(new Date().toISOString()))}</div>`);
}

/** args: { professional, patientName, specialty, monthLabel, items:[{date,time,amount}], total } */
export function buildRecibo({ professional, patientName, specialty, monthLabel, items, total, payment }) {
  const body = `<p style="margin-top:14px;text-align:justify">Recebi de <b>${esc(patientName)}</b> a quantia de <b>${brl(total)}</b>, referente a ${items.length} ${items.length === 1 ? 'sessão' : 'sessões'} de ${esc(specialty || 'atendimento')} realizada${items.length === 1 ? '' : 's'} em ${esc(monthLabel)}.</p>
  <table style="width:100%;border-collapse:collapse;margin-top:12px">
    <tr style="background:#f1f4f5">${['Data', 'Horário', 'Valor'].map((c) => `<th style="border:1px solid #777;padding:6px;text-align:left">${c}</th>`).join('')}</tr>
    ${items.map((r) => `<tr><td style="border:1px solid #777;padding:6px">${esc(fmtDate(r.date))}</td><td style="border:1px solid #777;padding:6px">${esc(String(r.time || '').slice(0, 5))}</td><td style="border:1px solid #777;padding:6px">${brl(r.amount)}</td></tr>`).join('')}
  </table>
  <p style="margin-top:12px">Para clareza, firmo o presente recibo.</p>`;
  return docPage('RECIBO', professional, body).replace(/<body>/, `<body><div style="text-align:right;font-size:10pt">Emitido em ${esc(fmtDate(new Date().toISOString()))}</div>`);
}

/** args: { professional, patientName, specialty, type: 'disponibilidade'|'comparecimento', sessionsPerWeek, sessionDuration, validityDays, periodLabel, count, payment } */
export function buildDeclaracao({ professional, patientName, specialty, type, sessionsPerWeek, sessionDuration, validityDays = 15, periodLabel, count, payment }) {
  const esp = specialty || 'terapia';
  const text = type === 'comparecimento'
    ? `Declaro, para os devidos fins, que <b>${esc(patientName)}</b> compareceu a ${count} atendimento${count === 1 ? '' : 's'} de ${esc(esp)} neste consultório no período de ${esc(periodLabel)}.`
    : `Informo que há <b>disponibilidade de horário</b> para atendimento de ${esc(esp)} para <b>${esc(patientName)}</b>, com ${sessionsPerWeek} ${Number(sessionsPerWeek) === 1 ? 'encontro' : 'encontros'} semanais de ${sessionDuration} minutos cada, totalizando aproximadamente ${Math.round(Number(sessionsPerWeek) * 4)} atendimentos por mês.`;
  const body = `<p style="margin-top:18px;line-height:1.8;text-align:justify">${text}</p>
  ${type === 'comparecimento' ? '' : `<p class="muted" style="margin-top:12px">Documento válido durante ${validityDays} dias a contar desta data.</p>`}`;
  return docPage(type === 'comparecimento' ? 'DECLARAÇÃO DE COMPARECIMENTO' : 'DECLARAÇÃO DE DISPONIBILIDADE DE HORÁRIO', professional, body)
    .replace(/<body>/, `<body><div style="text-align:right;font-size:10pt">Emitido em ${esc(fmtDate(new Date().toISOString()))}</div>`)
    ;
}
export const exportOrcamentoPdf = (a) => toPdf(buildOrcamento(a));
export const exportOrcamentoWord = (a) => toWord(buildOrcamento(a), `Orcamento ${a.patientName}`);
export const exportReciboPdf = (a) => toPdf(buildRecibo(a));
export const exportReciboWord = (a) => toWord(buildRecibo(a), `Recibo ${a.patientName}`);
export const exportDeclaracaoPdf = (a) => toPdf(buildDeclaracao(a));
export const exportDeclaracaoWord = (a) => toWord(buildDeclaracao(a), `Declaracao ${a.patientName}`);
