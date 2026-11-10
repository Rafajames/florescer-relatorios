import * as api from './api.js';
import * as ai from './ai.js';
import { state, DEFAULT_CONSENT } from './state.js';
import { createDemo, removeDemo, isDemo } from './demo.js';
import { exportDossierWord, exportDossierPdf, exportAuditoriaPdf, KIND_LABEL, brl, ATT_STATUS } from './export.js';
import { newToken, sha256, waLink } from './cobranca.js';
import { abrirCobranca } from './cobrar.js';
import { appointmentModal } from './views-administrativo.js';
import {
  $, $$, esc, fmtDate, fmtDateTime, toast, openModal, confirmBox, busy, statusChip, chip, meta, callout,
  shell, loading, pageHeader, backLink, icon, greeting, longDate, emptyState, todayISO,
} from './ui.js';

const goto = (h) => { location.hash = h; };
const siteUrl = () => location.origin + location.pathname;

export const reportLine = (r) => `
  <a class="li" href="#/relatorio/${r.id}">
    <div class="grow"><div class="t ellip">${esc(r.title)}</div>
    ${meta([esc(r.patients?.name || ''), fmtDate(r.session_date), KIND_LABEL[r.kind] || ''])}</div>
    ${statusChip(r)}${icon('right', 'go')}
  </a>`;

/* =====================================================================
   INÍCIO
   ===================================================================== */
export async function renderDashboard() {
  const main = shell('painel'); loading(main);
  const [patients, reports] = await Promise.all([api.listPatients(), api.listReports({ limit: 200 })]);
  const p = state.profile;
  const first = (p.full_name || '').split(' ')[0] || 'profissional';
  const drafts = reports.filter((r) => r.status === 'rascunho');
  const noConsent = patients.filter((x) => !api.hasActiveConsent(x.consents));
  const ready = reports.filter((r) => r.status === 'revisado' && !r.released_to_patient && r.patients?.email && r.kind);

  const todo = [
    ['Cadastrar o primeiro paciente', patients.length > 0, '#/pacientes'],
    ['Completar o perfil (registro e nome do consultório)', Boolean(p.council_registry && p.clinic_name), '#/config?aba=perfil'],
    ['Revisar o texto do termo de consentimento', Boolean(p.consent_text), '#/config?aba=consentimento'],
    ['Conectar uma IA (opcional, há opções gratuitas)', ai.hasTextAI(), '#/config?aba=chaves'],
  ];
  const doneN = todo.filter((t) => t[1]).length;
  const released = reports.filter((r) => r.released_to_patient).length;
  const week = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const perDay = (d) => reports.filter((r) => r.session_date === iso(d)).length;

  // agenda: hoje e os próximos dias (se a tabela de agenda não existir, segue sem ela)
  const today = todayISO();
  const ahead = new Date(); ahead.setDate(ahead.getDate() + 14);
  let aps = [];
  try { aps = await api.listAppointments({ from: today, to: iso(ahead) }); } catch { aps = []; }
  const valid = aps.filter((a) => a.status !== 'cancelado');
  const todayAps = valid.filter((a) => a.date === today);
  const doneAps = todayAps.filter((a) => a.status === 'realizado').length;
  const missAps = todayAps.filter((a) => a.status === 'falta' || a.status === 'falta_justificada').length;
  const leftAps = todayAps.length - doneAps - missAps;
  const nextAp = todayAps.find((a) => a.status === 'agendado');
  const hh = (t) => (t || '').slice(0, 5);
  const days = [...new Set(valid.map((a) => a.date))].filter((d) => d > today).slice(0, 4);
  const dayPill = (d, on) => { const dt = new Date(d + 'T12:00:00'); const n = valid.filter((a) => a.date === d).length;
    return `<a class="dp ${on ? 'on' : ''}" href="#/administrativo"><small>${on ? 'Hoje' : dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small>${dt.getDate()}<i>${'•'.repeat(Math.min(n, 6))}</i></a>`; };
  const weekAps = valid.filter((a) => { const d = new Date(a.date + 'T12:00:00'); return (d - new Date(today + 'T12:00:00')) / 864e5 < 7; }).length;

  // relatórios do mês
  const month = today.slice(0, 7);
  const monthR = reports.filter((r) => (r.session_date || '').startsWith(month));
  const mRel = monthR.filter((r) => r.released_to_patient).length;
  const mRev = monthR.filter((r) => r.status === 'revisado' && !r.released_to_patient).length;
  const mDraft = monthR.filter((r) => r.status === 'rascunho').length;
  const pct = (n, t) => (t ? Math.round((n / t) * 100) : 0);

  // últimos 7 dias x 7 dias anteriores
  const counts = week.map(perDay);
  const total7 = counts.reduce((a, b) => a + b, 0);
  const prev7 = [...Array(7)].reduce((acc, _, i) => { const d = new Date(); d.setDate(d.getDate() - 7 - i); return acc + perDay(d); }, 0);
  const diff = prev7 ? Math.round(((total7 - prev7) / prev7) * 100) : 0;
  const maxC = Math.max(1, ...counts);

  const attention = [
    ...drafts.slice(0, 3).map((r) => ({ c: 'c-blo', t: `Rascunho · ${esc(r.patients?.name || r.title)}`, s: `${esc(r.title)} · ${fmtDate(r.session_date)}`, h: `#/relatorio/${r.id}`, b: 'Revisar' })),
    ...(ready.length ? [{ c: 'c-pet', t: `${ready.length} ${ready.length === 1 ? 'relatório pronto' : 'relatórios prontos'}`, s: 'revisados, ainda não liberados ao paciente', h: '#/relatorios', b: 'Liberar' }] : []),
    ...noConsent.slice(0, 3).map((x) => ({ c: 'c-warn', t: `Consentimento · ${esc(x.name)}`, s: 'registre antes de gravar a sessão', h: `#/pacientes/${x.id}`, b: 'Abrir' })),
  ];

  main.innerHTML = pageHeader(`${greeting()}, ${esc(first)}`, esc(longDate())) + `
  <div class="dash">
    <section class="dcard wide" aria-label="Atendimentos de hoje">
      <h3>Atendimentos de hoje</h3><span class="ill">${ART.clip}</span>
      <div class="hero-row">
        <div class="bignum">${todayAps.length}<small>${todayAps.length === 1 ? 'sessão' : 'sessões'}</small></div>
        <div class="side">${nextAp ? `<div class="trend">Próxima: ${esc(nextAp.patients?.name || '')} às ${hh(nextAp.time) || '—'}</div>` : `<div class="trend down">${todayAps.length ? 'Nenhuma sessão pendente hoje' : 'Nada agendado para hoje'}</div>`}
          <div>${weekAps} ${weekAps === 1 ? 'sessão agendada' : 'sessões agendadas'} nos próximos 7 dias</div></div>
      </div>
      <div class="segbar" role="img" aria-label="${doneAps} realizadas, ${leftAps} a fazer, ${missAps} faltas">
        ${todayAps.length ? `<i class="c-ok" style="width:${pct(doneAps, todayAps.length)}%"></i><i class="c-pet3" style="width:${pct(leftAps, todayAps.length)}%"></i><i class="c-blo" style="width:${pct(missAps, todayAps.length)}%"></i>` : ''}
      </div>
      <div class="legend-row">
        <div class="lg"><span class="k"><span class="dot c-ok"></span>Realizadas</span><b>${doneAps}</b></div>
        <div class="lg"><span class="k"><span class="dot c-pet3"></span>A fazer</span><b>${leftAps}</b></div>
        <div class="lg"><span class="k"><span class="dot c-blo"></span>Faltas</span><b>${missAps}</b></div>
        <a class="lg" href="#/pacientes" style="color:inherit;text-decoration:none"><span class="k">Pacientes</span><b>${patients.length}</b></a>
        <a class="lg" href="#/relatorios?status=rascunho" style="color:inherit;text-decoration:none"><span class="k">Rascunhos para revisar</span><b>${drafts.length}</b></a>
      </div>
      <div class="quick">
        ${patients.length ? `<select id="who" aria-label="Paciente"><option value="">Quem você vai atender agora?</option>
          ${patients.map((x) => `<option value="${x.id}" ${nextAp && nextAp.patient_id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
          <button class="btn bloom lg" id="go-now">${icon('mic')}Iniciar sessão</button>`
        : `<span class="muted grow" style="align-self:center">Comece cadastrando um paciente. Depois registre o consentimento e inicie a primeira sessão.</span><a class="btn bloom lg" href="#/pacientes">${icon('plus')}Cadastrar paciente</a>`}
      </div>
    </section>

    <section class="dcard tall" aria-label="Agenda">
      <h3>Agenda <small>• ${esc(new Date().toLocaleDateString('pt-BR', { month: 'long' }))}</small></h3><span class="ill">${ART.cal}</span>
      <div class="midnum" style="margin-top:16px">${todayAps.length}<small>hoje</small></div>
      <div class="muted small" style="margin-top:4px">${doneAps} de ${todayAps.length} ${todayAps.length === 1 ? 'feita' : 'feitas'}</div>
      <div class="daypills">${dayPill(today, true)}${days.map((d) => dayPill(d, false)).join('')}</div>
      <div class="agl">${todayAps.length ? todayAps.map((a) => `<a class="agi" href="${a.status === 'realizado' ? `#/nova?paciente=${a.patient_id}` : '#/administrativo'}">
          <span class="ck ${a.status === 'realizado' ? 'ok' : a.status.startsWith('falta') ? 'no' : ''}"></span><span class="tm">${hh(a.time) || '—'}</span>
          <span class="nm"><b>${esc(a.patients?.name || 'Paciente')}</b><span>${esc(ATT_STATUS[a.status] || '')}${a.duration_min ? ` · ${a.duration_min} min` : ''}</span></span>
          ${a === nextAp ? chip('Próxima', 'petrol') : a.status === 'realizado' ? chip('Feita', 'ok') : ''}</a>`).join('')
        : '<p class="empty-mini">Nenhuma sessão agendada para hoje.</p>'}</div>
      <div class="foot"><a class="btn quiet" href="#/administrativo">Ver agenda</a><a class="btn" href="#/administrativo">${icon('plus')}Agendar</a></div>
    </section>

    <section class="dcard" aria-label="Relatórios">
      <h3>Relatórios</h3><span class="ill">${ART.chart}</span>
      <div class="lbl">Neste mês</div>
      <div class="midnum">${monthR.length}<small>${monthR.length === 1 ? 'relatório' : 'relatórios'}</small></div>
      <div class="legend-row" style="margin-top:16px"><span class="lg"><span class="k"><span class="dot c-pet"></span>Liberados</span><b>${mRel}</b></span><span class="lg"><span class="k"><span class="dot c-light"></span>Revisados</span><b>${mRev}</b></span><span class="lg"><span class="k"><span class="dot c-blo"></span>Rascunhos</span><b>${mDraft}</b></span></div>
      <div class="segbar thick">${monthR.length ? `<i class="c-pet" style="width:${pct(mRel, monthR.length)}%">${pct(mRel, monthR.length) >= 12 ? pct(mRel, monthR.length) + '%' : ''}</i><i class="c-light" style="width:${pct(mRev, monthR.length)}%"></i><i class="c-blo" style="width:${pct(mDraft, monthR.length)}%"></i>` : ''}</div>
      <h3 style="margin-top:24px">O que precisa da sua atenção</h3>
      <div class="att">${attention.length ? attention.map((x) => `<a href="${x.h}"><span class="dot ${x.c}"></span><span class="t"><b>${x.t}</b><span>${x.s}</span></span><span class="go2">${x.b}</span></a>`).join('')
        : '<p class="empty-mini">Tudo em dia: nenhum rascunho e nenhum paciente sem consentimento.</p>'}</div>
    </section>

    <section class="dcard" aria-label="Últimos 7 dias">
      <h3>Últimos 7 dias</h3>
      <div class="lbl">Registros feitos</div>
      <div class="midnum">${total7}<small>${total7 === 1 ? 'registro' : 'registros'}</small></div>
      ${prev7 ? `<div class="trend ${diff < 0 ? 'down' : ''}" style="margin-top:6px">${diff >= 0 ? '↗' : '↘'} ${Math.abs(diff)}% vs. semana anterior</div>` : '<div class="muted small" style="margin-top:6px">registros por dia</div>'}
      <div class="wk">${week.map((d, i) => `<div class="${iso(d) === today ? 'today' : ''}"><div class="bar"><i style="height:${(counts[i] / maxC) * 100}%"></i></div><b>${counts[i]}</b><span>${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')} ${d.getDate()}</span></div>`).join('')}</div>
    </section>

    <section class="dcard wide" aria-label="Últimos registros">
      <h3>Últimos registros</h3>
      ${reports.length ? `<div class="list" style="margin-top:8px">${reports.slice(0, 6).map(reportLine).join('')}</div>` : '<p class="empty-mini">Ainda não há relatórios.</p>'}
    </section>

    ${doneN < todo.length ? `<aside class="dcard" aria-label="Deixe o sistema pronto">
      <h3>Deixe o sistema pronto</h3>
      <div class="progress" role="progressbar" aria-valuenow="${doneN}" aria-valuemax="${todo.length}" style="margin-top:14px"><i style="width:${(doneN / todo.length) * 100}%"></i></div>
      <p class="muted small">${doneN} de ${todo.length} passos</p>
      ${todo.map(([l, ok, href]) => `<div class="todo ${ok ? 'done' : ''}"><span class="box">${ok ? icon('check') : ''}</span>${ok ? `<span class="l">${esc(l)}</span>` : `<a href="${href}">${esc(l)}</a>`}</div>`).join('')}
    </aside>` : ''}
  </div>`;

  const go = $('#go-now');
  if (go) go.onclick = () => { const v = $('#who').value; goto(v ? `#/nova?paciente=${v}` : '#/nova'); };
}

/* ilustrações dos cartões (vetor com gradiente; ids próprios para não colidir) */
const GR = `<defs><linearGradient id="hp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3FA3C4"/><stop offset="1" stop-color="#0E5670"/></linearGradient>
<linearGradient id="hb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F27AA9"/><stop offset="1" stop-color="#B32F64"/></linearGradient>
<linearGradient id="hw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE6EA"/></linearGradient>
<filter id="hs" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#0B2A36" flood-opacity=".25"/></filter></defs>`;
const ART = {
  clip: `<svg width="104" height="104" viewBox="0 0 120 120" aria-hidden="true">${GR}<g filter="url(#hs)" transform="rotate(-8 60 60)"><rect x="26" y="16" width="64" height="86" rx="10" fill="url(#hp)"/><rect x="32" y="26" width="52" height="70" rx="5" fill="url(#hw)"/><rect x="44" y="10" width="28" height="14" rx="5" fill="#C9D6DB"/><rect x="40" y="40" width="34" height="5" rx="2.5" fill="#B8C8CE"/><rect x="40" y="52" width="26" height="5" rx="2.5" fill="#B8C8CE"/><rect x="40" y="64" width="30" height="5" rx="2.5" fill="#B8C8CE"/><path d="M77 84c-6-4-10-7-10-11a4.5 4.5 0 0 1 10-2 4.5 4.5 0 0 1 10 2c0 4-4 7-10 11z" fill="url(#hb)" transform="translate(-6 -4) scale(1.15)"/></g></svg>`,
  cal: `<svg width="84" height="84" viewBox="0 0 120 120" aria-hidden="true"><g filter="url(#hs)" transform="rotate(6 60 60)"><rect x="18" y="26" width="84" height="74" rx="12" fill="url(#hw)"/><path d="M18 38a12 12 0 0 1 12-12h60a12 12 0 0 1 12 12v8H18z" fill="url(#hp)"/><rect x="36" y="16" width="8" height="20" rx="4" fill="#9AB0B8"/><rect x="76" y="16" width="8" height="20" rx="4" fill="#9AB0B8"/><g fill="#C3D3D9"><rect x="30" y="56" width="12" height="10" rx="3"/><rect x="48" y="56" width="12" height="10" rx="3"/><rect x="66" y="56" width="12" height="10" rx="3" fill="url(#hb)"/><rect x="84" y="56" width="8" height="10" rx="3"/><rect x="30" y="74" width="12" height="10" rx="3"/><rect x="48" y="74" width="12" height="10" rx="3"/><rect x="66" y="74" width="12" height="10" rx="3"/></g></g></svg>`,
  chart: `<svg width="84" height="84" viewBox="0 0 120 120" aria-hidden="true"><g filter="url(#hs)"><rect x="18" y="62" width="20" height="38" rx="6" fill="url(#hw)"/><rect x="44" y="42" width="20" height="58" rx="6" fill="url(#hp)"/><rect x="70" y="24" width="20" height="76" rx="6" fill="url(#hb)"/><rect x="12" y="98" width="88" height="8" rx="4" fill="#C9D6DB"/></g></svg>`,
};


/* =====================================================================
   PACIENTES
   ===================================================================== */
async function patientModal(existing = {}) {
  return openModal(existing.id ? 'Editar paciente' : 'Novo paciente', `
    <label class="field">Nome ou identificação<input name="name" required value="${esc(existing.name || '')}"><small>Pode usar iniciais ou nome social.</small></label>
    <label class="field">E-mail do paciente<input type="email" name="email" value="${esc(existing.email || '')}"><small>Necessário para o paciente acessar o portal. Confira se está correto.</small></label>
    <div class="grid2">
      <label class="field">Telefone<input name="phone" value="${esc(existing.phone || '')}"></label>
      <label class="field">Data de nascimento<input type="date" name="birth_date" value="${esc(existing.birth_date || '')}"></label>
    </div>
    <label class="field">Observações<textarea name="notes" rows="3">${esc(existing.notes || '')}</textarea></label>`,
  {
    onOk: (d) => {
      const g = (n) => d.querySelector(`[name=${n}]`).value.trim();
      return api.savePatient({
        ...(existing.id ? { id: existing.id } : {}),
        name: g('name'), email: g('email') || null, phone: g('phone') || null,
        birth_date: g('birth_date') || null, notes: g('notes') || null,
      });
    },
  });
}

const lastSession = (p) => (p.reports || []).filter((r) => r.kind === 'sessao').map((r) => r.session_date).sort().pop() || '';

export async function renderPatients() {
  const main = shell('pacientes'); loading(main);
  let all = await api.listPatients(false);
  let showArchived = false;

  main.innerHTML = pageHeader('Pacientes', 'Quem você atende.', `<button class="btn quiet" id="demo">${all.some(isDemo) ? 'Remover paciente de teste' : 'Criar paciente de teste'}</button><button class="btn" id="add">${icon('plus')}Novo paciente</button>`) + `
    <div class="row" style="margin-bottom:14px">
      <input id="q" type="search" placeholder="Buscar por nome ou e-mail" style="max-width:340px;margin:0" aria-label="Buscar paciente">
      <select id="filter" style="width:auto;margin:0" aria-label="Filtro">
        <option value="">Todos</option><option value="semconsent">Sem consentimento</option><option value="rascunho">Com rascunhos</option></select>
      <select id="sort" style="width:auto;margin:0" aria-label="Ordenar">
        <option value="nome">Ordenar por nome</option><option value="recente">Atendidos recentemente</option></select>
      <label class="check" style="margin:0"><input type="checkbox" id="arch">Mostrar arquivados</label>
    </div>
    <div class="table" id="ptable"></div>`;

  const draw = () => {
    const q = $('#q').value.toLowerCase(), f = $('#filter').value, s = $('#sort').value;
    let rows = all.filter((p) => (!q || p.name.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q))
      && (f !== 'semconsent' || !api.hasActiveConsent(p.consents))
      && (f !== 'rascunho' || (p.reports || []).some((r) => r.status === 'rascunho')));
    rows = [...rows].sort((a, b) => s === 'recente' ? lastSession(b).localeCompare(lastSession(a)) : a.name.localeCompare(b.name, 'pt-BR'));
    $('#ptable').innerHTML = `<div class="tr th cols-patients"><span>Nome</span><span>Última sessão</span><span>Relatórios</span><span>Consentimento</span><span></span></div>` +
      (rows.length ? rows.map((p) => {
        const reps = p.reports || [], dr = reps.filter((r) => r.status === 'rascunho').length;
        return `<a class="tr cols-patients" href="#/pacientes/${p.id}">
          <span class="ellip"><span class="t">${esc(p.name)}</span>${p.archived ? ' ' + chip('Arquivado') : ''}<br><span class="muted small">${esc(p.email || 'sem e-mail')}</span></span>
          <span>${lastSession(p) ? fmtDate(lastSession(p)) : '<span class="muted">Nenhuma</span>'}</span>
          <span>${reps.length}${dr ? ' ' + chip(`${dr} rascunho${dr > 1 ? 's' : ''}`, 'warn') : ''}</span>
          <span>${api.hasActiveConsent(p.consents) ? chip('Registrado', 'ok') : chip('Pendente', 'warn')}</span>
          <span class="go">${icon('right')}</span></a>`;
      }).join('') : emptyState(all.length ? 'Nenhum paciente encontrado' : 'Você ainda não cadastrou pacientes', all.length ? 'Tente outro termo ou limpe o filtro.' : 'Cadastre o primeiro para registrar consentimento e iniciar uma sessão.', all.length ? '' : `<button class="btn" id="add2">${icon('plus')}Cadastrar paciente</button>`));
  };
  draw();
  ['#q', '#filter', '#sort'].forEach((id) => ($(id).oninput = draw));
  $('#arch').onchange = async (e) => { showArchived = e.target.checked; all = await api.listPatients(showArchived); draw(); };
  const addP = async () => { const p = await patientModal(); if (p && p.id) goto(`#/pacientes/${p.id}`); };
  $('#add').onclick = addP;
  $('#demo').onclick = async (e) => {
    if (all.some(isDemo)) {
      if (!(await confirmBox('Remover o paciente de teste e todos os registros dele? Os seus pacientes reais não são afetados.', 'Remover'))) return;
      await busy(e.currentTarget, 'Removendo…', async () => { await removeDemo(); toast('Paciente de teste removido.'); renderPatients(); });
    } else {
      const r = await openModal('Criar paciente de teste', `<p>Cria um paciente fictício com consentimento, anamnese e duas evoluções, para você testar o sistema.</p>
        <label class="field">E-mail para testar o portal (opcional)<input type="email" name="email" placeholder="um e-mail seu de teste"><small>Se informar, a evolução revisada já fica liberada para esse e-mail ver como paciente.</small></label>`,
      { okText: 'Criar', onOk: (d) => createDemo({ email: d.querySelector('[name=email]').value }) });
      if (r && r.id) { toast('Paciente de teste criado.'); goto(`#/pacientes/${r.id}`); }
    }
  };
  document.addEventListener('click', function h(e) { if (!document.contains($('#ptable'))) return document.removeEventListener('click', h); if (e.target.closest('#add2')) addP(); });
}

/* =====================================================================
   FICHA DO PACIENTE
   ===================================================================== */
/* ---------- links públicos ---------- */
const linkUrl = (token) => `${location.origin}${location.pathname}#/l/${token}`;
const LINK_DAYS = [[1, '1 dia'], [3, '3 dias'], [7, '7 dias'], [14, '14 dias'], [30, '30 dias']];
const daysSel = (def) => `<label class="field">Válido por<select name="days">${LINK_DAYS.map(([v, l]) => `<option value="${v}" ${v === def ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
const expiresIn = (days) => new Date(Date.now() + days * 864e5).toISOString();

const linksPanel = (links) => `<div class="panel">
  <div class="panel-head"><h3>Links enviados</h3></div>
  ${links.length ? links.map((l) => {
    const expired = new Date(l.expires_at) < new Date();
    const st = l.kind === 'anamnese'
      ? (l.responded_at ? chip(`Respondida em ${fmtDate(l.responded_at)}`, 'ok') : expired ? chip('Expirado') : chip('Aguardando', 'warn'))
      : (expired ? chip('Expirado') : chip('Ativo', 'ok'));
    return `<div class="small" style="margin-bottom:10px">${l.kind === 'anamnese' ? 'Anamnese' : 'Relatório'} · enviado em ${fmtDate(l.created_at)}<br>${st} <button class="link" data-rlink="${l.id}">Revogar</button></div>`;
  }).join('') : '<p class="muted small">Nenhum link enviado.</p>'}
</div>`;

function showLinkModal(url, expires, msg, phone, note = '') {
  const wa = waLink(phone, `${msg}\n\n${url}`);
  return openModal('Link pronto', `
    <p>Este link vale até <b>${esc(fmtDate(expires))}</b>. Você pode revogá-lo na ficha do paciente.</p>
    <label class="field">Endereço do link<input readonly id="lk-url" value="${esc(url)}"></label>
    ${note ? `<p class="small muted">${esc(note)}</p>` : ''}
    <div class="row"><button type="button" class="btn quiet" id="lk-copy">${icon('file')}Copiar link</button>${wa
      ? `<a class="btn" target="_blank" rel="noopener" href="${esc(wa)}">Enviar pelo WhatsApp</a>`
      : '<span class="small muted">Cadastre o telefone do paciente para enviar pelo WhatsApp.</span>'}</div>`,
  { cancelText: 'Fechar', onOpen: (d) => {
    $('#lk-copy', d).onclick = async () => {
      try { await navigator.clipboard.writeText(url); toast('Link copiado.'); }
      catch { $('#lk-url', d).select(); toast('Selecione o endereço e copie.', 'err'); }
    };
  } });
}

async function anamneseLinkModal(p, id) {
  const tpls = api.templatesForMe(await api.listTemplates(), state.profile).filter((t) => t.kind === 'anamnese');
  if (!tpls.length) return toast('Nenhum modelo de anamnese disponível. Crie um em Modelos.', 'err');
  const r = await openModal('Anamnese por link', `
    <p>O(a) paciente responde no próprio celular, sem login. A resposta entra na ficha como rascunho para você revisar.</p>
    <label class="field">Modelo<select name="tpl">${tpls.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
    ${daysSel(7)}`, { okText: 'Gerar link', onOk: (d) => ({ tpl: d.querySelector('[name=tpl]').value, days: Number(d.querySelector('[name=days]').value) }) });
  if (!r || r === true) return;
  const token = newToken(), expires = expiresIn(r.days);
  await api.createShareLink({ token, kind: 'anamnese', patient_id: id, template_id: r.tpl, expires_at: expires });
  await showLinkModal(linkUrl(token), expires, `Olá, ${p.name}! Segue o link para você preencher sua anamnese antes da nossa primeira conversa. Leva uns minutos e pode ser feito pelo celular.`, p.phone);
  renderPatientDetail(id);
}

async function relatorioLinkModal(p, id, reports) {
  const revs = reports.filter((x) => x.status === 'revisado' && (x.kind === 'sessao' || x.kind === 'periodo'));
  if (!revs.length) return toast('Revise um relatório antes de enviar por link.', 'err');
  const r = await openModal('Relatório por link', `
    <p>Quem tiver o link lê o relatório e baixa em PDF ou Word. Só aparecem as partes marcadas como visíveis ao paciente.</p>
    <label class="field">Relatório<select name="rep">${revs.map((x) => `<option value="${x.id}">${esc(x.title)} (${esc(fmtDate(x.session_date))})</option>`).join('')}</select></label>
    ${daysSel(14)}
    <label class="field">Senha (opcional)<input name="pw" type="password" autocomplete="new-password" placeholder="Deixe em branco para não exigir"></label>`,
  { okText: 'Gerar link', onOk: (d) => ({ rep: d.querySelector('[name=rep]').value, days: Number(d.querySelector('[name=days]').value), pw: d.querySelector('[name=pw]').value }) });
  if (!r || r === true) return;
  const token = newToken(), expires = expiresIn(r.days);
  const password_hash = r.pw ? await sha256(`${token}:${r.pw}`) : null;
  await api.createShareLink({ token, kind: 'relatorio', patient_id: id, report_id: r.rep, expires_at: expires, password_hash });
  await showLinkModal(linkUrl(token), expires, `Olá, ${p.name}! Segue o link para acessar o seu relatório.`, p.phone,
    r.pw ? 'Envie a senha em outra mensagem, não junto com o link.' : '');
  renderPatientDetail(id);
}

// Soma recebido e a receber das sessões realizadas (valor do atendimento ou valor padrão do paciente).
const paymentsOf = (apts, admin) => {
  const price = Number(admin?.session_price) || 0;
  const real = apts.filter((a) => a.status === 'realizado');
  const amt = (a) => (a.amount != null ? Number(a.amount) : price);
  return {
    realizados: real.length,
    paid: real.filter((a) => a.payment_status === 'pago').reduce((s, a) => s + amt(a), 0),
    open: real.filter((a) => a.payment_status !== 'pago').reduce((s, a) => s + amt(a), 0),
  };
};

export async function renderPatientDetail(id) {
  const main = shell('pacientes'); loading(main);
  const [p, consents, reports, apts, admin, links] = await Promise.all([api.getPatient(id), api.listConsents(id), api.listReports({ patientId: id }),
    api.listAppointments({ patientId: id }), api.getPatientAdmin(id), api.listShareLinks(id)]);
  const active = api.hasActiveConsent(consents);
  const payments = paymentsOf(apts, admin);
  const pendentes = apts.filter((a) => a.status === 'realizado' && a.payment_status !== 'pago');
  const hoje = todayISO();
  const proximas = apts.filter((a) => a.date >= hoje && a.status !== 'cancelado')
    .sort((x, y) => (x.date + (x.time || '')).localeCompare(y.date + (y.time || ''))).slice(0, 8);
  const proximasHtml = `<div class="panel-head" style="margin-top:22px"><h2>Próximas sessões</h2></div>
    ${proximas.length ? `<div class="table">${proximas.map((a) => `<div class="tr" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="grow t">${fmtDate(a.date)} · ${esc(String(a.time || '').slice(0, 5))}<small class="muted"> · ${a.duration_min || 50} min</small></span>
      <select data-pst="${a.id}" aria-label="Situação da sessão" style="width:auto;margin:0;min-height:0;padding:5px 8px">${Object.entries(ATT_STATUS).map(([k, l]) => `<option value="${k}" ${k === a.status ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>`).join('')}</div>` : '<p class="muted small">Nenhuma sessão agendada. Use “Agendar sessão”.</p>'}`;
  const financeiroPanel = `<div class="panel">
          <div class="panel-head"><h3>Financeiro e agenda</h3></div>
          <p class="small">Recebido: <b>${brl(payments.paid)}</b><br>A receber: <b>${brl(payments.open)}</b><br>Sessões realizadas: <b>${payments.realizados}</b> · Valor da sessão: <b>${admin?.session_price != null ? brl(admin.session_price) : 'não definido'}</b></p>
          <div class="row" style="gap:8px;flex-wrap:wrap">${pendentes.length ? `<button class="btn sm" id="cobrar-pac">Cobrar ${brl(payments.open)}</button>` : ''}<a class="btn quiet sm" href="#/financeiro?aba=cobrancas">Ver cobranças</a></div>
        </div>`;
  const anamneses = reports.filter((r) => r.kind === 'anamnese');
  const evolucoes = reports.filter((r) => r.kind === 'sessao');
  const periodos = reports.filter((r) => r.kind === 'periodo');
  const tl = [...reports].sort((a, b) => String(b.session_date).localeCompare(String(a.session_date)) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const timeline = tl.length ? `<ol class="tline">${tl.map((r) => `<li class="k-${r.kind}"><span class="pt"></span><a class="card" href="#/relatorio/${r.id}">
      <div class="when">${esc(KIND_LABEL[r.kind] || 'Registro')} · ${fmtDate(r.session_date)}</div><div class="row between"><span class="t ellip">${esc(r.title)}</span>${statusChip(r)}</div></a></li>`).join('')}</ol>` : '';
  const group = (title, list, emptyText, cta = '') => `<div class="panel-head" style="margin-top:22px"><h2>${title}</h2>${cta}</div>
    ${list.length ? `<div class="list">${list.map(reportLine).join('')}</div>` : `<p class="muted small">${emptyText}</p>`}`;

  main.innerHTML = backLink('#/pacientes', 'Pacientes') +
    pageHeader(p.name, '', `
      <a class="btn bloom" href="#/nova?paciente=${p.id}">${icon('mic')}Nova evolução</a>
      <a class="btn quiet" href="#/nova?paciente=${p.id}&tipo=anamnese">${icon('file')}${anamneses.length ? 'Nova anamnese' : 'Fazer anamnese'}</a>
      <button class="btn quiet" id="newdoc">${icon('edit')}Novo documento</button>
      <a class="btn quiet" href="#/periodo?paciente=${p.id}">${icon('calendar')}Por período</a>
      <button class="btn quiet" id="agendar">${icon('calendar')}Agendar sessão</button>
      <button class="btn quiet" id="dossier">${icon('download')}Prontuário</button>
      <button class="btn quiet" id="audit">${icon('shield')}Auditoria (PDF)</button>
      <button class="btn quiet" id="link-anamnese">${icon('file')}Anamnese por link</button>
      <button class="btn quiet" id="link-rel">${icon('file')}Relatório por link</button>
      <button class="btn quiet" id="edit">${icon('edit')}Editar</button>`) +
    (isDemo(p) ? callout('<p><b>Paciente de teste.</b> Dados fictícios para você experimentar. Remova em Pacientes quando não precisar mais.</p>', 'warn') : '') +
    meta([p.email ? esc(p.email) : 'sem e-mail', p.phone ? esc(p.phone) : '', p.birth_date ? 'nascimento ' + fmtDate(p.birth_date) : '']) +
    '<div style="height:20px"></div>' +
    (!active ? callout('<p><b>Falta o consentimento deste paciente.</b> Sem ele, a gravação e o envio de áudio ficam bloqueados.</p>', 'warn', '<button class="btn sm" id="consent-top">Registrar agora</button>') : '') +
    (!p.email ? callout('<p>Sem e-mail cadastrado, não é possível liberar relatórios no portal do paciente.</p>', '', '<button class="btn sm quiet" id="edit-mail">Adicionar e-mail</button>') : '') + `
    <div class="cols">
      <section>
        ${proximasHtml}
        <div class="panel-head" style="margin-top:22px"><h2>Linha do tempo</h2><span class="muted small">${anamneses.length} anamnese · ${evolucoes.length} evoluções · ${periodos.length} por período</span></div>
        ${timeline || emptyState('Nenhum registro ainda', 'Comece pela anamnese (entrevista inicial) ou registre a primeira evolução.', `<div class="row"><a class="btn quiet" href="#/nova?paciente=${p.id}&tipo=anamnese">${icon('file')}Fazer anamnese</a><a class="btn bloom" href="#/nova?paciente=${p.id}">${icon('mic')}Nova evolução</a></div>`)}
        ${p.notes ? `<h3 style="margin-top:26px">Observações</h3><p class="pre">${esc(p.notes)}</p>` : ''}
      </section>
      <aside>
        ${financeiroPanel}
        ${linksPanel(links)}
        <div class="panel">
          <div class="panel-head"><h3>Consentimento (LGPD)</h3>${active ? chip('Ativo', 'ok') : chip('Pendente', 'warn')}</div>
          ${consents.length ? consents.map((c) => `
            <div class="small" style="margin-bottom:8px">${fmtDateTime(c.granted_at)}, ${esc(c.channel)}${c.revoked_at
              ? `<br><b>Revogado em ${fmtDateTime(c.revoked_at)}</b>` : ` <button class="link" data-revoke="${c.id}">Revogar</button>`}</div>`).join('')
            : '<p class="muted small">Nenhum registro.</p>'}
          <button class="btn quiet sm" id="consent">Registrar consentimento</button>
        </div>
        <div class="panel">
          <h3>Portal do paciente</h3>
          ${p.email
            ? `<p class="small">O paciente cria uma conta como <b>Paciente</b> em <code>${esc(siteUrl())}</code> com o e-mail <b>${esc(p.email)}</b>. Ele vê só o que você revisar e liberar.</p>`
            : '<p class="muted small">Cadastre o e-mail do paciente para ativar o portal.</p>'}
        </div>
        <div class="panel flat">
          <h3>Ações com cuidado</h3>
          <div class="stack-btns" style="margin-top:8px">
            <button class="btn quiet sm" id="archive">${p.archived ? 'Desarquivar paciente' : 'Arquivar paciente'}</button>
            <button class="btn danger sm" id="del">Excluir paciente e relatórios</button>
          </div>
        </div>
      </aside>
    </div>`;

  const editIt = async () => { if (await patientModal(p)) renderPatientDetail(id); };
  $('#edit').onclick = editIt;
  $('#dossier').onclick = async () => {
    if (!reports.length) return toast('Este paciente ainda não tem registros.', 'err');
    const r = await openModal('Prontuário completo', `
      <p>Reúne anamnese, evoluções e relatórios de <b>${esc(p.name)}</b> em um só documento, com o seu timbre.</p>
      <label class="check"><input type="checkbox" name="only">Incluir só as seções visíveis ao paciente</label>
      <label class="field">Formato<select name="fmt"><option value="pdf">PDF (imprimir ou salvar)</option><option value="word">Word</option></select></label>`,
    { okText: 'Gerar prontuário', onOk: (d) => ({ only: d.querySelector('[name=only]').checked, fmt: d.querySelector('[name=fmt]').value }) });
    if (!r || r === true) return;
    const full = await api.listReports({ patientId: id, withSections: true });
    const args = { patient: p, professional: state.profile, reports: full, only: r.only };
    api.logExport('prontuario', id, { registros: full.length, somente_visiveis: r.only });
    (r.fmt === 'word' ? exportDossierWord : exportDossierPdf)(args);
  };
  $('#audit').onclick = async () => {
    if (!reports.length) return toast('Este paciente ainda não tem registros.', 'err');
    const full = await api.listReports({ patientId: id, withSections: true });
    const [versions, audits] = await Promise.all([
      Promise.all(full.map((r) => api.listVersions(r.id).catch(() => []))),
      Promise.all(full.map((r) => api.listAudit(r.id).catch(() => []))),
    ]);
    api.logExport('auditoria', id, { registros: full.length });
    exportAuditoriaPdf({
      patient: p, professional: state.profile, reports: full, consents, appointments: apts, admin, payments,
      versions: Object.fromEntries(full.map((r, i) => [r.id, versions[i]])),
      audits: Object.fromEntries(full.map((r, i) => [r.id, audits[i]])),
    });
  };
  $('#agendar').onclick = async () => { if (await appointmentModal({ patients: [p], date: hoje })) renderPatientDetail(id); };
  $$('[data-pst]').forEach((sel) => (sel.onchange = async () => {
    try { await api.updateAppointment(sel.dataset.pst, { status: sel.value }); toast('Situação atualizada.'); renderPatientDetail(id); }
    catch (err) { toast(err.message, 'err'); }
  }));
  if ($('#cobrar-pac')) $('#cobrar-pac').onclick = () => abrirCobranca({ profile: state.profile, patient: { name: p.name, phone: p.phone },
    items: pendentes.map((a) => ({ date: a.date, time: a.time, amount: a.amount != null ? Number(a.amount) : Number(admin?.session_price) || 0 })) });
  $('#link-anamnese').onclick = () => anamneseLinkModal(p, id);
  $('#link-rel').onclick = () => relatorioLinkModal(p, id, reports);
  $$('[data-rlink]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Revogar este link? Quem já tiver o endereço deixa de ter acesso.', 'Revogar'))) return;
    await api.revokeShareLink(b.dataset.rlink); toast('Link revogado.'); renderPatientDetail(id);
  }));
  if ($('#edit-mail')) $('#edit-mail').onclick = editIt;
  $('#archive').onclick = async () => { await api.savePatient({ id, archived: !p.archived }); toast(p.archived ? 'Paciente reativado.' : 'Paciente arquivado.'); renderPatientDetail(id); };
  $('#del').onclick = async () => {
    if (!(await confirmBox(`Excluir ${p.name} e TODOS os relatórios dele? Esta ação não pode ser desfeita.`, 'Excluir definitivamente'))) return;
    await api.deletePatient(id); toast('Paciente excluído.'); goto('#/pacientes');
  };
  $$('[data-revoke]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Revogar este consentimento? A gravação de novas sessões ficará bloqueada.', 'Revogar'))) return;
    await api.revokeConsent(b.dataset.revoke); toast('Consentimento revogado.'); renderPatientDetail(id);
  }));
  const addConsent = async () => {
    const text = state.profile.consent_text || DEFAULT_CONSENT;
    const ok = await openModal('Registrar consentimento', `
      <div class="consent-text">${esc(text)}</div>
      <label class="field">Como foi obtido
        <select name="channel"><option value="presencial">Presencial (verbal)</option><option value="escrito">Termo assinado</option><option value="digital">Digital (e-mail ou mensagem)</option></select></label>
      <label class="check"><input type="checkbox" name="ok" required>Confirmo que o(a) paciente leu e concordou com o termo acima.</label>
      <p class="muted small">Você pode ajustar este texto em Configurações. Recomenda-se revisão jurídica.</p>`,
    { okText: 'Registrar consentimento', wide: true, onOk: (d) => api.addConsent({ patient_id: id, consent_text: text, channel: d.querySelector('[name=channel]').value }) });
    if (ok) { toast('Consentimento registrado.'); renderPatientDetail(id); }
  };
  $('#consent').onclick = addConsent;
  $('#newdoc').onclick = () => newDocument(id);
  if ($('#consent-top')) $('#consent-top').onclick = addConsent;
}

/** Cria um documento livre para o paciente e abre o editor. */
export async function newDocument(patientId) {
  const rep = await openModal('Novo documento', `<p class="muted">Documento livre, escrito como no Word. O paciente só vê depois que você revisar e liberar.</p>
    <label class="field">Título<input name="t" required placeholder="Ex.: Declaração, Plano terapêutico, Parecer"></label>`,
  { okText: 'Criar e abrir', onOk: (d) => {
    const t = d.querySelector('[name=t]').value.trim(); if (!t) throw new Error('Digite um título para o documento.');
    return api.createReport({ patient_id: patientId, template_id: null, kind: 'documento', title: t, session_date: todayISO(), status: 'rascunho', sections: [{ title: 'Documento', text: '', patient_visible: true }] });
  } });
  if (rep && rep.id) goto(`#/relatorio/${rep.id}`);
}
