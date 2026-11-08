// Administrativo (agenda e folha de frequência), Financeiro e o menu "Mais" do celular.
// Dados administrativos ficam separados dos clínicos (tabelas appointments e patient_admin).
import * as api from './api.js';
import { state } from './state.js';
import { waLink, lembreteTexto } from './cobranca.js';
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
  const ABAS = [['agenda', 'Agenda'], ['frequencia', 'Folha de frequência'], ['declaracoes', 'Declarações'], ['convenios', 'Convênios']];
  const aba = ABAS.some(([k]) => k === params.get('aba')) ? params.get('aba') : 'agenda';
  main.innerHTML = pageHeader('Administrativo', 'Agenda, folha de frequência, declarações e convênios. Separados dos registros clínicos.',
    aba === 'agenda' ? `<button class="btn bloom" id="new-ap">${icon('plus')}Nova sessão</button>` : '') + `
    <div class="tabs" role="tablist">
      ${ABAS.map(([k, l]) => `<a class="tab ${aba === k ? 'on' : ''}" href="#/administrativo${k === 'agenda' ? '' : '?aba=' + k}" role="tab" style="text-decoration:none">${l}</a>`).join('')}
    </div><div id="pane"></div>`;
  const PANES = { agenda: () => agenda(params, patients), frequencia: () => frequencia(params, patients),
    declaracoes: () => declaracoes(patients), convenios: () => convenios() };
  const reload = () => PANES[aba]();
  if ($('#new-ap')) $('#new-ap').onclick = () => {
    if (!patients.length) return toast('Cadastre um paciente primeiro.', 'err');
    appointmentModal({ patients, date: todayISO() }).then((ok) => ok && reload());
  };
  try { await reload(); }
  catch (err) { $('#pane').innerHTML = callout(`<p>${esc(err.message || String(err))}</p>`, 'warn'); }
}

/* ---------- Agenda (semana) ---------- */
async function agenda(params, patients) {
  const pane = $('#pane');
  const start = mondayOf(params.get('semana') || todayISO());
  const end = addDays(start, 6);
  const [aps, reps] = await Promise.all([
    api.listAppointments({ from: start, to: end }),
    api.listReports({ kind: 'sessao', from: start, to: end, limit: 500 }),
  ]);
  const evo = new Map(reps.map((r) => [`${r.patient_id}|${r.session_date}`, r.id]));
  const count = (s) => aps.filter((a) => a.status === s).length;
  const week = (n) => `#/administrativo?semana=${addDays(start, 7 * n)}`;
  const today = todayISO();

  pane.innerHTML = `
    <div class="row" style="margin-bottom:14px;align-items:center">
      <a class="btn quiet sm" href="${week(-1)}" aria-label="Semana anterior">${icon('left')}</a>
      <b style="min-width:190px;text-align:center">${fmtDate(start)} a ${fmtDate(end)}</b>
      <a class="btn quiet sm" href="${week(1)}" aria-label="Próxima semana">${icon('right')}</a>
      <a class="btn quiet sm" href="#/administrativo">Hoje</a>
      <span class="grow"></span>
      <span class="small muted">${aps.length} sessão${aps.length === 1 ? '' : 's'}</span>
      ${['realizado', 'falta', 'falta_justificada', 'cancelado'].filter(count).map((s) => chip(`${ATT_STATUS[s]}: ${count(s)}`, STATUS_KIND[s])).join(' ')}
    </div>
    <div id="days"></div>`;

  const days = [...Array(7)].map((_, i) => addDays(start, i));
  $('#days').innerHTML = days.map((d) => {
    const list = aps.filter((a) => a.date === d);
    if (!list.length && dt(d).getDay() === 0) return ''; // domingo vazio não aparece
    return `<section class="ag-day ${d === today ? 'today' : ''}">
      <h3>${WD[dt(d).getDay()]}, ${fmtDate(d)}${d === today ? ' ' + chip('Hoje', 'bloom') : ''}</h3>
      ${list.length ? `<div class="table">${list.map((a) => {
        const rid = evo.get(`${a.patient_id}|${a.date}`);
        const evoLink = rid ? `<a class="small" href="#/relatorio/${rid}">${icon('file')}Evolução</a>`
          : a.status === 'realizado' ? `<a class="small" href="#/nova?paciente=${a.patient_id}">${icon('plus')}Registrar evolução</a>` : '';
        return `<div class="tr cols-agenda">
          <span class="t">${esc(hhmm(a.time) || '—')}</span>
          <span class="ellip"><a href="#/pacientes/${a.patient_id}" style="color:inherit">${esc(a.patients?.name || '')}</a><small class="muted"> · ${a.duration_min} min${a.notes ? ' · ' + esc(a.notes) : ''}</small></span>
          <span class="ag-meta"><select class="ag-st st-${a.status}" data-st="${a.id}" aria-label="Situação">${statusOpts(a.status)}</select>${evoLink}</span>
          <span class="row" style="gap:2px;flex-wrap:nowrap">${a.status === 'agendado' ? `<button class="icon-btn" data-lem="${a.id}" title="Enviar lembrete pelo WhatsApp" aria-label="Enviar lembrete">${icon('calendar')}</button>` : ''}<button class="icon-btn" data-ed="${a.id}" title="Editar" aria-label="Editar">${icon('edit')}</button><button class="icon-btn" data-del="${a.id}" title="Excluir" aria-label="Excluir">${icon('trash')}</button></span>
        </div>`;
      }).join('')}</div>` : '<p class="muted small" style="margin:0 0 4px">Nenhuma sessão.</p>'}
    </section>`;
  }).join('') || '';
  if (!aps.length) $('#days').insertAdjacentHTML('afterbegin', emptyState('Semana sem sessões', 'Use “Nova sessão” para agendar. Dá para repetir toda semana nos dias escolhidos.'));

  const again = () => agenda(params, patients);
  $$('[data-st]').forEach((s) => (s.onchange = async () => {
    try { await api.updateAppointment(s.dataset.st, { status: s.value }); toast('Situação atualizada.'); again(); }
    catch (err) { toast(err.message, 'err'); }
  }));
  $$('[data-ed]').forEach((b) => (b.onclick = () => {
    const a = aps.find((x) => x.id === b.dataset.ed);
    appointmentModal({ patients, appointment: a }).then((ok) => ok && again());
  }));
  $$('[data-lem]').forEach((b) => (b.onclick = () => {
    const a = aps.find((x) => x.id === b.dataset.lem);
    const pat = patients.find((x) => x.id === a?.patient_id);
    const url = waLink(pat?.phone, lembreteTexto({ patient: pat?.name || '', professional: state.profile.full_name, date: a.date, time: a.time, specialty: state.profile.specialty }));
    if (!url) return toast('Cadastre o telefone do paciente para enviar o lembrete.', 'err');
    window.open(url, '_blank', 'noopener');
  }));
  $$('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Excluir esta sessão da agenda?', 'Excluir'))) return;
    await busy(b, '…', async () => { await api.deleteAppointment(b.dataset.del); toast('Sessão excluída.'); again(); });
  }));
}

/** Nova sessão (com repetição semanal) ou edição. Resolve true se salvou. */
export function appointmentModal({ patients, appointment: a, date }) {
  const edit = Boolean(a);
  const d0 = a?.date || date || todayISO();
  const body = `
    <label class="field">Paciente<select name="patient_id" required>${patients.map((p) => `<option value="${p.id}" ${p.id === a?.patient_id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
    <div class="grid2">
      <label class="field">Data${edit ? '' : ' do primeira sessão'}<input type="date" name="date" value="${d0}" required></label>
      <label class="field">Horário<input type="time" name="time" value="${hhmm(a?.time)}"></label>
      <label class="field">Duração (minutos)<input type="number" name="duration_min" min="5" max="600" value="${a?.duration_min || 50}" required></label>
      <label class="field">Situação<select name="status">${statusOpts(a?.status || 'agendado')}</select></label>
    </div>
    ${edit ? '' : `<div class="field">Repetir nos dias
      <div class="row" style="gap:10px;margin-top:4px">${[1, 2, 3, 4, 5, 6].map((i) => `<label class="check small"><input type="checkbox" name="wd" value="${i}" ${dt(d0).getDay() === i ? 'checked' : ''}>${WD[i]}</label>`).join('')}</div>
      <small>Deixe só o dia da data para um sessão avulso.</small></div>
    <label class="field">Por quantas semanas<input type="number" name="weeks" min="1" max="52" value="1"><small>Ex.: 3 vezes por semana durante 4 semanas = marque 3 dias e coloque 4.</small></label>`}
    <label class="field">Observação (opcional)<input name="notes" value="${esc(a?.notes || '')}" placeholder="Ex.: reposição, horário especial"></label>
    <p class="muted small">Não coloque aqui informações clínicas. Elas ficam na evolução.</p>`;
  return openModal(edit ? 'Editar sessão' : 'Nova sessão', body, {
    okText: 'Salvar',
    onOk: async (d) => {
      const f = (n) => $(`[name=${n}]`, d).value;
      const base = { patient_id: f('patient_id'), time: f('time') || null, duration_min: Number(f('duration_min')) || 50, status: f('status'), notes: f('notes').trim() || null };
      if (edit) { await api.updateAppointment(a.id, { ...base, date: f('date') }); toast('Sessão atualizada.'); return true; }
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
      await api.saveAppointments(dates.map((date) => ({ ...base, date })));
      toast(dates.length > 1 ? `${dates.length} sessões agendadas.` : 'Sessão agendada.');
      return true;
    },
  });
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
    return { ...base, type: 'comparecimento', periodLabel: label, sessions: await sessionsFor() };
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
    <a class="tr more-item" href="#" data-logout>${icon('logout')}<span class="grow t">Sair</span></a></nav>`;
}
