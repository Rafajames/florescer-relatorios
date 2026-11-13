// Administrativo (agenda e folha de frequência), Financeiro e o menu "Mais" do celular.
// Dados administrativos ficam separados dos clínicos (tabelas appointments e patient_admin).
import * as api from './api.js';
import { state } from './state.js';
import { waLink, lembreteTexto, newToken } from './cobranca.js';
import { exportAttendancePdf, exportAttendanceWord, exportDeclaracaoPdf, exportDeclaracaoWord, ATT_STATUS } from './export.js';
import {
  $, $$, esc, fmtDate, todayISO, toast, confirmBox, busy, chip, shell, loading, pageHeader, icon, openModal, emptyState, callout, NAV_MORE,
} from './ui.js';

const STATUS_KIND = { agendado: 'petrol', realizado: 'ok', falta: 'warn', falta_justificada: 'bloom', cancelado: '' };
const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const dt = (iso) => new Date(iso + 'T12:00:00');
const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (isoDate, n) => { const d = dt(isoDate); d.setDate(d.getDate() + n); return iso(d); };
const mondayOf = (isoDate) => { const d = dt(isoDate); return addDays(isoDate, -((d.getDay() + 6) % 7)); };
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
const statusOpts = (cur) => Object.entries(ATT_STATUS).map(([k, l]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${l}</option>`).join('');

/* =====================================================================
   ADMINISTRATIVO
   ===================================================================== */
export async function renderAdministrativo(params) {
  const main = shell('administrativo'); loading(main);
  const patients = await api.listPatients();
  let ABAS = [['agenda', 'Agenda'], ['espera', 'Lista de espera'], ['frequencia', 'Folha de frequência'], ['declaracoes', 'Declarações'], ['convenios', 'Convênios'], ['pesquisa', 'Pesquisa']];
  // secretária(o): sem Convênios e Pesquisa (mexem no perfil do profissional) e com cadastro básico de paciente
  const staff = state.profile?.role === 'secretary';
  if (staff) ABAS = ABAS.filter(([k]) => !['convenios', 'pesquisa'].includes(k));
  const aba = ABAS.some(([k]) => k === params.get('aba')) ? params.get('aba') : 'agenda';
  main.innerHTML = pageHeader('Administrativo', staff ? `Agenda e documentos administrativos de ${esc(state.profile.full_name)}.` : 'Agenda, folha de frequência, declarações e convênios. Separados dos registros clínicos.',
    (staff ? `<button class="btn quiet" id="staff-pac">${icon('users')}Cadastrar paciente</button>` : '') + (aba === 'agenda' ? `<button class="btn bloom" id="new-ap">${icon('plus')}Nova sessão</button>` : '')) + `
    <div class="tabs" role="tablist">
      ${ABAS.map(([k, l]) => `<a class="tab ${aba === k ? 'on' : ''}" href="#/administrativo${k === 'agenda' ? '' : '?aba=' + k}" role="tab" style="text-decoration:none">${l}</a>`).join('')}
    </div><div id="pane"></div>`;
  if ($('#staff-pac')) $('#staff-pac').onclick = async () => {
    const r = await openModal('Cadastrar paciente', `<p class="muted small">Cadastro básico para agendar e cobrar. Os dados clínicos são preenchidos pelo(a) profissional.</p>
      <label class="field">Nome completo<input name="n" required maxlength="160"></label>
      <label class="field">Telefone (WhatsApp)<input name="t" placeholder="(00) 00000-0000"></label>
      <label class="field">E-mail (opcional)<input type="email" name="e"></label>`,
    { okText: 'Cadastrar', onOk: async (d) => {
      const f = (n) => d.querySelector(`[name=${n}]`).value.trim();
      if (!f('n')) return false;
      await api.staffSavePatient({ name: f('n'), phone: f('t'), email: f('e') }); return true;
    } });
    if (r) { toast('Paciente cadastrado.'); renderAdministrativo(params); }
  };
  const PANES = { agenda: () => agenda(params, patients), frequencia: () => frequencia(params, patients),
    declaracoes: () => declaracoes(patients), convenios: () => convenios(), espera: () => espera(), pesquisa: () => pesquisa() };
  const reload = () => PANES[aba]();
  if ($('#new-ap')) $('#new-ap').onclick = () => {
    if (!patients.length) return toast('Cadastre um paciente primeiro.', 'err');
    appointmentModal({ patients: patients.filter((p) => !p.archived), date: todayISO() }).then((ok) => ok && reload());
  };
  try { await reload(); }
  catch (err) { $('#pane').innerHTML = callout(`<p>${esc(err.message || String(err))}</p>`, 'warn'); }
}

/* ---------- Agenda (semana) ---------- */
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const verPills = (ver, ref) => `<div class="pilulas ag-ver" role="group" aria-label="Visão">${[['dia', 'Dia'], ['lista', 'Lista'], ['grade', 'Semana'], ['mes', 'Mês']].map(([k, t]) => `<a class="pilula${k === ver ? ' on' : ''}" href="#/administrativo?ver=${k}&semana=${ref}">${t}</a>`).join('')}</div>`;

/** Visão do mês: quantas sessões em cada dia; clicar no dia abre a semana. */
async function agendaMes(params) {
  const pane = $('#pane');
  const ref = params.get('semana') || todayISO();
  const ini = ref.slice(0, 8) + '01';
  const d0 = dt(ini); const fim = iso(new Date(d0.getFullYear(), d0.getMonth() + 1, 0, 12));
  const mesDe = (n) => iso(new Date(d0.getFullYear(), d0.getMonth() + n, 1, 12));
  const [aps, blocks] = await Promise.all([api.listAppointments({ from: ini, to: fim }), api.listBlocks({ from: ini, to: fim }).catch(() => [])]);
  const hoje = todayISO();
  const primeiro = mondayOf(ini); const dias = [];
  for (let d = primeiro; d <= fim || dias.length % 7; d = addDays(d, 1)) dias.push(d);
  pane.innerHTML = `
    <div class="row" style="margin-bottom:14px;align-items:center">
      <a class="btn quiet sm" href="#/administrativo?ver=mes&semana=${mesDe(-1)}" aria-label="Mês anterior">${icon('left')}</a>
      <b style="min-width:170px;text-align:center">${MESES[d0.getMonth()][0].toUpperCase() + MESES[d0.getMonth()].slice(1)} de ${d0.getFullYear()}</b>
      <a class="btn quiet sm" href="#/administrativo?ver=mes&semana=${mesDe(1)}" aria-label="Próximo mês">${icon('right')}</a>
      <a class="btn quiet sm" href="#/administrativo?ver=mes">Hoje</a>
      ${verPills('mes', ref)}
      <span class="grow"></span><span class="small muted">${aps.length} ${aps.length === 1 ? 'sessão' : 'sessões'} no mês</span>
    </div>
    <div class="ag-mes">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((w) => `<div class="ag-mes-wd">${w}</div>`).join('')}
    ${dias.map((d) => {
      const l = aps.filter((a) => a.date === d && a.status !== 'cancelado').sort((a, b) => String(a.time).localeCompare(String(b.time)));
      const bloq = blocks.some((b) => b.date <= d && (b.end_date || b.date) >= d);
      return `<a class="ag-mes-dia${d.slice(0, 7) !== ini.slice(0, 7) ? ' fora' : ''}${d === hoje ? ' hoje' : ''}${bloq ? ' bloq' : ''}" href="#/administrativo?ver=dia&semana=${d}">
        <span class="n">${Number(d.slice(8))}</span>
        ${l.slice(0, 3).map((a) => `<span class="ag-mes-s st-${a.status}">${esc(hhmm(a.time))} ${esc((a.patients?.name || '').split(' ')[0])}</span>`).join('')}
        ${l.length > 3 ? `<span class="ag-mes-mais">+${l.length - 3}</span>` : ''}</a>`;
    }).join('')}</div>`;
}

async function agenda(params, patients) {
  let ver = params.get('ver'); try { if (ver) localStorage.setItem('ag-ver', ver); else ver = localStorage.getItem('ag-ver'); } catch { /* sem armazenamento */ }
  ver = ['dia', 'lista', 'grade', 'mes'].includes(ver) ? ver : 'lista';
  const umDia = ver === 'dia';
  if (ver === 'mes') return agendaMes(params);
  const pane = $('#pane');
  const start = umDia ? (params.get('semana') || todayISO()) : mondayOf(params.get('semana') || todayISO());
  const end = umDia ? start : addDays(start, 6);
  const [aps, reps, blocks] = await Promise.all([
    api.listAppointments({ from: start, to: end }),
    api.listReports({ kind: 'sessao', from: start, to: end, limit: 500 }),
    api.listBlocks({ from: start, to: end }).catch(() => []),
  ]);
  const blocksOf = (d) => blocks.filter((b) => b.date <= d && (b.end_date || b.date) >= d);
  const blockTxt = (b) => `${b.start_time ? `${hhmm(b.start_time)}–${hhmm(b.end_time)}` : 'Dia todo'}${b.reason ? ' · ' + esc(b.reason) : ''}`;
  const blocksHtml = (d) => blocksOf(d).map((b) => `<span class="ag-block">${icon('x')}Bloqueado: ${blockTxt(b)} <button class="link small" data-unblock="${b.id}">Liberar</button></span>`).join('');
  const amanha = addDays(todayISO(), 1);
  const evoAp = new Map(reps.filter((r) => r.appointment_id).map((r) => [r.appointment_id, r.id]));
  const evo = new Map(reps.filter((r) => !r.appointment_id).map((r) => [`${r.patient_id}|${r.session_date}`, r.id]));
  const count = (s) => aps.filter((a) => a.status === s).length;
  const week = (n) => `#/administrativo?ver=${ver}&semana=${addDays(start, (umDia ? 1 : 7) * n)}`;
  const today = todayISO();

  pane.innerHTML = `
    <div class="row" style="margin-bottom:14px;align-items:center">
      <a class="btn quiet sm" href="${week(-1)}" aria-label="Semana anterior">${icon('left')}</a>
      <b style="min-width:190px;text-align:center">${umDia ? `${WD[dt(start).getDay()]}, ${fmtDate(start)}` : `${fmtDate(start)} a ${fmtDate(end)}`}</b>
      <a class="btn quiet sm" href="${week(1)}" aria-label="Próxima semana">${icon('right')}</a>
      <a class="btn quiet sm" href="#/administrativo?ver=${ver}">Hoje</a>
      ${verPills(ver, start)}
      <details class="menu"><summary class="btn quiet sm">${icon('more')}Ações</summary><div class="menu-list">
        <button type="button" id="ag-lembretes">${icon('calendar')}Lembretes de amanhã</button>
        <button type="button" id="ag-bloquear">${icon('x')}Bloquear dia ou horário</button>
        <button type="button" id="ag-ics">${icon('download')}Levar para o calendário do celular</button></div></details>
      <span class="grow"></span>
      <span class="small muted">${aps.length} ${aps.length === 1 ? 'sessão' : 'sessões'}</span>
      ${['realizado', 'falta', 'falta_justificada', 'cancelado'].filter(count).map((s) => chip(`${ATT_STATUS[s]}: ${count(s)}`, STATUS_KIND[s])).join(' ')}
    </div>
    <div id="days" class="${(() => { const ant = sessionStorage.getItem('ag-sem'); sessionStorage.setItem('ag-sem', start); return !ant || ant === start ? '' : start > ant ? 'vai-dir' : 'vai-esq'; })()}"></div>`;

  const days = umDia ? [start] : [...Array(7)].map((_, i) => addDays(start, i));
  $('#days').innerHTML = days.map((d) => {
    const list = aps.filter((a) => a.date === d);
    if (!list.length && dt(d).getDay() === 0 && !umDia) return ''; // domingo vazio não aparece
    if (!list.length) return `<section class="ag-day vazio ${d === today ? 'today' : ''}">
      <h3>${WD[dt(d).getDay()]}, ${fmtDate(d)}${d === today ? ' ' + chip('Hoje', 'bloom') : ''}<span class="muted small ag-livre">sem sessões</span>
      <button class="link small" data-novo="${d}">Agendar</button></h3>${blocksHtml(d)}</section>`;
    return `<section class="ag-day ${d === today ? 'today' : ''}">
      <h3>${WD[dt(d).getDay()]}, ${fmtDate(d)}${d === today ? ' ' + chip('Hoje', 'bloom') : ''}<span class="muted small ag-livre">${list.length} ${list.length === 1 ? 'sessão' : 'sessões'}</span>
      <button class="link small" data-novo="${d}">Agendar</button></h3>${blocksHtml(d)}
      ${list.length ? `<div class="table">${list.map((a) => {
        const conf = a.status !== 'agendado' ? '' : a.confirm_status === 'confirmado' ? chip('Confirmou', 'ok') : a.confirm_status === 'remarcar' ? chip('Pediu para remarcar', 'warn') : '';
        const remarcar = ['falta', 'falta_justificada', 'cancelado'].includes(a.status) || a.confirm_status === 'remarcar' ? `<button class="btn quiet sm" data-remarcar="${a.id}">Reagendar</button>` : '';
        const rid = evoAp.get(a.id) || evo.get(`${a.patient_id}|${a.date}`);
        const evoLink = rid ? `<a class="small" href="#/relatorio/${rid}">${icon('file')}Evolução</a>`
          : a.status === 'realizado' && state.profile?.role !== 'secretary' ? `<a class="small" href="#/nova?paciente=${a.patient_id}&sessao=${a.id}">${icon('plus')}Registrar evolução</a>` : '';
        return `<div class="tr cols-agenda">
          <span class="t">${esc(hhmm(a.time) || '—')}</span>
          <span class="ellip">${state.profile?.role === 'secretary' ? esc(a.patients?.name || '') : `<a href="#/pacientes/${a.patient_id}" style="color:inherit">${esc(a.patients?.name || '')}</a>`}<small class="muted"> · ${a.duration_min} min${a.notes ? ' · ' + esc(a.notes) : ''}</small> ${conf}</span>
          <span class="ag-meta"><select class="ag-st st-${a.status}" data-st="${a.id}" aria-label="Situação">${statusOpts(a.status)}</select>${evoLink}</span>
          <span class="row" style="gap:2px;flex-wrap:nowrap">${a.status === 'agendado' ? `<button class="btn quiet sm" data-lem="${a.id}" title="Enviar lembrete pelo WhatsApp">Lembrete</button>` : ''}${remarcar}<button class="icon-btn" data-ed="${a.id}" title="Editar" aria-label="Editar">${icon('edit')}</button><button class="icon-btn" data-del="${a.id}" title="Excluir" aria-label="Excluir">${icon('trash')}</button></span>
        </div>`;
      }).join('')}</div>` : ''}
    </section>`;
  }).join('') || '';
  if (ver === 'grade') {
    // grade da semana: colunas por dia, sessões posicionadas pelo horário
    const mins = (t) => { const [h, m] = String(t || '08:00').split(':').map(Number); return h * 60 + (m || 0); };
    const comHora = aps.filter((a) => a.time);
    const h0 = Math.min(7, ...comHora.map((a) => Math.floor(mins(a.time) / 60)));
    const h1 = Math.max(19, ...comHora.map((a) => Math.ceil((mins(a.time) + (a.duration_min || 50)) / 60)));
    const PX = 52; const cols = days.filter((d) => dt(d).getDay() !== 0 || aps.some((a) => a.date === d));
    $('#days').innerHTML = `<div class="ag-grade" style="--cols:${cols.length};--h:${(h1 - h0) * PX}px">
      <div class="ag-g-head"></div>${cols.map((d) => `<div class="ag-g-head${d === today ? ' hoje' : ''}"><b>${WD[dt(d).getDay()]}</b> ${fmtDate(d).slice(0, 5)}</div>`).join('')}
      <div class="ag-g-horas">${[...Array(h1 - h0)].map((_, i) => `<span style="top:${i * PX}px">${String(h0 + i).padStart(2, '0')}h</span>`).join('')}</div>
      ${cols.map((d) => `<div class="ag-g-col${d === today ? ' hoje' : ''}" data-novo="${d}" title="Clique num espaço livre para agendar">
        ${blocksOf(d).map((b) => { const t0 = b.start_time ? mins(b.start_time) : h0 * 60, t1 = b.end_time ? mins(b.end_time) : h1 * 60;
          return `<span class="ag-g-bloq" style="top:${(t0 - h0 * 60) / 60 * PX}px;height:${(t1 - t0) / 60 * PX}px">${esc(b.reason || 'Bloqueado')}</span>`; }).join('')}
        ${aps.filter((a) => a.date === d).map((a) => { const t = a.time ? mins(a.time) : h0 * 60; const dur = a.duration_min || 50;
          return `<button type="button" class="ag-g-s st-${a.status}" data-ed="${a.id}" style="top:${(t - h0 * 60) / 60 * PX}px;height:${Math.max(dur / 60 * PX - 2, 22)}px">
            <b>${esc(hhmm(a.time))}</b> ${esc(a.patients?.name || '')}${a.confirm_status === 'confirmado' && a.status === 'agendado' ? ' ✓' : ''}</button>`; }).join('')}</div>`).join('')}
    </div>`;
  }
  if (!aps.length && ver !== 'grade') $('#days').insertAdjacentHTML('afterbegin', emptyState(umDia ? 'Dia sem sessões' : 'Semana sem sessões', 'Use “Nova sessão” para agendar. Dá para repetir toda semana nos dias escolhidos.'));

  const again = () => agenda(params, patients);
  $$('[data-st]').forEach((s) => (s.onchange = async () => {
    try { await api.setAppointmentStatus(aps.find((x) => x.id === s.dataset.st), s.value); toast(s.value === 'realizado' ? 'Sessão realizada: já está em Financeiro para cobrança.' : 'Situação atualizada.'); again(); }
    catch (err) { toast(err.message, 'err'); }
  }));
  $$('[data-ed]').forEach((b) => (b.onclick = () => {
    const a = aps.find((x) => x.id === b.dataset.ed);
    appointmentModal({ patients, appointment: a }).then((ok) => ok && again());
  }));
  $$('[data-lem]').forEach((b) => (b.onclick = () => lembretesModal({ aps: aps.filter((x) => x.id === b.dataset.lem), patients, title: 'Lembrete da sessão' })));
  $('#ag-lembretes').onclick = async () => {
    const lista = (await api.listAppointments({ from: amanha, to: amanha })).filter((x) => x.status === 'agendado');
    if (!lista.length) return toast('Não há sessões agendadas para amanhã.', 'err');
    await lembretesModal({ aps: lista, patients, title: `Lembretes de amanhã (${fmtDate(amanha)})` });
  };
  $('#ag-bloquear').onclick = async () => { if (await blockModal(start <= todayISO() && todayISO() <= end ? todayISO() : start)) again(); };
  $('#ag-ics').onclick = async () => {
    const fut = (await api.listAppointments({ from: todayISO(), to: addDays(todayISO(), 90) })).filter((x) => x.status === 'agendado');
    if (!fut.length) return toast('Não há sessões agendadas nos próximos 90 dias.', 'err');
    baixarIcs(fut); toast(`${fut.length} sessões no arquivo. Abra o arquivo no celular para adicionar ao calendário.`);
  };
  $$('[data-unblock]').forEach((b) => (b.onclick = async () => { await api.deleteBlock(b.dataset.unblock); toast('Bloqueio removido.'); again(); }));
  $$('[data-remarcar]').forEach((b) => (b.onclick = () => {
    const o = aps.find((x) => x.id === b.dataset.remarcar);
    appointmentModal({ patients: patients.filter((p) => !p.archived), date: addDays(o.date < todayISO() ? todayISO() : o.date, 7), preset: o }).then((ok) => ok && again());
  }));
  $$('[data-novo]').forEach((b) => (b.onclick = (e) => {
    if (b.classList.contains('ag-g-col') && e.target !== b) return; // clique numa sessão da grade
    appointmentModal({ patients: patients.filter((p) => !p.archived), date: b.dataset.novo }).then((ok) => ok && again());
  }));
  $$('[data-del]').forEach((b) => (b.onclick = async () => {
    const alvo = aps.find((x) => x.id === b.dataset.del);
    const aviso = alvo?.payment_status === 'pago' ? 'Esta sessão tem um pagamento registrado. Excluir apaga também o pagamento do Financeiro. Excluir mesmo assim?'
      : alvo?.status === 'realizado' ? 'Esta sessão já foi realizada e está nas cobranças. Excluir mesmo assim?' : 'Excluir esta sessão da agenda?';
    if (alvo?.series_id && alvo.status === 'agendado') {
      const r = await openModal('Excluir sessão', `<p>Esta sessão faz parte de uma série que se repete.</p>
        <label class="check"><input type="radio" name="q" value="uma" checked> Só esta sessão (${fmtDate(alvo.date)})</label>
        <label class="check"><input type="radio" name="q" value="serie"> Esta e as próximas da série que ainda estão agendadas</label>`,
      { okText: 'Excluir', onOk: (d) => d.querySelector('[name=q]:checked').value });
      if (!r || r === true) return;
      if (r === 'serie') { const fora = await api.deleteSeriesFrom(alvo.series_id, alvo.date); toast(`${fora.length} sessões excluídas.`); return again(); }
      await api.deleteAppointment(alvo.id); toast('Sessão excluída.'); return again();
    }
    if (!(await confirmBox(aviso, 'Excluir'))) return;
    await busy(b, '…', async () => { await api.deleteAppointment(b.dataset.del); toast('Sessão excluída.'); again(); });
  }));
}

/** Nova sessão (com repetição semanal) ou edição. Resolve true se salvou. */
export function appointmentModal({ patients, appointment: a0, date, preset }) {
  const edit = Boolean(a0);
  // preset: sessão antiga usada como base ao reagendar (mesmo paciente, horário e duração)
  const a = a0 || (preset ? { patient_id: preset.patient_id, time: preset.time, duration_min: preset.duration_min } : null);
  const d0 = a0?.date || date || todayISO();
  const body = `
    <label class="field">Paciente<select name="patient_id" required>${patients.map((p) => `<option value="${p.id}" ${p.id === a?.patient_id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <div class="grid2">
      <label class="field">Data${edit ? '' : ' da primeira sessão'}<input type="date" name="date" value="${d0}" required></label>
      <label class="field">Horário<input type="time" name="time" value="${hhmm(a?.time)}"></label>
      <label class="field">Duração (minutos)<input type="number" name="duration_min" min="5" max="600" value="${a?.duration_min || 50}" required></label>
      <label class="field">Situação<select name="status">${statusOpts(a?.status || 'agendado')}</select></label>
    </div>
    ${edit ? '' : `<div class="field">Repetir nos dias
      <div class="row" style="gap:10px;margin-top:4px">${[1, 2, 3, 4, 5, 6].map((i) => `<label class="check small"><input type="checkbox" name="wd" value="${i}" ${dt(d0).getDay() === i ? 'checked' : ''}>${WD[i]}</label>`).join('')}</div>
      <small>Deixe só o dia da data para uma sessão avulsa.</small></div>
    <label class="field">Por quantas semanas<input type="number" name="weeks" min="1" max="52" value="1"><small>Ex.: 3 vezes por semana durante 4 semanas = marque 3 dias e coloque 4.</small></label>`}
    <label class="field">Observação (opcional)<input name="notes" value="${esc(a?.notes || '')}" placeholder="Ex.: reposição, horário especial"></label>
    <p class="muted small">Não coloque aqui informações clínicas. Elas ficam na evolução.</p>`;
  return openModal(edit ? 'Editar sessão' : preset ? 'Reagendar sessão' : 'Nova sessão', body, {
    okText: 'Salvar',
    onOk: async (d) => {
      const f = (n) => $(`[name=${n}]`, d).value;
      const base = { patient_id: f('patient_id'), time: f('time') || null, duration_min: Number(f('duration_min')) || 50, status: f('status'), notes: f('notes').trim() || null };
      // Aviso de conflito: outra sessão (não cancelada) no mesmo dia com horário sobreposto.
      const conflito = async (dates) => {
        if (!base.time || ['cancelado', 'falta', 'falta_justificada'].includes(base.status)) return true;
        const min = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
        const ini = min(base.time), fim = ini + base.duration_min;
        const [outras, bloqueios] = await Promise.all([api.listAppointments({ from: dates[0], to: dates[dates.length - 1] }), api.listBlocks({ from: dates[0], to: dates[dates.length - 1] }).catch(() => [])]);
        const preso = bloqueios.find((b) => dates.some((dia) => b.date <= dia && (b.end_date || b.date) >= dia) && (!b.start_time || (min(b.start_time) < fim && ini < min(b.end_time || '23:59'))));
        if (preso && !(await confirmBox(`Este horário está bloqueado${preso.reason ? ` (${preso.reason})` : ''}. Agendar mesmo assim?`, 'Agendar mesmo assim'))) return false;
        const bate = outras.filter((o) => o.id !== a0?.id && dates.includes(o.date) && o.time && o.status !== 'cancelado'
          && min(o.time) < fim && ini < min(o.time) + (o.duration_min || 50));
        if (!bate.length) return true;
        const quem = bate.slice(0, 3).map((o) => `${fmtDate(o.date)} ${hhmm(o.time)} (${o.patients?.name || 'paciente'})`).join(', ');
        return confirmBox(`Já existe sessão neste horário: ${quem}${bate.length > 3 ? ` e mais ${bate.length - 3}` : ''}. Agendar mesmo assim?`, 'Agendar mesmo assim');
      };
      if (edit) {
        if (!(await conflito([f('date')]))) return false;
        if (base.status !== a0.status) await api.setAppointmentStatus(a0, base.status);
        const mudou = f('date') !== a0.date || (base.time || '') !== hhmm(a0.time);
        await api.updateAppointment(a0.id, { ...base, date: f('date'), ...(mudou ? { confirm_status: null, confirmed_at: null } : {}) }); toast('Sessão atualizada.'); return true;
      }
      const first = f('date');
      const wds = $$('[name=wd]:checked', d).map((c) => Number(c.value));
      const weeks = Math.min(52, Math.max(1, Number(f('weeks')) || 1));
      const dates = [];
      if (!wds.length) dates.push(first);
      else {
        const mon = mondayOf(first);
        for (let w = 0; w < weeks; w++) for (const wd of wds) {
          const day = addDays(mon, w * 7 + (wd - 1));
          if (day >= first) dates.push(day);
        }
        if (!dates.length) dates.push(first);
      }
      dates.sort();
      if (!(await conflito(dates))) return false;
      await api.saveAppointments(dates.map((date) => ({ ...base, date })));
      toast(dates.length > 1 ? `${dates.length} sessões agendadas.` : 'Sessão agendada.');
      return true;
    },
  });
}

/* ---------- Lembretes com link de confirmação ---------- */
/** Lista as sessões com um botão de WhatsApp para cada uma. A mensagem leva o link para o paciente confirmar ou pedir para remarcar. */
export async function lembretesModal({ aps, patients, title }) {
  const base = `${location.origin}${location.pathname}#/l/`;
  const ja = await api.listConfirmLinks(aps.map((a) => a.id)).catch(() => []);
  const agora = new Date().toISOString();
  const tokenOf = Object.fromEntries(ja.filter((l) => l.expires_at > agora).map((l) => [l.appointment_id, l.token]));
  for (const a of aps) {
    if (tokenOf[a.id]) continue;
    const token = newToken();
    try { await api.createShareLink({ token, kind: 'confirmacao', patient_id: a.patient_id, appointment_id: a.id, expires_at: new Date(`${a.date}T23:59:59`).toISOString() }); tokenOf[a.id] = token; }
    catch { /* sem link: o lembrete segue sem a confirmação */ }
  }
  const linha = (a) => {
    const pat = patients.find((x) => x.id === a.patient_id) || {};
    const nome = pat.name || a.patients?.name || 'Paciente';
    const url = waLink(pat.phone, lembreteTexto({ patient: nome, professional: state.profile.full_name, date: a.date, time: a.time, specialty: state.profile.specialty, link: tokenOf[a.id] ? base + tokenOf[a.id] : '' }));
    return `<div class="tr" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="grow t">${esc(hhmm(a.time) || '—')} · ${esc(nome)}</span>
      ${url ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(url)}" data-sent>Enviar pelo WhatsApp</a>` : '<span class="small muted">sem telefone cadastrado</span>'}</div>`;
  };
  return openModal(title, `<p class="muted small">Cada mensagem leva um link para o paciente confirmar a presença ou pedir para remarcar. A resposta aparece na agenda.</p>
    <div class="table">${aps.map(linha).join('')}</div>`,
  { cancelText: 'Fechar', onOpen: (d) => d.querySelectorAll('[data-sent]').forEach((el) => el.addEventListener('click', () => { el.textContent = 'Enviado ✓'; el.classList.add('quiet'); })) });
}

/* ---------- Bloqueio de dia ou horário (feriado, folga) ---------- */
function blockModal(d0) {
  return openModal('Bloquear dia ou horário', `
    <div class="grid2">
      <label class="field">De<input type="date" name="date" value="${d0}" required></label>
      <label class="field">Até (opcional)<input type="date" name="end_date"></label>
      <label class="field">Das (vazio = dia todo)<input type="time" name="start_time"></label>
      <label class="field">Às<input type="time" name="end_time"></label>
    </div>
    <label class="field">Motivo (opcional)<input name="reason" placeholder="Ex.: feriado, congresso, folga" maxlength="80"></label>
    <p class="muted small">As sessões já agendadas não são alteradas. O bloqueio avisa quando você tentar agendar por cima.</p>`,
  { okText: 'Bloquear', onOk: async (d) => {
    const f = (n) => d.querySelector(`[name=${n}]`).value;
    if (!f('date')) return false;
    if (f('end_date') && f('end_date') < f('date')) { toast('A data final vem antes da inicial.', 'err'); return false; }
    if (Boolean(f('start_time')) !== Boolean(f('end_time'))) { toast('Informe o início e o fim do horário, ou deixe os dois vazios.', 'err'); return false; }
    await api.saveBlock({ date: f('date'), end_date: f('end_date') || null, start_time: f('start_time') || null, end_time: f('end_time') || null, reason: f('reason').trim() || null });
    toast('Bloqueio salvo.'); return true;
  } });
}

/* ---------- Calendário do celular (.ics) ---------- */
function baixarIcs(aps) {
  const z = (n) => String(n).padStart(2, '0');
  const stamp = (date, t, plus = 0) => { const [h, m] = String(t || '08:00').split(':').map(Number); const x = new Date(`${date}T00:00:00`); x.setHours(h, m + plus);
    return `${x.getFullYear()}${z(x.getMonth() + 1)}${z(x.getDate())}T${z(x.getHours())}${z(x.getMinutes())}00`; };
  const txt = (v) => String(v || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, ' ');
  const ev = aps.map((a) => ['BEGIN:VEVENT', `UID:${a.id}@potira`, `DTSTAMP:${stamp(todayISO(), '00:00')}`, `DTSTART:${stamp(a.date, a.time)}`, `DTEND:${stamp(a.date, a.time, a.duration_min || 50)}`,
    `SUMMARY:${txt('Sessão · ' + (a.patients?.name || 'Paciente'))}`, 'END:VEVENT'].join('\r\n'));
  const blob = new Blob([['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Potira//Agenda//PT-BR', ...ev, 'END:VCALENDAR'].join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const el = document.createElement('a'); el.href = URL.createObjectURL(blob); el.download = 'agenda-potira.ics';
  document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(el.href), 2000);
}

/* ---------- Lista de espera ---------- */
const ESPERA = { aguardando: 'Aguardando', chamado: 'Chamado', encerrado: 'Encerrado' };
async function espera() {
  const pane = $('#pane');
  const list = await api.listWaitlist();
  const again = () => renderAdministrativo(new URLSearchParams('aba=espera'));
  pane.innerHTML = `
    <section class="panel"><h2>Lista de espera</h2>
      <p class="muted">Quem está aguardando vaga. Quando abrir um horário, chame pela ordem.</p>
      <form id="we-f"><div class="grid2">
        <label class="field">Nome<input name="name" required maxlength="120"></label>
        <label class="field">Telefone<input name="phone" placeholder="(00) 00000-0000"></label>
        <label class="field">Dias e horários preferidos<input name="preference" placeholder="Ex.: terça e quinta à tarde"></label>
        <label class="field">Observação<input name="notes" placeholder="Ex.: indicado pela escola"></label>
      </div><button class="btn" type="submit">${icon('plus')}Adicionar à lista</button></form>
    </section>
    ${list.length ? `<div class="table">${list.map((w, i) => `<div class="tr" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="muted">${i + 1}</span>
      <span class="grow t">${esc(w.name)}<small class="muted"> · desde ${fmtDate(w.created_at)}${w.preference ? ' · ' + esc(w.preference) : ''}${w.notes ? ' · ' + esc(w.notes) : ''}</small></span>
      <select data-we="${w.id}" aria-label="Situação" style="width:auto;margin:0;min-height:0;padding:5px 8px">${Object.entries(ESPERA).map(([k, l]) => `<option value="${k}" ${k === w.status ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${waLink(w.phone, '') ? `<a class="btn quiet sm" target="_blank" rel="noopener" href="${esc(waLink(w.phone, `Olá, ${w.name}! Abriu uma vaga para sessão com ${state.profile.full_name}. Podemos combinar o horário?`))}">Chamar</a>` : ''}
      <button class="icon-btn" data-wdel="${w.id}" title="Remover" aria-label="Remover da lista">${icon('trash')}</button></div>`).join('')}</div>`
      : emptyState('Ninguém na lista de espera', 'Adicione acima quem está aguardando vaga.')}`;
  $('#we-f').onsubmit = (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    return busy($('[type=submit]', e.target), 'Salvando…', async () => {
      await api.saveWaitlist({ name: String(fd.get('name')).trim(), phone: String(fd.get('phone')).trim() || null, preference: String(fd.get('preference')).trim() || null, notes: String(fd.get('notes')).trim() || null });
      toast('Adicionado à lista de espera.'); again();
    });
  };
  $$('[data-we]').forEach((sel) => (sel.onchange = async () => { await api.saveWaitlist({ id: sel.dataset.we, status: sel.value }); toast('Situação atualizada.'); }));
  $$('[data-wdel]').forEach((b) => (b.onclick = async () => { if (!(await confirmBox('Remover esta pessoa da lista de espera?', 'Remover'))) return; await api.deleteWaitlist(b.dataset.wdel); toast('Removido.'); again(); }));
}

/* ---------- Pesquisa de satisfação (anônima, por link) ---------- */
async function pesquisa() {
  const pane = $('#pane');
  let link = await api.getSurveyLink();
  if (link && link.expires_at < new Date().toISOString()) link = null;
  const answers = link ? await api.listSurveyAnswers() : [];
  const url = link ? `${location.origin}${location.pathname}#/l/${link.token}` : '';
  const media = answers.length ? (answers.reduce((s, a) => s + a.score, 0) / answers.length) : 0;
  const msg = `Olá! Sua opinião ajuda a melhorar o atendimento. A pesquisa é anônima e leva um minuto:\n${url}`;
  pane.innerHTML = `<section class="panel"><h2>Pesquisa de satisfação</h2>
    <p class="muted">Um link só, anônimo, para enviar a pacientes e famílias. Eles dão uma nota de 0 a 10 e, se quiserem, um comentário. Você não vê quem respondeu.</p>
    ${link ? `<label class="field">Link da pesquisa<input readonly id="pq-url" value="${esc(url)}"></label>
      <div class="row"><button class="btn quiet" id="pq-copy">${icon('file')}Copiar mensagem com o link</button></div>`
      : `<button class="btn" id="pq-new">${icon('plus')}Criar link da pesquisa</button>`}
    </section>
    ${link ? `<div class="stats"><div class="stat ok"><b>${answers.length ? media.toFixed(1).replace('.', ',') : '—'}</b><span>Nota média (0 a 10)</span></div>
      <div class="stat"><b>${answers.length}</b><span>Respostas</span></div>
      <div class="stat"><b>${answers.filter((a) => a.score >= 9).length}</b><span>Notas 9 e 10</span></div>
      <div class="stat warn"><b>${answers.filter((a) => a.score <= 6).length}</b><span>Notas até 6</span></div></div>
      ${answers.filter((a) => a.comment).length ? `<h3 style="margin:6px 0 10px">Comentários</h3><div class="table">${answers.filter((a) => a.comment).map((a) => `<div class="tr" style="display:flex;gap:12px;align-items:flex-start">
        ${chip(`Nota ${a.score}`, a.score >= 9 ? 'ok' : a.score <= 6 ? 'warn' : '')}<span class="grow">${esc(a.comment)}<small class="muted"> · ${fmtDate(a.created_at)}</small></span></div>`).join('')}</div>` : '<p class="muted small">Nenhum comentário ainda.</p>'}` : ''}`;
  if ($('#pq-new')) $('#pq-new').onclick = (e) => busy(e.currentTarget, 'Criando…', async () => {
    await api.createShareLink({ token: newToken(), kind: 'pesquisa', expires_at: new Date(Date.now() + 365 * 864e5).toISOString() });
    renderAdministrativo(new URLSearchParams('aba=pesquisa'));
  });
  if ($('#pq-copy')) $('#pq-copy').onclick = async () => { try { await navigator.clipboard.writeText(msg); toast('Mensagem copiada.'); } catch { $('#pq-url').select(); toast('Selecione o link e copie.', 'err'); } };
}

/* ---------- Folha de frequência ---------- */
async function frequencia(params, patients) {
  const pane = $('#pane');
  if (!patients.length) { pane.innerHTML = emptyState('Nenhum paciente', 'Cadastre um paciente para gerar a folha de frequência.', '<a class="btn" href="#/pacientes">Ir para pacientes</a>'); return; }
  const month = todayISO().slice(0, 7);
  pane.innerHTML = `
    <section class="panel">
      <div class="grid2">
        <label class="field">Paciente<select id="fq-p">${patients.map((p) => `<option value="${p.id}" ${p.id === params.get('paciente') ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label class="field">Mês<input type="month" id="fq-m" value="${month}"></label>
        <label class="field">Especialidade<input id="fq-ap" placeholder="Ex.: Integração Sensorial de Ayres"></label>
        <label class="field">Convênio<input id="fq-in" list="fq-convs" placeholder="Vazio = Particular"><datalist id="fq-convs">${insurers().map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
        <label class="field">Responsável pelo paciente (opcional)<input id="fq-gu" placeholder="Nome do responsável"></label>
        <label class="field">Linhas mínimas na folha<input type="number" id="fq-min" min="0" max="40" value="10"><small>Completa com linhas em branco para preencher à mão.</small></label>
      </div>
      <div class="field">Incluir na folha
        <div class="row" style="gap:12px;margin-top:4px">${Object.entries(ATT_STATUS).map(([k, l]) => `<label class="check small"><input type="checkbox" class="fq-s" value="${k}" ${['realizado', 'falta', 'falta_justificada'].includes(k) ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
      <div class="row">
        <button class="btn" id="fq-pdf">${icon('download')}Exportar PDF</button>
        <button class="btn quiet" id="fq-doc">${icon('download')}Word</button>
        <button class="btn quiet" id="fq-save">${icon('check')}Salvar dados do paciente</button>
      </div>
    </section>
    <h3 style="margin:6px 0 10px">Sessões do mês</h3>
    <div id="fq-list"></div>`;

  let rows = [];
  const range = () => { const m = $('#fq-m').value || month; const [y, mo] = m.split('-').map(Number); return [`${m}-01`, iso(new Date(y, mo, 0, 12))]; };
  const picked = () => { const st = $$('.fq-s:checked').map((c) => c.value); return rows.filter((r) => st.includes(r.status)); };
  const drawList = () => {
    const list = picked();
    $('#fq-list').innerHTML = list.length ? `<div class="table">${list.map((r, i) => `<div class="tr cols-freq"><span class="muted">${i + 1}</span><span>${WD[dt(r.date).getDay()]}, ${fmtDate(r.date)} ${esc(hhmm(r.time))}</span><span>${chip(ATT_STATUS[r.status], STATUS_KIND[r.status])}</span></div>`).join('')}</div>`
      : '<p class="muted small">Nenhuma sessão com essas situações neste mês. A folha sai só com linhas em branco.</p>';
  };
  const loadPatient = async () => {
    const pid = $('#fq-p').value; const [from, to] = range();
    const [adm, aps] = await Promise.all([api.getPatientAdmin(pid), api.listAppointments({ patientId: pid, from, to })]);
    $('#fq-ap').value = adm?.approach || ''; $('#fq-in').value = adm?.insurer || ''; $('#fq-gu').value = adm?.guardian || '';
    rows = aps; drawList();
  };
  const loadMonth = async () => { const [from, to] = range(); rows = await api.listAppointments({ patientId: $('#fq-p').value, from, to }); drawList(); };
  $('#fq-p').onchange = () => loadPatient().catch((e) => toast(e.message, 'err'));
  $('#fq-m').onchange = () => loadMonth().catch((e) => toast(e.message, 'err'));
  $$('.fq-s').forEach((c) => (c.onchange = drawList));

  const args = () => {
    const p = patients.find((x) => x.id === $('#fq-p').value);
    const [y, m] = ($('#fq-m').value || month).split('-').map(Number);
    return { professional: state.profile, patientName: p?.name || '', approach: $('#fq-ap').value.trim(), insurer: $('#fq-in').value.trim(),
      period: new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), rows: picked(),
      minRows: Math.min(40, Math.max(0, Number($('#fq-min').value) || 0)) };
  };
  $('#fq-pdf').onclick = () => exportAttendancePdf(args());
  $('#fq-doc').onclick = () => exportAttendanceWord(args());
  $('#fq-save').onclick = (e) => busy(e.target, 'Salvando…', async () => {
    await api.savePatientAdmin({ patient_id: $('#fq-p').value, approach: $('#fq-ap').value.trim() || null, insurer: $('#fq-in').value.trim() || null, guardian: $('#fq-gu').value.trim() || null });
    toast('Dados do paciente salvos.');
  });
  await loadPatient();
}

/* ---------- Convênios (lista guardada no perfil; usada no campo Convênio) ---------- */
function insurers() {
  const list = state.profile?.branding?.insurers;
  return Array.isArray(list) ? list : [];
}

async function saveInsurers(list) {
  const branding = { ...(state.profile.branding || {}), insurers: list };
  const row = await api.updateProfile(state.profile.id, { branding });
  state.profile = { ...state.profile, branding: row.branding };
}

function convenios() {
  const pane = $('#pane');
  const list = insurers();
  pane.innerHTML = `
    <section class="panel">
      <h2>Convênios atendidos</h2>
      <p class="muted">Cadastre os convênios uma vez. Eles aparecem na lista ao preencher o convênio de cada paciente. Quem não tem convênio fica como Particular.</p>
      <form id="cv-form" class="row" style="align-items:flex-end">
        <label class="field grow" style="margin:0">Nome do convênio<input id="cv-name" placeholder="Ex.: Unimed" required></label>
        <button class="btn" type="submit">${icon('plus')}Adicionar</button>
      </form>
    </section>
    ${list.length ? `<div class="table" id="cv-list">${list.map((c, i) => `<div class="tr" style="display:flex;align-items:center">
      <span class="grow t">${esc(c)}</span>
      <button class="icon-btn" data-rm="${i}" aria-label="Remover ${esc(c)}" title="Remover">${icon('trash')}</button></div>`).join('')}</div>`
      : '<p class="muted">Nenhum convênio cadastrado ainda.</p>'}`;

  $('#cv-form').onsubmit = (e) => {
    e.preventDefault();
    const name = $('#cv-name').value.trim();
    if (!name) return;
    if (list.some((c) => c.toLowerCase() === name.toLowerCase())) return toast('Este convênio já está na lista.', 'err');
    return busy($('[type=submit]', e.target), 'Salvando…', async () => {
      await saveInsurers([...list, name]);
      toast('Convênio adicionado.'); renderAdministrativo(new URLSearchParams('aba=convenios'));
    });
  };
  $$('[data-rm]').forEach((b) => (b.onclick = async () => {
    const name = list[+b.dataset.rm];
    if (!(await confirmBox(`Remover o convênio “${name}” da lista? Pacientes que já usam este nome não são alterados.`, 'Remover'))) return;
    try { await saveInsurers(list.filter((_, i) => i !== +b.dataset.rm)); toast('Convênio removido.'); renderAdministrativo(new URLSearchParams('aba=convenios')); }
    catch (err) { toast(err.message, 'err'); }
  }));
}

/* ---------- Declarações: disponibilidade de horário e comparecimento ---------- */
async function declaracoes(patients) {
  const pane = $('#pane');
  if (!patients.length) { pane.innerHTML = emptyState('Nenhum paciente', 'Cadastre um paciente para emitir declarações.', '<a class="btn" href="#/pacientes">Ir para pacientes</a>'); return; }
  const month = todayISO().slice(0, 7);
  const pay = state.profile?.branding?.payment || {};
  pane.innerHTML = `
    <section class="panel">
      <div class="grid2">
        <label class="field">Paciente<select id="dc-p">${patients.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
        <label class="field">Tipo de declaração<select id="dc-t">
          <option value="disponibilidade">Disponibilidade de horário (vaga reservada)</option>
          <option value="comparecimento">Comparecimento às sessões</option></select></label>
        <label class="field" id="dc-w">Sessões por semana<input type="number" min="1" max="7" id="dc-sw" value="1"></label>
        <label class="field" id="dc-d">Duração da sessão (minutos)<input type="number" min="15" max="180" id="dc-sd" value="50"></label>
        <label class="field" id="dc-m" style="display:none">Mês de referência<input type="month" id="dc-mes" value="${month}"></label>
      </div>
      <p class="muted small" id="dc-info"></p>
      <div class="row">
        <button class="btn" id="dc-pdf">${icon('download')}Gerar PDF</button>
        <button class="btn quiet" id="dc-doc">Word</button>
      </div>
    </section>`;

  const isComp = () => $('#dc-t').value === 'comparecimento';
  const showFields = () => {
    $('#dc-w').style.display = isComp() ? 'none' : '';
    $('#dc-d').style.display = isComp() ? 'none' : '';
    $('#dc-m').style.display = isComp() ? '' : 'none';
    $('#dc-info').textContent = isComp()
      ? 'Conta as sessões realizadas do paciente no mês escolhido.'
      : 'Declara a reserva de horário semanal para o paciente, com validade de 15 dias.';
  };
  // Sessões realizadas do paciente no mês escolhido, em ordem de data e horário.
  const sessionsFor = async () => {
    const m = $('#dc-mes').value || month;
    const [y, mo] = m.split('-').map(Number);
    const to = iso(new Date(y, mo, 0, 12));
    const aps = await api.listAppointments({ patientId: $('#dc-p').value, from: `${m}-01`, to });
    return aps.filter((a) => a.status === 'realizado').map((a) => ({ date: a.date, time: a.time }));
  };
  const args = async () => {
    const p = patients.find((x) => x.id === $('#dc-p').value);
    const base = { professional: state.profile, patientName: p?.name || '', specialty: state.profile?.specialty || '', payment: pay };
    if (!isComp()) return { ...base, type: 'disponibilidade', sessionsPerWeek: Number($('#dc-sw').value) || 1, sessionDuration: Number($('#dc-sd').value) || 50 };
    const m = $('#dc-mes').value || month;
    const [y, mo] = m.split('-').map(Number);
    const label = new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const sessions = await sessionsFor();
    if (!sessions.length) throw new Error(`Não há sessões realizadas de ${base.patientName} em ${label}. Marque as sessões como realizadas na agenda.`);
    return { ...base, type: 'comparecimento', periodLabel: label, sessions };
  };
  $('#dc-t').onchange = showFields; $('#dc-mes').onchange = showFields;
  showFields();
  const run = (fn) => async (e) => {
    try { fn(await args(), e); } catch (err) { toast(err.message, 'err'); }
  };
  $('#dc-pdf').onclick = run((a) => { exportDeclaracaoPdf(a); api.logExport('declaracao', null, { tipo: a.type }); });
  $('#dc-doc').onclick = run((a) => { exportDeclaracaoWord(a); api.logExport('declaracao', null, { tipo: a.type }); });
}

/* =====================================================================
   MAIS (menu do celular)
   ===================================================================== */
export function renderMore() {
  const main = shell('mais');
  main.innerHTML = pageHeader('Mais') + `<nav class="table" aria-label="Mais opções">${NAV_MORE.map(([, h, ic, l]) => `<a class="tr more-item" href="${h}">${icon(ic)}<span class="grow t">${esc(l)}</span>${icon('right')}</a>`).join('')}
    <a class="tr more-item" href="#/sobre">${icon('info')}<span class="grow t">Sobre a Potira</span>${icon('right')}</a>
    <a class="tr more-item" href="#" data-logout>${icon('logout')}<span class="grow t">Sair</span></a></nav>`;
}
