import * as api from './api.js';
import * as ai from './ai.js';
import { state } from './state.js';
import { getPrefs } from './prefs.js';
import {
  $, $$, esc, fmtDate, todayISO, daysAgoISO, toast, confirmBox, busy, statusChip, chip, shell, loading, pageHeader, icon,
} from './ui.js';

const goto = (h) => { location.hash = h; };

/* =====================================================================
   RELATÓRIOS (lista com filtros e ações em massa)
   ===================================================================== */
export async function renderReports(params) {
  const main = shell('relatorios'); loading(main);
  const patients = await api.listPatients(true);
  const f0 = { status: params.get('status') || '', paciente: params.get('paciente') || '' };

  main.innerHTML = pageHeader('Relatórios', 'Todos os registros. Selecione vários para agir de uma vez.', `<a class="btn bloom" href="#/nova">${icon('plus')}Nova sessão</a>`) + `
    <div class="row lista-busca">
      <input id="q" type="search" placeholder="Buscar por título ou paciente" style="max-width:290px;margin:0" aria-label="Buscar">
      <input type="hidden" id="fs" value="${esc(f0.status)}">
      <div class="pilulas" role="group" aria-label="Situação">${[['', 'Todos'], ['rascunho', 'Rascunho'], ['revisado', 'Revisado'], ['liberado', 'Liberado']].map(([v, t]) => `<button type="button" class="pilula${v === f0.status ? ' on' : ''}" data-st="${v}">${t}</button>`).join('')}</div>
      <span class="grow"></span>
      <details class="menu mais-filtros"${f0.paciente ? ' open' : ''}><summary class="btn quiet sm">${icon('sliders')}Mais filtros</summary><div class="menu-list filtros-box">
      <select id="fp" style="width:auto;margin:0" aria-label="Paciente"><option value="">Todos os pacientes</option>
        ${patients.map((p) => `<option value="${p.id}" ${p.id === f0.paciente ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <select id="fk" style="width:auto;margin:0" aria-label="Tipo"><option value="">Todos os tipos</option><option value="sessao">Evoluções</option><option value="anamnese">Anamneses</option><option value="documento">Documentos</option><option value="periodo">Por período</option></select>
      <input type="date" id="from" style="width:auto;margin:0" aria-label="De"><input type="date" id="to" style="width:auto;margin:0" aria-label="Até">
      </div></details>
    </div>
    <div class="rel-lista" id="rtable"></div>
    <div id="bulk"></div>`;

  let rows = [], selected = new Set();

  const load = async () => {
    const s = $('#fs').value;
    rows = await api.listReports({
      patientId: $('#fp').value || undefined, kind: $('#fk').value || undefined,
      status: s === 'rascunho' || s === 'revisado' ? s : undefined,
      from: $('#from').value || undefined, to: $('#to').value || undefined, limit: 500,
    });
    if (s === 'liberado') rows = rows.filter((r) => r.released_to_patient);
    selected = new Set(); draw();
  };

  const visibleRows = () => {
    const q = $('#q').value.toLowerCase();
    return rows.filter((r) => !q || r.title.toLowerCase().includes(q) || (r.patients?.name || '').toLowerCase().includes(q));
  };

  const KIND = { sessao: 'Evolução', anamnese: 'Anamnese', periodo: 'Relatório por período', documento: 'Documento' };
  const draw = () => {
    const list = visibleRows();
    const all = list.length > 0 && list.every((r) => selected.has(r.id));
    $('#rtable').innerHTML = (list.length ? `<label class="check rel-todos"><input type="checkbox" id="all" ${all ? 'checked' : ''}>Selecionar todos (${list.length})</label>` : '<span id="all" hidden></span>') +
      (list.length ? list.map((r) => `
        <div class="rel-item k-${r.kind} ${selected.has(r.id) ? 'sel' : ''}">
          <input type="checkbox" data-id="${r.id}" ${selected.has(r.id) ? 'checked' : ''} aria-label="Selecionar">
          <a href="#/relatorio/${r.id}" class="grow"><b class="ellip">${esc(r.title)}</b><small>${esc(KIND[r.kind] || 'Registro')} · ${esc(r.patients?.name || '')} · ${fmtDate(r.session_date)}</small></a>
          ${statusChip(r)}
        </div>`).join('')
        : '<div class="empty"><b>Nenhum relatório encontrado</b>Ajuste os filtros ou inicie uma nova sessão.</div>');
    $('#all').onchange = (e) => { list.forEach((r) => (e.target.checked ? selected.add(r.id) : selected.delete(r.id))); draw(); };
    $$('[data-id]').forEach((c) => (c.onchange = () => { c.checked ? selected.add(c.dataset.id) : selected.delete(c.dataset.id); draw(); }));
    drawBulk();
  };

  const drawBulk = () => {
    const n = selected.size;
    $('#bulk').innerHTML = n ? `<div class="bulk"><b>${n} selecionado${n > 1 ? 's' : ''}</b><span class="grow"></span>
      <button class="btn sm" id="b-edit">${icon('edit')}Editar${n > 1 ? ' um por vez' : ''}</button>
      <button class="btn quiet sm" id="b-rev">${icon('check')}Marcar como revisados</button>
      <button class="btn quiet sm" id="b-rel">${icon('eye')}Liberar ao paciente</button>
      <button class="btn quiet sm" id="b-unrel">${icon('eyeoff')}Retirar do portal</button>
      <button class="btn danger sm" id="b-del">${icon('trash')}Excluir</button></div>` : '';
    if (!n) return;
    const picked = () => rows.filter((r) => selected.has(r.id));
    $('#b-edit').onclick = () => {
      const ids = picked().map((r) => r.id);
      try { sessionStorage.setItem('florescer.queue', JSON.stringify(ids)); } catch { /* sem armazenamento */ }
      location.hash = `#/relatorio/${ids[0]}`;
    };
    $('#b-rev').onclick = async (e) => {
      const targets = picked().filter((r) => r.status === 'rascunho');
      if (!targets.length) return toast('Nenhum dos selecionados está em rascunho.', 'err');
      if (!(await confirmBox(`Marcar ${targets.length} relatório(s) como revisados? Confirme que você conferiu cada um.`, 'Confirmar revisão'))) return;
      await busy(e.target, 'Salvando…', async () => { await api.updateReports(targets.map((r) => r.id), { status: 'revisado' }); toast(`${targets.length} marcado(s) como revisado(s).`); await load(); });
    };
    $('#b-rel').onclick = async (e) => {
      const ok = picked().filter((r) => r.status === 'revisado' && r.patients?.email && !r.released_to_patient);
      const skipped = n - ok.length;
      if (!ok.length) return toast('Só relatórios revisados, de pacientes com e-mail, podem ser liberados.', 'err');
      if (!(await confirmBox(`Liberar ${ok.length} relatório(s) ao paciente${skipped ? ` (${skipped} serão ignorados: não revisados, sem e-mail ou já liberados)` : ''}?`, 'Liberar'))) return;
      await busy(e.target, 'Salvando…', async () => { await api.updateReports(ok.map((r) => r.id), { released_to_patient: true, released_at: new Date().toISOString() }); toast('Liberados.'); await load(); });
    };
    $('#b-unrel').onclick = async (e) => {
      const ok = picked().filter((r) => r.released_to_patient);
      if (!ok.length) return toast('Nenhum dos selecionados está liberado.', 'err');
      await busy(e.target, 'Salvando…', async () => { await api.updateReports(ok.map((r) => r.id), { released_to_patient: false, released_at: null }); toast('Retirados do portal.'); await load(); });
    };
    $('#b-del').onclick = async (e) => {
      if (!(await confirmBox(`Excluir ${n} relatório(s) definitivamente? Esta ação não pode ser desfeita.`, 'Excluir'))) return;
      await busy(e.target, 'Excluindo…', async () => { await api.deleteReports([...selected]); toast('Excluídos.'); await load(); });
    };
  };

  $('#q').oninput = draw;
  ['#fp', '#fk', '#from', '#to'].forEach((id) => ($(id).onchange = load));
  $$('.pilula[data-st]').forEach((b) => (b.onclick = () => { $('#fs').value = b.dataset.st; $$('.pilula[data-st]').forEach((x) => x.classList.toggle('on', x === b)); load(); }));
  await load();
}

/* =====================================================================
   RELATÓRIO POR PERÍODO
   ===================================================================== */
export async function renderPeriod(params) {
  const main = shell('periodo'); loading(main);
  const [patients, templates] = await Promise.all([api.listPatients(), api.listTemplates()]);
  const tpls = api.templatesForMe(templates, state.profile).filter((t) => t.kind === 'periodo');
  const prefs = getPrefs();
  const pre = params.get('paciente');
  let found = [];

  main.innerHTML = pageHeader('Relatório por período', 'Reúna as sessões de um paciente e gere um relatório de acompanhamento.') + `
    <div class="panel">
      <div class="grid2">
        <label class="field">Paciente<select id="patient"><option value="">Selecione…</option>
          ${patients.map((p) => `<option value="${p.id}" ${p.id === pre ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label class="field">Modelo<select id="tpl">${tpls.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
        <label class="field">De<input type="date" id="from" value="${daysAgoISO(90)}"></label>
        <label class="field">Até<input type="date" id="to" value="${todayISO()}"></label>
      </div>
      <label class="check"><input type="checkbox" id="drafts">Incluir registros ainda em rascunho</label>
      <label class="check"><input type="checkbox" id="anam">Incluir a anamnese do paciente como contexto</label>
      <div class="row" style="margin-top:6px"><button class="btn" id="search">${icon('search')}Buscar sessões</button></div>
    </div>
    <div id="result"></div>`;

  $('#search').onclick = (e) => busy(e.target, 'Buscando…', async () => {
    const patientId = $('#patient').value;
    if (!patientId) throw new Error('Selecione o paciente.');
    const st = $('#drafts').checked ? undefined : 'revisado';
    found = await api.listReports({ patientId, kind: 'sessao', from: $('#from').value, to: $('#to').value, status: st, withSections: true });
    if ($('#anam').checked) found = [...(await api.listReports({ patientId, kind: 'anamnese', status: st, withSections: true })), ...found];
    const box = $('#result');
    if (!found.length) { box.innerHTML = '<div class="empty"><b>Nenhuma sessão nesse período</b>Por padrão só entram sessões revisadas. Marque a opção de rascunhos se precisar.</div>'; return; }
    found.sort((a, b) => (a.kind === 'anamnese' ? -1 : b.kind === 'anamnese' ? 1 : a.session_date.localeCompare(b.session_date)));
    box.innerHTML = `<div class="panel"><h3>${found.length} ${found.length === 1 ? 'sessão encontrada' : 'sessões encontradas'}</h3>
      <div class="list">${found.map((x) => `<label class="li"><input type="checkbox" data-pick="${x.id}" checked><span class="grow"><span class="t">${esc(x.title)}</span> <span class="muted small">${x.kind === 'anamnese' ? 'Anamnese' : fmtDate(x.session_date)}</span></span>${statusChip(x)}</label>`).join('')}</div>
      <div class="row end" style="margin-top:14px">
        <button class="btn quiet" id="blank">Criar em branco</button>
        ${ai.hasTextAI() ? `<button class="btn bloom" id="gen">${icon('sparkle')}Gerar relatório de acompanhamento</button>` : `<a class="btn quiet" href="#/config?aba=chaves">Conectar IA para gerar o texto</a>`}
      </div></div>`;

    const build = async (withAI, btn) => {
      const picked = found.filter((x) => $(`[data-pick="${x.id}"]`).checked);
      if (!picked.length) return toast('Selecione ao menos uma sessão.', 'err');
      const tpl = templates.find((t) => t.id === $('#tpl').value);
      if (!tpl) return toast('Nenhum modelo de período disponível.', 'err');
      const pname = patients.find((p) => p.id === patientId)?.name || '';
      await busy(btn, withAI ? 'Gerando…' : 'Criando…', async () => {
        const vis = prefs.sectionsVisibleToPatient;
        let sections = tpl.sections.map((s) => ({ title: s.title, text: '', patient_visible: vis }));
        if (withAI) {
          sections = (await ai.generatePeriodSections({
            template: tpl.sections,
            periodLabel: `${fmtDate($('#from').value)} a ${fmtDate($('#to').value)}`,
            sessions: picked.map((x) => ({ date: fmtDate(x.session_date), title: x.title, sections: x.sections, kindLabel: x.kind === 'anamnese' ? 'Anamnese' : 'Evolução' })),
            options: { detail: prefs.detail, flagUncertain: prefs.flagUncertain, instructions: prefs.instructions },
          })).map((s) => ({ ...s, patient_visible: vis }));
        }
        const rep = await api.createReport({
          patient_id: patientId, template_id: tpl.id, kind: 'periodo',
          title: `Relatório de acompanhamento, ${pname}`, session_date: todayISO(),
          period_start: $('#from').value, period_end: $('#to').value, sections, ai_generated: withAI,
        });
        goto(`#/relatorio/${rep.id}`);
      });
    };
    if ($('#gen')) $('#gen').onclick = (ev) => build(true, ev.currentTarget);
    $('#blank').onclick = (ev) => build(false, ev.currentTarget);
  });
  if (pre) $('#search').click();
}
