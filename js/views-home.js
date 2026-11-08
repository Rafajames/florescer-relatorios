import * as api from './api.js';
import * as ai from './ai.js';
import { state, DEFAULT_CONSENT } from './state.js';
import { createDemo, removeDemo, isDemo } from './demo.js';
import { exportDossierWord, exportDossierPdf, KIND_LABEL } from './export.js';
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

  main.innerHTML = pageHeader(`${greeting()}, ${esc(first)}`, esc(longDate())) + `
    <section class="now">
      ${patients.length ? `
        <div><h2>Quem você vai atender agora?</h2><p>Escolha o paciente e comece. A gravação só libera com o consentimento registrado.</p></div>
        <div class="pick">
          <select id="who" aria-label="Paciente"><option value="">Selecione o paciente</option>
            ${patients.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>
          <button class="btn bloom lg" id="go-now">${icon('mic')}Iniciar sessão</button>
        </div>` : `
        <div><h2>Comece cadastrando um paciente</h2><p>Depois registre o consentimento dele e inicie a primeira sessão.</p></div>
        <div class="pick"><a class="btn bloom lg" href="#/pacientes">${icon('plus')}Cadastrar paciente</a></div>`}
    </section>

    <section class="stats" aria-label="Resumo">
      <a class="stat" href="#/pacientes"><b>${patients.length}</b><span>${patients.length === 1 ? 'paciente' : 'pacientes'}</span></a>
      <a class="stat ${drafts.length ? 'warn' : ''}" href="#/relatorios?status=rascunho"><b>${drafts.length}</b><span>${drafts.length === 1 ? 'rascunho para revisar' : 'rascunhos para revisar'}</span></a>
      <a class="stat ok" href="#/relatorios"><b>${released}</b><span>${released === 1 ? 'liberado ao paciente' : 'liberados aos pacientes'}</span></a>
      <a class="stat ${noConsent.length ? 'warn' : ''}" href="#/pacientes"><b>${noConsent.length}</b><span>sem consentimento</span></a>
    </section>
    <section class="panel"><div class="panel-head"><h2>Últimos 7 dias</h2><span class="muted small">registros por dia</span></div>
      <div class="week">${week.map((d) => { const n = perDay(d); return `<div class="wd ${iso(d) === todayISO() ? 'today' : ''} ${n ? '' : 'zero'}"><small>${d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small><b>${d.getDate()}</b><i>${n}</i></div>`; }).join('')}</div></section>

    <div class="cols">
      <div class="queue">
        <h2>O que precisa da sua atenção</h2>
        ${!drafts.length && !noConsent.length && !ready.length
          ? emptyState('Tudo em dia', 'Nenhum rascunho para revisar e nenhum paciente sem consentimento.') : ''}
        ${drafts.length ? `<h3>${drafts.length} ${drafts.length === 1 ? 'relatório' : 'relatórios'} para revisar</h3>
          <div class="list">${drafts.slice(0, 5).map(reportLine).join('')}</div>
          ${drafts.length > 5 ? '<p style="margin-top:8px"><a href="#/relatorios?status=rascunho">Ver todos os rascunhos</a></p>' : ''}` : ''}
        ${ready.length ? `<h3>${ready.length} revisado(s) ainda não liberado(s) ao paciente</h3>
          <div class="list">${ready.slice(0, 4).map(reportLine).join('')}</div>` : ''}
        ${noConsent.length ? `<h3>${noConsent.length} ${noConsent.length === 1 ? 'paciente' : 'pacientes'} sem consentimento</h3>
          <div class="list">${noConsent.slice(0, 5).map((x) => `<a class="li" href="#/pacientes/${x.id}"><div class="grow t">${esc(x.name)}</div>${chip('Sem consentimento', 'warn')}${icon('right', 'go')}</a>`).join('')}</div>` : ''}
        <h3 style="margin-top:28px">Últimos registros</h3>
        ${reports.length ? `<div class="list">${reports.slice(0, 6).map(reportLine).join('')}</div>` : '<p class="muted">Ainda não há relatórios.</p>'}
      </div>

      ${doneN < todo.length ? `<aside class="panel">
        <h3>Deixe o sistema pronto</h3>
        <div class="progress" role="progressbar" aria-valuenow="${doneN}" aria-valuemax="${todo.length}"><i style="width:${(doneN / todo.length) * 100}%"></i></div>
        <p class="muted small">${doneN} de ${todo.length} passos</p>
        ${todo.map(([l, ok, href]) => `<div class="todo ${ok ? 'done' : ''}"><span class="box">${ok ? icon('check') : ''}</span>${ok ? `<span class="l">${esc(l)}</span>` : `<a href="${href}">${esc(l)}</a>`}</div>`).join('')}
      </aside>` : ''}
    </div>`;

  const go = $('#go-now');
  if (go) go.onclick = () => { const v = $('#who').value; goto(v ? `#/nova?paciente=${v}` : '#/nova'); };
}

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
export async function renderPatientDetail(id) {
  const main = shell('pacientes'); loading(main);
  const [p, consents, reports] = await Promise.all([api.getPatient(id), api.listConsents(id), api.listReports({ patientId: id })]);
  const active = api.hasActiveConsent(consents);
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
      <button class="btn quiet" id="dossier">${icon('download')}Prontuário</button>
      <button class="btn quiet" id="edit">${icon('edit')}Editar</button>`) +
    (isDemo(p) ? callout('<p><b>Paciente de teste.</b> Dados fictícios para você experimentar. Remova em Pacientes quando não precisar mais.</p>', 'warn') : '') +
    meta([p.email ? esc(p.email) : 'sem e-mail', p.phone ? esc(p.phone) : '', p.birth_date ? 'nascimento ' + fmtDate(p.birth_date) : '']) +
    '<div style="height:20px"></div>' +
    (!active ? callout('<p><b>Falta o consentimento deste paciente.</b> Sem ele, a gravação e o envio de áudio ficam bloqueados.</p>', 'warn', '<button class="btn sm" id="consent-top">Registrar agora</button>') : '') +
    (!p.email ? callout('<p>Sem e-mail cadastrado, não é possível liberar relatórios no portal do paciente.</p>', '', '<button class="btn sm quiet" id="edit-mail">Adicionar e-mail</button>') : '') + `
    <div class="cols">
      <section>
        <div class="panel-head" style="margin-top:22px"><h2>Linha do tempo</h2><span class="muted small">${anamneses.length} anamnese · ${evolucoes.length} evoluções · ${periodos.length} por período</span></div>
        ${timeline || emptyState('Nenhum registro ainda', 'Comece pela anamnese (entrevista inicial) ou registre a primeira evolução.', `<div class="row"><a class="btn quiet" href="#/nova?paciente=${p.id}&tipo=anamnese">${icon('file')}Fazer anamnese</a><a class="btn bloom" href="#/nova?paciente=${p.id}">${icon('mic')}Nova evolução</a></div>`)}
        ${p.notes ? `<h3 style="margin-top:26px">Observações</h3><p class="pre">${esc(p.notes)}</p>` : ''}
      </section>
      <aside>
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
    (r.fmt === 'word' ? exportDossierWord : exportDossierPdf)(args);
  };
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
