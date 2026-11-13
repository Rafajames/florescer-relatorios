import * as api from './api.js';
import * as ai from './ai.js';
import { state, DEFAULT_CONSENT } from './state.js';
import { createDemo, removeDemo, isDemo } from './demo.js';
import { exportDossierWord, exportDossierPdf, exportAuditoriaPdf, KIND_LABEL, brl, ATT_STATUS } from './export.js';
import { newToken, sha256, waLink, cobravel, cobrancaVencida } from './cobranca.js';
import { abrirCobranca, registrarPagamento, agendarCobranca } from './cobrar.js';
import { appointmentModal, lembretesModal } from './views-administrativo.js';
import { metasPanel, escalasPanel } from './views-clinico.js';
import {
  $, $$, esc, fmtDate, fmtDateTime, toast, openModal, confirmBox, busy, statusChip, chip, meta, callout,
  shell, loading, pageHeader, backLink, icon, greeting, longDate, emptyState, todayISO,
  celebrar, sumir,
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
  const amanhaISO = iso(new Date(Date.now() + 864e5));
  const amanhaAps = valid.filter((a) => a.date === amanhaISO && a.status === 'agendado');
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

  const pedidosRemarcar = (aps || []).filter((a) => a.confirm_status === 'remarcar' && a.status === 'agendado');
  const attention = [
    ...pedidosRemarcar.slice(0, 3).map((a) => ({ c: 'c-pet', t: `Remarcação · ${esc(a.patients?.name || 'Paciente')}`, s: `pediu para remarcar a sessão de ${fmtDate(a.date)} às ${String(a.time || '').slice(0, 5)}`, h: `#/administrativo?ver=lista&semana=${a.date}`, b: 'Ver pedido' })),
    ...drafts.slice(0, 3).map((r) => ({ c: 'c-blo', t: `Rascunho · ${esc(r.patients?.name || r.title)}`, s: `${esc(r.title)} · ${fmtDate(r.session_date)}`, h: `#/relatorio/${r.id}`, b: 'Revisar' })),
    ...(ready.length ? [{ c: 'c-pet', t: `${ready.length} ${ready.length === 1 ? 'relatório pronto' : 'relatórios prontos'}`, s: 'revisados, ainda não liberados ao paciente', h: '#/relatorios', b: 'Liberar' }] : []),
    ...noConsent.slice(0, 3).map((x) => ({ c: 'c-warn', t: `Consentimento · ${esc(x.name)}`, s: 'registre antes de gravar a sessão', h: `#/pacientes/${x.id}`, b: 'Abrir' })),
  ];

  // Aniversariantes do mês (pacientes ativos com data de nascimento), do dia mais próximo para o mais distante.
  const mesHoje = today.slice(5, 7), diaHoje = Number(today.slice(8, 10));
  const niver = patients.filter((x) => !x.archived && x.birth_date && x.birth_date.slice(5, 7) === mesHoje)
    .map((x) => ({ ...x, dia: Number(x.birth_date.slice(8, 10)), idade: Number(today.slice(0, 4)) - Number(x.birth_date.slice(0, 4)) }))
    .sort((a, b) => a.dia - b.dia);
  const niverHtml = niver.length ? `<section class="panel" style="margin-bottom:16px"><div class="panel-head"><h3>Aniversariantes de ${esc(new Date().toLocaleDateString('pt-BR', { month: 'long' }))}</h3></div>
    ${niver.map((x) => { const wa = waLink(x.phone, `Olá! Hoje é um dia especial: parabéns, ${x.name.split(' ')[0]}! Muita saúde e alegria. Um abraço de ${p.full_name}.`);
      return `<div class="niver"><span class="grow"><a href="#/pacientes/${x.id}" style="color:inherit"><b>${esc(x.name)}</b></a><small class="muted"> · dia ${x.dia} · faz ${x.idade} ano${x.idade === 1 ? '' : 's'}</small></span>
        ${x.dia === diaHoje ? chip('É hoje', 'bloom') : x.dia < diaHoje ? chip('Já passou') : ''}${wa ? `<a class="btn quiet sm" target="_blank" rel="noopener" href="${esc(wa)}">Dar parabéns</a>` : ''}</div>`; }).join('')}</section>` : '';

  // Cobranças agendadas que vencem hoje (dia fixo do mês ou data avulsa) e ainda têm sessões em aberto.
  let cobHoje = 0;
  try {
    const [abertas, admins] = await Promise.all([api.listOpenCharges(), api.listPatientAdmins()]);
    const comAberto = new Set(abertas.filter((a) => cobravel(a, p)).map((a) => a.patient_id));
    cobHoje = admins.filter((a) => comAberto.has(a.patient_id) && cobrancaVencida(a, todayISO())).length;
  } catch { cobHoje = 0; }
  // Novidades vindas dos pacientes; "visto" fica guardado neste navegador.
  let nov = []; try { nov = await api.listNovidades(); } catch { nov = []; }
  // "visto" fica no perfil (vale no computador e no celular); o navegador guarda uma cópia para o caso de falhar
  let visto = state.profile?.preferences?.novidades_visto || ''; try { const l = localStorage.getItem('potira-novidades-visto') || ''; if (l > visto) visto = l; } catch { /* sem armazenamento */ }
  const novas = nov.filter((n) => n.quando > visto);
  const novHtml = novas.length ? `<section class="panel novidades" style="margin-bottom:16px"><div class="panel-head"><h3>${icon('sparkle')}Novidades <span class="nov-n">${novas.length}</span></h3><button class="btn quiet sm" id="nov-ok">Marcar como visto</button></div>
    ${novas.slice(0, 8).map((n) => `<a class="nov${n.alerta ? ' alerta' : ''}" href="${n.h}"><span class="grow"><b>${esc(n.nome)}</b> ${esc(n.txt)}</span><small class="muted">${fmtDateTime(n.quando)}</small></a>`).join('')}
    ${novas.length > 8 ? `<p class="small muted">E mais ${novas.length - 8}.</p>` : ''}</section>` : '';
  main.innerHTML = pageHeader(`${greeting()}, ${esc(first)}`, esc(longDate())) + (cobHoje ? callout(`<p><b>${cobHoje} cobrança${cobHoje === 1 ? '' : 's'} agendada${cobHoje === 1 ? '' : 's'} para hoje.</b> A mensagem e o PIX já estão prontos; é só conferir e enviar.</p>`, '', '<a class="btn sm" href="#/financeiro?aba=cobrancas">Ver cobranças</a>') : '') + novHtml + niverHtml + `
  <div class="dash">
    <section class="dcard wide" aria-label="Sessões de hoje">
      <h3>Sessões de hoje</h3><span class="ill">${ART.clip}</span>
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
      <div class="agl">${todayAps.length ? todayAps.map((a) => `<div class="agi hoje-it">
          <span class="ck ${a.status === 'realizado' ? 'ok' : a.status.startsWith('falta') ? 'no' : ''}"></span><span class="tm">${hh(a.time) || '—'}</span>
          <a class="nm" href="#/pacientes/${a.patient_id}" style="color:inherit;text-decoration:none"><b>${esc(a.patients?.name || 'Paciente')}</b><span>${esc(ATT_STATUS[a.status] || '')}${a.duration_min ? ` · ${a.duration_min} min` : ''}${a.confirm_status === 'confirmado' ? ' · confirmou' : a.confirm_status === 'remarcar' ? ' · pediu para remarcar' : ''}</span></a>
          <span class="hoje-act">${a.status === 'agendado' ? `<a class="btn sm" href="#/nova?paciente=${a.patient_id}&sessao=${a.id}">Iniciar</a><button class="btn quiet sm" data-hfalta="${a.id}">Falta</button>`
            : a.status === 'realizado' ? `<a class="btn quiet sm" href="#/nova?paciente=${a.patient_id}&sessao=${a.id}">Evolução</a>` : ''}</span></div>`).join('')
        : '<p class="empty-mini">Nenhuma sessão agendada para hoje.</p>'}</div>
      <div class="foot">${amanhaAps.length ? `<button class="btn quiet" id="h-lembretes">Lembretes de amanhã (${amanhaAps.length})</button>` : ''}<a class="btn quiet" href="#/administrativo">Ver agenda</a><a class="btn" href="#/administrativo">${icon('plus')}Agendar</a></div>
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

  if (!p.is_admin) import('./tour.js').then((m) => m.maybeTour()).catch(() => {});
  if ($('#h-lembretes')) $('#h-lembretes').onclick = () => lembretesModal({ aps: amanhaAps, patients, title: `Lembretes de amanhã (${fmtDate(amanhaISO)})` });
  const novOk = $('#nov-ok');
  if (novOk) novOk.onclick = () => {
    const ate = novas[0].quando;
    try { localStorage.setItem('potira-novidades-visto', ate); } catch { /* sem armazenamento */ }
    api.updateProfile(state.profile.id, { preferences: { ...(state.profile.preferences || {}), novidades_visto: ate } }).then((np) => { if (np) state.profile = np; }).catch(() => {});
    sumir(novOk.closest('.novidades'));
  };
  $$('[data-hfalta]').forEach((b) => (b.onclick = async () => {
    const a = todayAps.find((x) => x.id === b.dataset.hfalta);
    if (!(await confirmBox(`Marcar falta de ${a.patients?.name || 'paciente'} na sessão de hoje?`, 'Marcar falta'))) return;
    try { await api.setAppointmentStatus(a, 'falta'); toast('Falta registrada.'); renderDashboard(); } catch (err) { toast(err.message, 'err'); }
  }));
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
      }).then((r) => { if (!existing.id) celebrar('paciente', 'Primeiro paciente cadastrado. Que floresça!'); return r; });
    },
  });
}

const lastSession = (p) => (p.reports || []).filter((r) => r.kind === 'sessao').map((r) => r.session_date).sort().pop() || '';

export async function renderPatients() {
  const main = shell('pacientes'); loading(main);
  let all = await api.listPatients(false);
  let showArchived = false;

  main.innerHTML = pageHeader('Pacientes', `${all.filter((x) => !x.archived).length} em atendimento`, `<button class="btn quiet" id="demo">${all.some(isDemo) ? 'Remover paciente de teste' : 'Criar paciente de teste'}</button><button class="btn" id="add">${icon('plus')}Novo paciente</button>`) + `
    <div class="row lista-busca">
      <input id="q" type="search" placeholder="Buscar por nome ou e-mail" style="max-width:340px;margin:0" aria-label="Buscar paciente">
      <div class="pilulas" role="group" aria-label="Filtro">${[['', 'Todos'], ['semconsent', 'Sem consentimento'], ['rascunho', 'Com rascunhos']].map(([v, t], i) => `<button type="button" class="pilula${i ? '' : ' on'}" data-f="${v}">${t}</button>`).join('')}</div>
      <span class="grow"></span>
      <select id="sort" style="width:auto;margin:0" aria-label="Ordenar">
        <option value="nome">Ordenar por nome</option><option value="recente">Atendidos recentemente</option></select>
      <button type="button" class="pilula" id="arch" aria-pressed="false">Arquivados</button>
      <div class="pilulas" role="group" aria-label="Formato">${[['cartoes', 'Cartões'], ['lista', 'Lista']].map(([v, t]) => `<button type="button" class="pilula" data-fmt="${v}">${t}</button>`).join('')}</div>
    </div>
    <div class="pac-grade" id="ptable"></div>`;

  let f = '';
  const draw = () => {
    const q = $('#q').value.toLowerCase(), s = $('#sort').value;
    let rows = all.filter((p) => (!q || p.name.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q))
      && (f !== 'semconsent' || !api.hasActiveConsent(p.consents))
      && (f !== 'rascunho' || (p.reports || []).some((r) => r.status === 'rascunho')));
    rows = [...rows].sort((a, b) => s === 'recente' ? lastSession(b).localeCompare(lastSession(a)) : a.name.localeCompare(b.name, 'pt-BR'));
    $('#ptable').innerHTML =
      (rows.length ? rows.map((p) => {
        const reps = p.reports || [], dr = reps.filter((r) => r.status === 'rascunho').length, ult = lastSession(p);
        const ini = p.name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
        const cor = [...p.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 5, 3) * 25; // 5 tons entre o petróleo e o rosa da marca
        return `<a class="pac-card" href="#/pacientes/${p.id}">
          <span class="pac-av" style="--h:${cor}">${esc(ini)}</span>
          <span class="grow"><b class="ellip">${esc(p.name)}</b><small>${ult ? 'Última sessão ' + fmtDate(ult) : 'Nenhuma sessão ainda'} · ${reps.length} registro${reps.length === 1 ? '' : 's'}</small>
            <span class="pac-chips">${p.archived ? chip('Arquivado') : ''}${!api.hasActiveConsent(p.consents) ? chip('Sem consentimento', 'warn') : ''}${dr ? chip(`${dr} rascunho${dr > 1 ? 's' : ''}`, 'warn') : ''}${isDemo(p) ? chip('Teste') : ''}</span></span>
          ${icon('right')}</a>`;
      }).join('') : emptyState(all.length ? 'Nenhum paciente encontrado' : 'Você ainda não cadastrou pacientes', all.length ? 'Tente outro termo ou limpe o filtro.' : 'Cadastre o primeiro para registrar consentimento e iniciar uma sessão.', all.length ? '' : `<button class="btn" id="add2">${icon('plus')}Cadastrar paciente</button>`));
  };
  draw();
  ['#q', '#sort'].forEach((id) => ($(id).oninput = draw));
  $$('.pilula[data-f]').forEach((b) => (b.onclick = () => { f = b.dataset.f; $$('.pilula[data-f]').forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
  $('#arch').onclick = async (e) => { showArchived = !showArchived; e.currentTarget.classList.toggle('on', showArchived); e.currentTarget.setAttribute('aria-pressed', showArchived); all = await api.listPatients(showArchived); draw(); };
  // formato da lista: cartões ou lista compacta (lembrado neste navegador; com muitos pacientes começa compacta)
  const setFmt = (v, lembrar) => { $('#ptable').classList.toggle('compacta', v === 'lista'); $$('[data-fmt]').forEach((x) => x.classList.toggle('on', x.dataset.fmt === v)); if (lembrar) { try { localStorage.setItem('pac-fmt', v); } catch { /* sem armazenamento */ } } };
  let fmt0 = null; try { fmt0 = localStorage.getItem('pac-fmt'); } catch { /* sem armazenamento */ }
  setFmt(fmt0 || (all.length > 24 ? 'lista' : 'cartoes'), false);
  $$('[data-fmt]').forEach((b) => (b.onclick = () => setFmt(b.dataset.fmt, true)));
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

const LINK_NOME = { anamnese: 'Anamnese', relatorio: 'Relatório', confirmacao: 'Confirmação de presença', orientacao: 'Orientações para casa' };
const linksPanel = (links) => `<div class="panel">
  <div class="panel-head"><h3>Links enviados</h3></div>
  ${links.length ? links.slice(0, 12).map((l) => {
    const expired = new Date(l.expires_at) < new Date();
    const st = l.kind === 'anamnese'
      ? (l.responded_at ? chip(`Respondida em ${fmtDate(l.responded_at)}`, 'ok') : expired ? chip('Expirado') : chip('Aguardando', 'warn'))
      : l.kind === 'confirmacao' ? (l.responded_at ? chip(`Respondeu em ${fmtDate(l.responded_at)}`, 'ok') : expired ? chip('Expirado') : chip('Sem resposta', 'warn'))
        : l.kind === 'orientacao' ? (l.opened_at ? chip(`Aberto em ${fmtDate(l.opened_at)}`, 'ok') : expired ? chip('Expirado') : chip('Ainda não abriu', 'warn'))
          : (expired ? chip('Expirado') : chip('Ativo', 'ok'));
    return `<div class="small" style="margin-bottom:10px">${LINK_NOME[l.kind] || 'Link'} · enviado em ${fmtDate(l.created_at)}<br>${st} <button class="link" data-rlink="${l.id}">Revogar</button></div>`;
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

/* Anamnese por link: o profissional parte dos campos essenciais e edita, remove ou acrescenta perguntas. */
const AN_TIPOS = [['curto', 'Resposta curta'], ['longo', 'Resposta longa'], ['data', 'Data'], ['marcar', 'Sim / Não']];
const AN_KEY = 'potira.anamnese.campos';
const anEssenciais = (p) => [
  { title: 'Nome completo', type: 'curto', value: p.name },
  { title: 'Nomes dos pais ou responsáveis', type: 'curto' },
  { title: 'Data de nascimento', type: 'data' },
  { title: 'Diagnóstico', type: 'curto', hint: 'Se houver. Pode deixar em branco.' },
  { title: 'Queixa principal', type: 'longo', hint: 'O que motivou a procura pelo atendimento?' },
];
const anSalvos = () => { try { const v = JSON.parse(localStorage.getItem(AN_KEY)); return Array.isArray(v) && v.length ? v : null; } catch { return null; } };

async function anamneseLinkModal(p, id) {
  const tpls = api.templatesForMe(await api.listTemplates(), state.profile).filter((t) => t.kind === 'anamnese');
  const salvos = anSalvos();
  let fields = anEssenciais(p);
  const r = await openModal('Anamnese por link', `
    <p>O(a) paciente responde no próprio celular, sem login. A resposta entra na ficha como rascunho para você revisar.</p>
    ${tpls.length || salvos ? `<label class="field">Começar com<select id="an-base">
      <option value="">Campos essenciais</option>
      ${salvos ? '<option value="salvos">Minha última lista de perguntas</option>' : ''}
      ${tpls.map((t) => `<option value="${t.id}">Essenciais + modelo: ${esc(t.name)}</option>`).join('')}</select></label>` : ''}
    <div class="an-head"><b>Perguntas do formulário</b><span class="muted small">Edite o texto, mude o tipo, reordene ou remova.</span></div>
    <div id="an-fields"></div>
    <button type="button" class="btn quiet sm" id="an-add">${icon('plus')}Adicionar pergunta</button>
    ${daysSel(7)}`,
  { okText: 'Gerar link', wide: true,
    onOpen: (d) => {
      const box = $('#an-fields', d);
      const draw = () => {
        box.innerHTML = fields.map((f, i) => `<div class="an-row" data-i="${i}">
          <input class="an-t" value="${esc(f.title)}" placeholder="Escreva a pergunta" aria-label="Pergunta ${i + 1}" maxlength="200">
          <select class="an-ty" aria-label="Tipo de resposta">${(f.type === 'escolha' ? [...AN_TIPOS, ['escolha', 'Lista de opções']] : AN_TIPOS).map(([v, l]) => `<option value="${v}" ${v === (f.type || 'longo') ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <span class="an-act"><button type="button" class="icon-btn" data-up title="Subir" aria-label="Subir" ${i ? '' : 'disabled'}>${icon('up')}</button>
          <button type="button" class="icon-btn" data-down title="Descer" aria-label="Descer" ${i < fields.length - 1 ? '' : 'disabled'}>${icon('down')}</button>
          <button type="button" class="icon-btn" data-rm title="Remover" aria-label="Remover pergunta">${icon('trash')}</button></span></div>`).join('')
          || '<p class="muted small">Nenhuma pergunta. Adicione ao menos uma.</p>';
      };
      draw();
      box.addEventListener('input', (e) => { const row = e.target.closest('.an-row'); if (row && e.target.classList.contains('an-t')) fields[+row.dataset.i].title = e.target.value; });
      box.addEventListener('change', (e) => { const row = e.target.closest('.an-row'); if (row && e.target.classList.contains('an-ty')) fields[+row.dataset.i].type = e.target.value; });
      box.addEventListener('click', (e) => {
        const row = e.target.closest('.an-row'); const b = e.target.closest('button'); if (!row || !b) return;
        const i = +row.dataset.i;
        if (b.hasAttribute('data-rm')) fields.splice(i, 1);
        else if (b.hasAttribute('data-up') && i > 0) [fields[i - 1], fields[i]] = [fields[i], fields[i - 1]];
        else if (b.hasAttribute('data-down') && i < fields.length - 1) [fields[i + 1], fields[i]] = [fields[i], fields[i + 1]];
        else return;
        draw();
      });
      $('#an-add', d).onclick = () => { fields.push({ title: '', type: 'longo' }); draw(); const ins = box.querySelectorAll('.an-t'); ins[ins.length - 1].focus(); };
      const base = $('#an-base', d);
      if (base) base.onchange = () => {
        const ess = anEssenciais(p);
        if (base.value === 'salvos') fields = salvos.map((f) => (/^nome completo$/i.test(f.title) ? { ...f, value: p.name } : { ...f }));
        else if (base.value) {
          const tem = new Set(ess.map((f) => f.title.toLowerCase()));
          const t = tpls.find((x) => x.id === base.value);
          fields = [...ess, ...(t.sections || []).filter((x) => !tem.has(String(x.title).toLowerCase())).map((x) => ({ title: x.title, type: x.type || 'longo', ...(x.hint ? { hint: x.hint } : {}), ...(x.options ? { options: x.options } : {}) }))];
        } else fields = ess;
        draw();
      };
    },
    onOk: (d) => {
      const limpos = fields.map((f) => ({ ...f, title: String(f.title || '').trim() })).filter((f) => f.title);
      if (!limpos.length) { toast('Adicione ao menos uma pergunta.', 'err'); return false; }
      if (limpos.length > 60) { toast('O formulário aceita até 60 perguntas.', 'err'); return false; }
      return { fields: limpos, days: Number(d.querySelector('[name=days]').value) };
    } });
  if (!r || r === true) return;
  try { localStorage.setItem(AN_KEY, JSON.stringify(r.fields.map(({ value, ...f }) => f))); } catch { /* sem armazenamento: segue */ }
  const token = newToken(), expires = expiresIn(r.days);
  await api.createShareLink({ token, kind: 'anamnese', patient_id: id, fields: r.fields, expires_at: expires });
  await showLinkModal(linkUrl(token), expires, `Olá! Segue o link para preencher a anamnese de ${p.name} antes da nossa primeira conversa. Leva uns minutos e pode ser feito pelo celular.`, p.phone);
  renderPatientDetail(id);
}

/* Arquivos do paciente na pasta do computador (laudos, exames e documentos gravados pela plataforma). */
async function arquivosPanel(box, p) {
  const pasta = await import('./pasta.js');
  if (!pasta.suportada()) { box.innerHTML = ''; return; }
  const st = await pasta.estado();
  const again = () => arquivosPanel(box, p);
  if (st !== 'ok') {
    box.innerHTML = `<div class="panel"><div class="panel-head"><h3>Arquivos no computador</h3></div>
      <p class="muted small">${st === 'sem' ? 'Escolha uma pasta deste computador para guardar laudos, exames e documentos deste paciente.' : 'O navegador precisa liberar de novo o acesso à pasta dos documentos.'}</p>
      ${st === 'sem' ? '<a class="btn quiet sm" href="#/config?aba=dados">Escolher pasta</a>' : '<button class="btn sm" id="arq-lib">Liberar acesso</button>'}</div>`;
    if ($('#arq-lib', box)) $('#arq-lib', box).onclick = async () => { if (!(await pasta.liberar())) toast('O navegador não liberou o acesso.', 'err'); again(); };
    return;
  }
  const lista = await pasta.listar(p.name);
  const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  box.innerHTML = `<div class="panel"><div class="panel-head"><h3>Arquivos no computador</h3>${lista.length ? chip(String(lista.length)) : ''}</div>
    ${lista.length ? lista.slice(0, 30).map((f, i) => `<div class="small arq-it"><button class="link" data-arq="${i}" title="Abrir">${esc(f.nome)}</button>
      <br><span class="muted">${esc(f.tipo)} · ${fmtDate(new Date(f.data).toISOString())} · ${kb(f.tamanho)}</span> <button class="link small" data-arq-del="${i}">excluir</button></div>`).join('')
      : '<p class="muted small">Nenhum arquivo na pasta deste paciente.</p>'}
    <label class="btn quiet sm" style="margin-top:8px;cursor:pointer">${icon('plus')}Anexar laudo ou exame<input type="file" id="arq-add" multiple hidden></label>
    <p class="muted small" style="margin:8px 0 0">Os arquivos ficam só neste computador, na pasta que você escolheu.</p></div>`;
  $$('[data-arq]', box).forEach((b) => (b.onclick = () => pasta.abrir(lista[+b.dataset.arq]).catch((err) => toast(err.message || String(err), 'err'))));
  $$('[data-arq-del]', box).forEach((b) => (b.onclick = async () => {
    const f = lista[+b.dataset.arqDel];
    if (!(await confirmBox(`Excluir "${f.nome}" da pasta do computador? Não dá para desfazer.`, 'Excluir'))) return;
    try { await pasta.apagar(f); toast('Arquivo excluído.'); } catch (err) { toast(err.message || String(err), 'err'); }
    again();
  }));
  $('#arq-add', box).onchange = async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    try { for (const f of files) await pasta.salvar(p.name, 'Laudos e exames', f.name, f); toast(`${files.length} arquivo(s) guardado(s) na pasta do paciente.`); }
    catch (err) { toast(err.message || String(err), 'err'); }
    again();
  };
}

/* Orientações para casa: texto enviado por link, com registro de quando foi aberto. */
async function orientacaoLinkModal(p, id) {
  const r = await openModal('Orientações para casa', `
    <p>A família abre o link e lê as orientações. A ficha mostra quando o link foi aberto.</p>
    <label class="field">Título<input name="t" value="Orientações para casa" maxlength="100" required></label>
    <label class="field">Orientações<textarea name="c" rows="8" maxlength="6000" required placeholder="Ex.: Fazer a atividade de pinça 10 minutos por dia, depois do banho."></textarea></label>
    ${daysSel(30)}`,
  { okText: 'Gerar link', wide: true, onOk: (d) => {
    const t = d.querySelector('[name=t]').value.trim(), c = d.querySelector('[name=c]').value.trim();
    if (!t || !c) { toast('Escreva o título e as orientações.', 'err'); return false; }
    return { t, c, days: Number(d.querySelector('[name=days]').value) };
  } });
  if (!r || r === true) return;
  const token = newToken(), expires = expiresIn(r.days);
  await api.createShareLink({ token, kind: 'orientacao', patient_id: id, content: `# ${r.t}\n${r.c}`, expires_at: expires });
  await showLinkModal(linkUrl(token), expires, `Olá! Seguem as orientações de ${p.name} para fazer em casa.`, p.phone);
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
  const real = apts.filter((a) => cobravel(a, state.profile));
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
  const avulsas = await api.listCharges({ open: true, patientId: id }).catch(() => []);
  const active = api.hasActiveConsent(consents);
  const payments = paymentsOf(apts, admin);
  const pendentes = apts.filter((a) => cobravel(a, state.profile) && a.payment_status !== 'pago');
  const precoPac = Number(admin?.session_price) || 0;
  const itensPend = [...pendentes.map((a) => ({ id: a.id, date: a.date, time: a.time, amount: a.amount != null ? Number(a.amount) : precoPac })),
    ...avulsas.map((c) => ({ id: 'c:' + c.id, date: c.due_date, amount: Number(c.amount || 0), label: c.description }))];
  payments.open += avulsas.reduce((s, c) => s + Number(c.amount || 0), 0);
  const modoTxt = admin?.billing_mode === 'mensal' ? `Mensalidade de ${admin.monthly_fee != null ? brl(admin.monthly_fee) : 'valor não definido'}`
    : admin?.billing_mode === 'pacote' ? `Pacote: restam ${admin.package_balance || 0} sessão(ões)` : '';
  const agendaCob = cobrancaVencida(admin, todayISO()) && (pendentes.length || avulsas.length) ? chip('Cobrar hoje', 'bloom')
    : admin?.next_charge_on ? `Cobrança agendada para <b>${fmtDate(admin.next_charge_on)}</b>` : admin?.billing_day ? `Cobrança todo dia <b>${admin.billing_day}</b>` : 'Sem cobrança agendada';
  const hoje = todayISO();
  const proximas = apts.filter((a) => a.date >= hoje && a.status !== 'cancelado')
    .sort((x, y) => (x.date + (x.time || '')).localeCompare(y.date + (y.time || ''))).slice(0, 8);
  const proximasHtml = `<div class="panel-head" style="margin-top:22px"><h2>Próximas sessões</h2></div>
    ${proximas.length ? `<div class="table">${proximas.map((a) => `<div class="tr" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="grow t">${fmtDate(a.date)} · ${esc(String(a.time || '').slice(0, 5))}<small class="muted"> · ${a.duration_min || 50} min</small></span>
      <select data-pst="${a.id}" aria-label="Situação da sessão" style="width:auto;margin:0;min-height:0;padding:5px 8px">${Object.entries(ATT_STATUS).map(([k, l]) => `<option value="${k}" ${k === a.status ? 'selected' : ''}>${l}</option>`).join('')}</select>
      </div>`).join('')}</div>` : '<p class="muted small">Nenhuma sessão agendada. Use “Agendar sessão”.</p>'}`;
  const financeiroPanel = `<div class="panel">
          <div class="panel-head"><h3>Financeiro</h3>${itensPend.length ? chip(`${itensPend.length} em aberto`, 'warn') : payments.realizados ? chip('Em dia', 'ok') : ''}</div>
          <dl class="fin-dl">
            <div><dt>A receber</dt><dd>${brl(payments.open)}</dd></div>
            <div><dt>Recebido</dt><dd>${brl(payments.paid)}</dd></div>
            <div><dt>Valor da sessão</dt><dd>${admin?.session_price != null ? brl(admin.session_price) : 'não definido'} <button class="link small" id="def-valor">${admin?.session_price != null ? 'Alterar' : 'Definir'}</button></dd></div>
            ${modoTxt ? `<div><dt>Forma de cobrança</dt><dd>${modoTxt}</dd></div>` : ''}
          </dl>
          <p class="small muted" style="margin:4px 0 0">Mensalidade e pacote: <a href="#/financeiro?aba=valores">Financeiro → Valores</a>.</p>
          <p class="small muted" style="margin:6px 0 10px">${agendaCob} <button class="link small" id="agendar-cob">${admin?.billing_day || admin?.next_charge_on ? 'Alterar' : 'Agendar cobrança'}</button></p>
          <div class="row" style="gap:8px;flex-wrap:wrap">${itensPend.length ? `<button class="btn sm" id="cobrar-pac">Cobrar ${brl(payments.open)}</button><button class="btn quiet sm" id="pago-pac">Registrar pagamento</button>` : ''}<a class="btn quiet sm" href="#/financeiro?aba=cobrancas">Ver cobranças</a></div>
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
      <button class="btn quiet" id="agendar">${icon('calendar')}Agendar sessão</button>
      <details class="menu"><summary class="btn quiet">${icon('plus')}Registrar</summary><div class="menu-list">
        <a href="#/nova?paciente=${p.id}&tipo=anamnese">${icon('file')}${anamneses.length ? 'Nova anamnese' : 'Fazer anamnese'}</a>
        <button type="button" id="newdoc">${icon('edit')}Novo documento</button>
        <a href="#/periodo?paciente=${p.id}">${icon('calendar')}Relatório por período</a></div></details>
      <details class="menu"><summary class="btn quiet">${icon('right')}Enviar por link</summary><div class="menu-list">
        <button type="button" id="link-anamnese">${icon('file')}Anamnese para responder</button>
        <button type="button" id="link-rel">${icon('file')}Relatório para ler e baixar</button>
        <button type="button" id="link-ori">${icon('file')}Orientações para casa</button></div></details>
      <button class="btn quiet" id="edit">${icon('edit')}Editar cadastro</button>
      <details class="menu"><summary class="btn quiet">${icon('more')}Mais</summary><div class="menu-list">
        <button type="button" id="dossier">${icon('download')}Exportar prontuário completo</button>
        <button type="button" id="audit">${icon('shield')}Exportar auditoria (PDF)</button>
        <button type="button" id="archive">${icon('eyeoff')}${p.archived ? 'Desarquivar paciente' : 'Arquivar paciente'}</button>
        <button type="button" id="del" class="perigo">${icon('trash')}Excluir paciente e relatórios</button></div></details>`) +
    (isDemo(p) ? callout('<p><b>Paciente de teste.</b> Dados fictícios para você experimentar. Remova em Pacientes quando não precisar mais.</p>', 'warn') : '') +
    meta([p.email ? esc(p.email) : '', p.phone ? esc(p.phone) : 'sem telefone', p.birth_date ? 'nascimento ' + fmtDate(p.birth_date) : '', admin?.guardian ? 'responsável: ' + esc(admin.guardian) : '']) +
    '<div style="height:20px"></div>' +
    (!active ? callout('<p><b>Falta o consentimento deste paciente.</b> Sem ele, a gravação e o envio de áudio ficam bloqueados.</p>', 'warn', '<button class="btn sm" id="consent-top">Registrar agora</button>') : '') +
    (!p.email ? callout('<p>Sem e-mail cadastrado, não é possível liberar relatórios no portal do paciente.</p>', '', '<button class="btn sm quiet" id="edit-mail">Adicionar e-mail</button>') : '') + `
    <nav class="tabs pac-tabs" role="tablist">${[['resumo', 'Resumo'], ['clinico', 'Clínico'], ['financeiro', 'Financeiro'], ['arquivos', 'Arquivos e links']].map(([k, t]) => `<button type="button" class="tab" role="tab" data-aba-btn="${k}">${t}</button>`).join('')}</nav>
    <div class="cols pac-ficha">
      <section>
        <div data-aba="resumo">${proximasHtml}</div>
        <div id="pl-metas" data-aba="clinico"></div>
        <div data-aba="clinico"><div class="panel-head" style="margin-top:22px"><h2>Linha do tempo</h2><span class="muted small">${anamneses.length} anamnese · ${evolucoes.length} evoluções · ${periodos.length} por período</span></div>
        ${timeline || emptyState('Nenhum registro ainda', 'Comece pela anamnese (entrevista inicial) ou registre a primeira evolução.', `<div class="row"><a class="btn quiet" href="#/nova?paciente=${p.id}&tipo=anamnese">${icon('file')}Fazer anamnese</a><a class="btn bloom" href="#/nova?paciente=${p.id}">${icon('mic')}Nova evolução</a></div>`)}
        </div>
        ${p.notes ? `<div data-aba="resumo"><h3 style="margin-top:26px">Observações</h3><p class="pre">${esc(p.notes)}</p></div>` : ''}
      </section>
      <aside>
        <div data-aba="financeiro">${financeiroPanel}</div>
        <div id="pl-escalas" data-aba="clinico"></div>
        <div id="pl-arquivos" data-aba="arquivos"></div>
        <div data-aba="arquivos">${linksPanel(links)}</div>
        <div class="panel" data-aba="resumo">
          <div class="panel-head"><h3>Consentimento (LGPD)</h3>${active ? chip('Ativo', 'ok') : chip('Pendente', 'warn')}</div>
          ${consents.length ? consents.map((c) => `
            <div class="small" style="margin-bottom:8px">${fmtDateTime(c.granted_at)}, ${esc(c.channel)}${c.revoked_at
              ? `<br><b>Revogado em ${fmtDateTime(c.revoked_at)}</b>` : ` <button class="link" data-revoke="${c.id}">Revogar</button>`}</div>`).join('')
            : '<p class="muted small">Nenhum registro.</p>'}
          <button class="btn quiet sm" id="consent">Registrar consentimento</button>
        </div>
        <div class="panel" data-aba="resumo">
          <h3>Portal do paciente</h3>
          ${p.email
            ? `<p class="small">O paciente entra pelo <b>Portal do paciente</b> em <code>${esc(siteUrl())}</code> e, no primeiro acesso, cria a senha com o e-mail <b>${esc(p.email)}</b>. Ele vê só o que você revisar e liberar.</p>`
            : '<p class="muted small">Cadastre o e-mail do paciente para ativar o portal.</p>'}
        </div>
      </aside>
    </div>`;

  // abas da ficha
  const ficha = $('.pac-ficha');
  const abrirAba = (k) => {
    ficha.dataset.at = k;
    $$('[data-aba-btn]').forEach((b) => { const on = b.dataset.abaBtn === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  };
  $$('[data-aba-btn]').forEach((b) => (b.onclick = () => abrirAba(b.dataset.abaBtn)));
  abrirAba('resumo'); // cada paciente abre no Resumo

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
    const prefs = state.profile.preferences || {};
    const tplPadrao = (await api.listTemplates().catch(() => [])).find((t) => t.id === prefs.defaultTemplateId);
    const lay = tplPadrao?.meta?.layout;
    const args = { patient: p, professional: state.profile, reports: full, only: r.only, layout: lay && lay.use !== false ? lay : null };
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
    try { await api.setAppointmentStatus(apts.find((x) => x.id === sel.dataset.pst), sel.value); toast(sel.value === 'realizado' ? 'Sessão realizada: liberada para cobrança.' : 'Situação atualizada.'); renderPatientDetail(id); }
    catch (err) { toast(err.message, 'err'); }
  }));
  if ($('#cobrar-pac')) $('#cobrar-pac').onclick = () => abrirCobranca({ profile: state.profile, patient: { id, name: p.name, phone: p.phone }, items: itensPend });
  if ($('#pago-pac')) $('#pago-pac').onclick = async () => { if (await registrarPagamento({ patient: { id, name: p.name }, items: itensPend })) renderPatientDetail(id); };
  $('#agendar-cob').onclick = async () => { if (await agendarCobranca({ patient: { id, name: p.name }, admin })) renderPatientDetail(id); };
  $('#def-valor').onclick = async () => {
    const r = await openModal('Valor da sessão', `<label class="field">Valor da sessão de ${esc(p.name)} (R$)<input type="number" step="0.01" min="0" name="v" value="${admin?.session_price ?? ''}"></label>
      <p class="muted small">Vale para as próximas sessões. Sessões já realizadas mantêm o valor que tinham.</p>`,
    { okText: 'Salvar', onOk: async (d) => { const v = d.querySelector('[name=v]').value; await api.savePatientAdmin({ patient_id: id, session_price: v === '' ? null : Number(v) }); return true; } });
    if (r) { toast('Valor salvo.'); renderPatientDetail(id); }
  };
  $('#link-anamnese').onclick = () => anamneseLinkModal(p, id);
  $('#link-ori').onclick = () => orientacaoLinkModal(p, id);
  // metas e escalas carregam à parte: se o banco ainda não tiver as tabelas, a ficha segue sem elas
  metasPanel($('#pl-metas'), id, reports).catch(() => { $('#pl-metas').innerHTML = ''; });
  escalasPanel($('#pl-escalas'), id).catch(() => { $('#pl-escalas').innerHTML = ''; });
  arquivosPanel($('#pl-arquivos'), p).catch(() => { $('#pl-arquivos').innerHTML = ''; });
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
