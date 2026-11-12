import { esc, fmtDate } from './ui.js';
import { settings } from './state.js';
import { brandOf, darken } from './brand.js';
import { bodyHtml } from './richtext.js';
import { extenso } from './cobranca.js';

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
  .brk { page-break-before: always; }
  .wm { position: fixed; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; z-index: -1; pointer-events: none; }
  .wm img { max-width: 78%; max-height: 78%; }
  .wm span { font-size: 78pt; font-weight: bold; color: #000; opacity: .08; transform: rotate(-35deg); white-space: nowrap; }`;

/** layout (opcional): timbre do documento que o profissional enviou como modelo: { logo, header, footer, watermark }. */
function header(professional, layout) {
  const b = brandOf(professional);
  const reg = [professional.specialty, professional.council_registry].filter(Boolean).join(' · ');
  const name = b.org_name || professional.clinic_name || professional.full_name || '';
  const logo = (layout && layout.logo) || b.logo;
  const linhas = layout && layout.header ? String(layout.header).split('\n').map((l) => l.trim()).filter(Boolean) : null;
  const texto = linhas
    ? `<div class="clinic">${esc(linhas[0])}</div>${linhas.slice(1).map((l) => `<div class="prof">${esc(l)}</div>`).join('')}`
    : `<div class="clinic">${esc(name)}</div>
      <div class="prof">${esc(professional.full_name || '')}${reg ? ' — ' + esc(reg) : ''}</div>
      ${b.tagline ? `<div class="tag">${esc(b.tagline)}</div>` : ''}`;
  return {
    b, reg,
    html: `<div class="hdr"><table><tr>
      ${logo ? `<td style="width:1%;white-space:nowrap"><img class="logo" src="${logo}" alt=""></td>` : ''}
      <td>${texto}</td></tr></table></div>`,
  };
}
const watermark = (layout) => {
  const w = layout && layout.watermark; if (!w) return '';
  if (w.image) return `<div class="wm"><img src="${w.image}" alt="" style="opacity:${Number(w.opacity) || 1}"></div>`;
  return w.text ? `<div class="wm"><span>${esc(w.text)}</span></div>` : '';
};

const contactRows = (b) => {
  const c = b.contact || {};
  const top = [c.phone && `WhatsApp ${c.phone}`, c.instagram && `Instagram ${c.instagram}`, c.email && `E-mail ${c.email}`].filter(Boolean);
  const rows = [];
  if (top.length) rows.push(top.map((x) => esc(x)).join(' &nbsp;·&nbsp; '));
  if (c.address) rows.push(esc(c.address));
  return rows.length ? `<div style="text-align:center;color:${b.accent || '#B83D6F'};font-size:9.5pt;margin-bottom:4px">${rows.join('<br>')}</div>` : '';
};
const footer = (b, ai, layout) => `<div class="foot">${layout && layout.footer ? para(layout.footer) + '<br>' : contactRows(b) + ((b.footer || settings.doc_footer) ? esc(b.footer || settings.doc_footer) + '<br>' : '')}${ai ? 'Documento elaborado com apoio de ferramenta de inteligência artificial e revisado pelo(a) profissional responsável. ' : ''}Documento confidencial, contém dados pessoais sensíveis de saúde (LGPD – Lei nº 13.709/2018).</div>`;

const signature = (professional, b, reg) => `<div class="sign">${b.signature ? `<img src="${b.signature}" alt="">` : ''}<div class="line">${esc(professional.full_name || '')}<br>${esc(reg)}</div></div>`;

const whenOf = (r) => (r.kind === 'periodo' && r.period_start ? `${fmtDate(r.period_start)} a ${fmtDate(r.period_end)}` : fmtDate(r.session_date));

/** report: { title, kind, session_date, period_start, period_end, ai_generated } */
function buildHtml({ report, patientName, professional, sections, layout }) {
  const h = header(professional, layout);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>${css(h.b.color, h.b)}</style></head><body>
  ${watermark(layout)}${h.html}
  <h1>${esc(report.title)}</h1>
  <table class="meta">
    <tr><td class="lab">Paciente:</td><td><b>${esc(patientName || '')}</b></td></tr>
    <tr><td class="lab">${report.kind === 'periodo' ? 'Período:' : 'Data:'}</td><td>${esc(whenOf(report))}</td></tr>
  </table>
  ${sections.map((s) => `${report && report.kind === 'documento' ? '' : `<h2>${esc(s.title)}</h2>`}<div class="rt">${bodyHtml(s)}</div>`).join('\n')}
  ${signature(professional, h.b, h.reg)}
  ${footer(h.b, report.ai_generated, layout)}
</body></html>`;
}

/** Prontuário completo: anamnese, evoluções e relatórios, em ordem cronológica. */
function buildDossier({ patient, professional, reports, only, layout }) {
  const h = header(professional, layout);
  const order = { anamnese: 0, sessao: 1, periodo: 2, documento: 3 };
  const list = [...reports].sort((a, b) => (order[a.kind] - order[b.kind]) || String(a.session_date).localeCompare(String(b.session_date)));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Prontuário — ${esc(patient.name)}</title><style>${css(h.b.color, h.b)}</style></head><body>
  ${watermark(layout)}${h.html}
  <h1>Prontuário</h1>
  <table class="meta"><tr><td class="lab">Paciente:</td><td><b>${esc(patient.name)}</b></td></tr>
  ${patient.birth_date ? `<tr><td class="lab">Nascimento:</td><td>${esc(fmtDate(patient.birth_date))}</td></tr>` : ''}
  <tr><td class="lab">Emitido em:</td><td>${esc(fmtDate(new Date().toISOString()))}</td></tr>
  <tr><td class="lab">Registros:</td><td>${list.length}</td></tr></table>
  ${list.map((r, i) => `<h3 ${i ? 'class="brk"' : ''}>${esc(KIND_LABEL[r.kind] || 'Registro')} — ${esc(r.title)} (${esc(whenOf(r))})</h3>
    ${(only ? (r.sections || []).filter((s) => s.patient_visible !== false) : (r.sections || [])).map((s) => `${r.kind === 'documento' ? '' : `<h2>${esc(s.title)}</h2>`}<div class="rt">${bodyHtml(s)}</div>`).join('\n')}`).join('\n')}
  ${signature(professional, h.b, h.reg)}
  ${footer(h.b, list.some((r) => r.ai_generated), layout)}
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
export const exportWord = (args) => toWord(buildHtml({ ...args, layout: args.layout && { ...args.layout, watermark: null } }), args.report.title);
export const exportPdf = (args) => toPdf(buildHtml(args));
export const exportDossierWord = (args) => toWord(buildDossier({ ...args, layout: args.layout && { ...args.layout, watermark: null } }), `Prontuario ${args.patient.name}`);
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
  <h1 style="text-align:center">FREQUÊNCIA DE SESSÕES${professional.specialty ? ' – ' + esc(professional.specialty.toUpperCase()) : ''}</h1>
  <table class="meta">
    <tr><td class="lab">Paciente:</td><td><b>${esc(patientName || '')}</b></td></tr>
    <tr><td class="lab">Profissional responsável:</td><td>${esc(professional.full_name || '')}${esc(reg)}</td></tr>
    ${approach ? `<tr><td class="lab">Especialidade:</td><td>${esc(approach)}</td></tr>` : ''}
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
  const body = `<p>Segue o orçamento de sessões de ${esc(specialty || 'terapia')} para <b>${esc(patientName)}</b>, referente ao mês de ${esc(monthLabel)}.</p>
  <table style="width:100%;border-collapse:collapse;margin-top:12px">
    <tr style="background:#f1f4f5">${['Nº de sessões', 'Valor unitário', 'Total do mês'].map((c) => `<th style="border:1px solid #777;padding:7px;text-align:left">${c}</th>`).join('')}</tr>
    <tr><td style="border:1px solid #777;padding:7px">${Number(sessionsPerMonth) || 0} sessões</td><td style="border:1px solid #777;padding:7px">${brl(unitPrice)}</td><td style="border:1px solid #777;padding:7px"><b>${brl(total)}</b></td></tr>
  </table>
  ${payBlock(payment)}
  <p class="muted" style="margin-top:14px">Orçamento válido por ${validityDays} dias a partir da data de emissão. Após o pagamento, envie o comprovante ao contato do consultório.</p>`;
  return docPage('ORÇAMENTO', professional, body).replace(/<body>/, `<body><div style="text-align:right;font-size:10pt">Emitido em ${esc(fmtDate(new Date().toISOString()))}</div>`);
}

/** args: { professional, patientName, specialty, monthLabel, items:[{date,time,amount}], total } */
export function buildRecibo({ professional, patientName, specialty, monthLabel, items, total, payment, numero }) {
  const body = `<p style="margin-top:14px;text-align:justify">Recebi de <b>${esc(patientName)}</b> a quantia de <b>${brl(total)}</b> (${esc(extenso(total))}), referente a ${items.length} ${items.length === 1 ? 'sessão' : 'sessões'} de ${esc(specialty || 'sessão')} realizada${items.length === 1 ? '' : 's'} em ${esc(monthLabel)}.</p>
  <table style="width:100%;border-collapse:collapse;margin-top:12px">
    <tr style="background:#f1f4f5">${['Data', 'Horário', 'Valor'].map((c) => `<th style="border:1px solid #777;padding:6px;text-align:left">${c}</th>`).join('')}</tr>
    ${items.map((r) => `<tr><td style="border:1px solid #777;padding:6px">${esc(fmtDate(r.date))}</td><td style="border:1px solid #777;padding:6px">${esc(String(r.time || '').slice(0, 5))}</td><td style="border:1px solid #777;padding:6px">${brl(r.amount)}</td></tr>`).join('')}
  </table>
  <p style="margin-top:12px">Para clareza, firmo o presente recibo.</p>`;
  return docPage(numero ? `RECIBO Nº ${String(numero).padStart(4, '0')}` : 'RECIBO', professional, body).replace(/<body>/, `<body><div style="text-align:right;font-size:10pt">Emitido em ${esc(fmtDate(new Date().toISOString()))}</div>`);
}

/** args: { professional, patientName, specialty, type: 'disponibilidade'|'comparecimento', sessionsPerWeek, sessionDuration, validityDays, periodLabel, sessions:[{date,time}] } */
const longDate = (d) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const plural = (n, one, many) => `${n} ${Number(n) === 1 ? one : many}`;
export function buildDeclaracao({ professional, patientName, specialty, type, sessionsPerWeek = 1, sessionDuration = 50, validityDays = 15, periodLabel = '', sessions = [] }) {
  const hoje = new Date();
  const ate = new Date(hoje.getTime() + validityDays * 864e5);
  const esp = specialty ? ` de ${esc(specialty)}` : '';
  const nome = `<b>${esc(patientName)}</b>`;
  const tbl = (head, rows) => `<table style="width:100%;border-collapse:collapse;margin-top:12px"><tr style="background:#f1f4f5">${head.map((c) => `<th style="border:1px solid #777;padding:6px;text-align:left">${c}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td style="border:1px solid #777;padding:6px">${c}</td>`).join('')}</tr>`).join('')}</table>`;
  let body;
  if (type === 'comparecimento') {
    const n = sessions.length;
    body = `<p style="margin-top:18px;line-height:1.8;text-align:justify">Declaro, para os devidos fins, que ${nome} compareceu a <b>${plural(n, 'sessão', 'sessões')}</b>${esp} neste consultório no período de <b>${esc(periodLabel)}</b>${n ? ', nas datas abaixo' : ''}.</p>
    ${n ? tbl(['Data', 'Horário'], sessions.map((s) => [esc(fmtDate(s.date)), esc(String(s.time || '').slice(0, 5))])) : ''}`;
  } else {
    const porMes = Math.round(Number(sessionsPerWeek) * 4.33);
    body = `<p style="margin-top:18px;line-height:1.8;text-align:justify">Declaro que há <b>disponibilidade de horário</b> para sessões${esp} com ${nome}, em ${plural(sessionsPerWeek, 'sessão semanal', 'sessões semanais')} de ${sessionDuration} minutos cada, totalizando cerca de ${porMes} sessões por mês.</p>
    <p style="margin-top:12px">Esta declaração é válida de <b>${longDate(hoje)}</b> até <b>${longDate(ate)}</b>.</p>`;
  }
  return docPage(type === 'comparecimento' ? 'DECLARAÇÃO DE COMPARECIMENTO' : 'DECLARAÇÃO DE DISPONIBILIDADE DE HORÁRIO', professional, body)
    .replace(/<body>/, `<body><div style="text-align:right;font-size:10pt">Emitida em ${esc(longDate(hoje))}</div>`);
}
export const exportOrcamentoPdf = (a) => toPdf(buildOrcamento(a));
export const exportOrcamentoWord = (a) => toWord(buildOrcamento(a), `Orcamento ${a.patientName}`);
export const exportReciboPdf = (a) => toPdf(buildRecibo(a));
export const exportReciboWord = (a) => toWord(buildRecibo(a), `Recibo ${a.patientName}`);
export const exportDeclaracaoPdf = (a) => toPdf(buildDeclaracao(a));
export const exportDeclaracaoWord = (a) => toWord(buildDeclaracao(a), `Declaracao ${a.patientName}`);

/* ---------- Auditoria: pasta completa do paciente para conferência ---------- */
const AUD_ACTION = { insert: 'Criado', update: 'Alterado', delete: 'Excluído', create: 'Criado', edit: 'Alterado', export: 'Exportado' };
export function buildAuditoria({ patient, professional, reports, versions, audits, consents, appointments, admin, payments }) {
  const h = header(professional);
  const total = appointments.length;
  const realizados = appointments.filter((a) => a.status === 'realizado').length;
  const recebido = payments.paid;
  const aReceber = payments.open;
  const row = (l, v) => `<tr><td class="lab">${esc(l)}</td><td>${v}</td></tr>`;
  const sec = (title, body) => `<h2>${esc(title)}</h2>${body}`;
  const tbl = (head, rows) => `<table class="meta" style="width:100%"><tr>${head.map((x) => `<td class="lab"><b>${esc(x)}</b></td>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
  const when = (s) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Auditoria — ${esc(patient.name)}</title><style>${css(h.b.color, h.b)}</style></head><body>
  ${h.html}
  <h1>Auditoria do prontuário</h1>
  <table class="meta">
    ${row('Paciente:', `<b>${esc(patient.name)}</b>`)}
    ${patient.birth_date ? row('Nascimento:', esc(fmtDate(patient.birth_date))) : ''}
    ${row('Profissional responsável:', esc(professional.full_name || '') + (h.reg ? ' — ' + esc(h.reg) : ''))}
    ${row('Gerado em:', esc(when(new Date().toISOString())))}
    ${row('Registros clínicos:', String(reports.length))}
    ${row('Sessões (agenda):', `${total} agendados ou registrados · ${realizados} realizados`)}
  </table>

  ${sec('1. Registros clínicos e versões', reports.length ? reports.map((r) => `
    <h3>${esc(KIND_LABEL[r.kind] || 'Registro')} — ${esc(r.title)} (${esc(whenOf(r))})</h3>
    <p class="small">Situação: ${esc(r.status || '—')} · Criado em ${esc(when(r.created_at))} · Última alteração ${esc(when(r.updated_at))}</p>
    ${tbl(['Versão salva em', 'Título'], (versions[r.id] || []).length ? versions[r.id].map((v) => [esc(when(v.saved_at)), esc(v.title || '')]) : [['—', 'Sem versões anteriores salvas']])}
  `).join('') : '<p class="muted">Nenhum registro.</p>')}

  ${sec('2. Histórico de alterações', (() => {
    const entries = Object.entries(audits).flatMap(([id, list]) => list.map((e) => ({ ...e, id })));
    const titleOf = (id) => reports.find((r) => r.id === id)?.title || 'Registro';
    entries.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return entries.length ? tbl(['Data e hora', 'Ação', 'Registro'], entries.map((e) => [esc(when(e.created_at)), esc(AUD_ACTION[e.action] || e.action), esc(titleOf(e.id))]))
      : '<p class="muted">Nenhuma alteração registrada.</p>';
  })())}

  ${sec('3. Consentimento (LGPD)', consents.length ? tbl(['Concedido em', 'Canal', 'Revogado em'], consents.map((c) => [esc(when(c.granted_at)), esc(c.channel || ''), esc(c.revoked_at ? when(c.revoked_at) : 'Ativo')])) : '<p class="muted">Nenhum consentimento registrado.</p>')}

  ${sec('4. Agenda e financeiro', `
    <table class="meta">
      ${row('Especialidade:', esc(admin?.approach || '—'))}
      ${row('Convênio:', esc(admin?.insurer || 'Particular'))}
      ${row('Valor da sessão:', admin?.session_price != null ? brl(admin.session_price) : '—')}
      ${row('Recebido:', brl(recebido))}
      ${row('A receber:', brl(aReceber))}
    </table>
    ${appointments.length ? tbl(['Data', 'Horário', 'Situação', 'Valor', 'Pagamento'], appointments.map((a) => [fmtDate(a.date), esc(String(a.time || '').slice(0, 5)), esc(ATT_STATUS[a.status] || a.status), a.amount != null ? brl(a.amount) : '—', esc(a.payment_status === 'pago' ? 'Pago' + (a.paid_on ? ' em ' + fmtDate(a.paid_on) : '') : 'Pendente')])) : ''}`)}

  ${signature(professional, h.b, h.reg)}
  ${footer(h.b, reports.some((r) => r.ai_generated))}
</body></html>`;
}
export const exportAuditoriaPdf = (args) => toPdf(buildAuditoria(args));

/** Documento de cobrança: quantidade de sessões em aberto, total, dados de pagamento e código PIX. */
export function buildCobranca({ professional, patientName, items, payment, pixCode }) {
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const body = `<p style="margin-top:14px;text-align:justify">Segue a cobrança de <b>${esc(patientName)}</b> referente ao que ainda não foi pago.</p>
  <table style="width:100%;border-collapse:collapse;margin-top:12px">
    ${items.filter((i) => !i.label).length ? `<tr><td style="border:1px solid #777;padding:6px">Quantidade de sessões</td><td style="border:1px solid #777;padding:6px">${items.filter((i) => !i.label).length}</td></tr>` : ''}
    ${items.filter((i) => i.label).map((i) => `<tr><td style="border:1px solid #777;padding:6px">${esc(i.label)}</td><td style="border:1px solid #777;padding:6px">${brl(i.amount)}</td></tr>`).join('')}
    <tr><td style="border:1px solid #777;padding:6px"><b>Total</b></td><td style="border:1px solid #777;padding:6px"><b>${brl(total)}</b></td></tr>
  </table>
  ${payBlock(payment)}
  ${pixCode ? `<h2>Pagamento por PIX (copia e cola)</h2><p style="word-break:break-all;font-family:monospace;font-size:9pt">${esc(pixCode)}</p>` : ''}`;
  return docPage('COBRANÇA', professional, body).replace(/<body>/, `<body><div style="text-align:right;font-size:10pt">Emitido em ${esc(fmtDate(new Date().toISOString()))}</div>`);
}
export const exportCobrancaPdf = (a) => toPdf(buildCobranca(a));
