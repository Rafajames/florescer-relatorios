import * as api from './api.js';
import * as ai from './ai.js';
import { createCapture, canRecord, canLiveTranscribe, fmtClock } from './capture.js';
import { exportWord, exportPdf } from './export.js';
import { state, SPECIALTIES, DEFAULT_CONSENT } from './state.js';
import {
  $, $$, esc, fmtDate, fmtDateTime, todayISO, daysAgoISO, toast, openModal, confirmBox, busy,
  autosize, chip, statusChip, shell, loading, pageHeader,
} from './ui.js';

const goto = (h) => { location.hash = h; };
const siteUrl = () => location.origin + location.pathname;

const reportRow = (r) => `
  <a class="row-item" href="#/relatorio/${r.id}">
    <div><div class="t">${esc(r.title)}</div>
    <div class="muted small">${esc(r.patients?.name || '')} · ${fmtDate(r.session_date)}${r.kind === 'periodo' ? ' · Período' : ''}</div></div>
    ${statusChip(r)}
  </a>`;

/* =====================================================================
   PAINEL
   ===================================================================== */
export async function renderDashboard() {
  const main = shell('painel'); loading(main);
  const [patients, reports] = await Promise.all([api.listPatients(), api.listReports({ limit: 200 })]);
  const drafts = reports.filter((r) => r.status === 'rascunho');
  const month = todayISO().slice(0, 7);
  const thisMonth = reports.filter((r) => r.kind === 'sessao' && r.session_date.startsWith(month)).length;
  const firstName = (state.profile.full_name || '').split(' ')[0] || 'profissional';
  const noKeys = !ai.hasClaudeKey() || !ai.hasWhisperKey();

  main.innerHTML = pageHeader(`Olá, ${esc(firstName)}`, 'Resumo do seu atendimento', '<a class="btn" href="#/nova">Nova sessão</a>') + `
    ${noKeys ? `<div class="notice">Para transcrever áudio e gerar esboços com IA, cadastre suas chaves em <a href="#/config">Configurações</a>. Sem elas, você ainda pode escrever os relatórios manualmente.</div>` : ''}
    <div class="stats">
      <div class="stat"><div class="n">${patients.length}</div><div class="l">Pacientes ativos</div></div>
      <div class="stat"><div class="n">${thisMonth}</div><div class="l">Sessões registradas no mês</div></div>
      <div class="stat ${drafts.length ? 'warn' : ''}"><div class="n">${drafts.length}</div><div class="l">Rascunhos para revisar</div></div>
    </div>
    ${patients.length === 0 ? `
      <div class="card"><h3>Primeiros passos</h3>
        <ol class="steps">
          <li><a href="#/pacientes">Cadastre um paciente</a> (use iniciais ou nome social se preferir).</li>
          <li>Registre o <b>consentimento</b> do paciente na ficha dele.</li>
          <li>Abra <a href="#/nova">Nova sessão</a>, grave ou envie o áudio e gere o esboço.</li>
          <li>Revise, marque como revisado e, se quiser, libere ao paciente.</li>
        </ol></div>` : `
      <div class="grid2">
        <section class="card"><h3>Para revisar</h3>
          ${drafts.length ? drafts.slice(0, 6).map(reportRow).join('') : '<p class="muted">Nenhum rascunho pendente. 🎉</p>'}
        </section>
        <section class="card"><h3>Últimos relatórios</h3>
          ${reports.length ? reports.slice(0, 6).map(reportRow).join('') : '<p class="muted">Ainda não há relatórios.</p>'}
        </section>
      </div>`}`;
}

/* =====================================================================
   PACIENTES
   ===================================================================== */
async function patientModal(existing = {}) {
  return openModal(existing.id ? 'Editar paciente' : 'Novo paciente', `
    <label class="field">Nome / identificação*<input name="name" required value="${esc(existing.name || '')}"></label>
    <label class="field">E-mail (para o paciente acessar o portal)<input type="email" name="email" value="${esc(existing.email || '')}"></label>
    <div class="grid2">
      <label class="field">Telefone<input name="phone" value="${esc(existing.phone || '')}"></label>
      <label class="field">Nascimento<input type="date" name="birth_date" value="${esc(existing.birth_date || '')}"></label>
    </div>
    <label class="field">Observações<textarea name="notes" rows="3">${esc(existing.notes || '')}</textarea></label>`,
  {
    onOk: async (d) => {
      const g = (n) => d.querySelector(`[name=${n}]`).value.trim();
      return api.savePatient({
        ...(existing.id ? { id: existing.id } : {}),
        name: g('name'), email: g('email') || null, phone: g('phone') || null,
        birth_date: g('birth_date') || null, notes: g('notes') || null,
      });
    },
  });
}

export async function renderPatients() {
  const main = shell('pacientes'); loading(main);
  let showArchived = false;
  let all = await api.listPatients(false);

  const draw = () => {
    const q = ($('#q')?.value || '').toLowerCase();
    const rows = all.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q));
    $('#plist').innerHTML = rows.length ? rows.map((p) => `
      <a class="row-item" href="#/pacientes/${p.id}">
        <div><div class="t">${esc(p.name)}${p.archived ? ' ' + chip('Arquivado') : ''}</div>
        <div class="muted small">${esc(p.email || 'sem e-mail')}${p.phone ? ' · ' + esc(p.phone) : ''}</div></div>
        ${api.hasActiveConsent(p.consents) ? chip('Consentimento ok', 'green') : chip('Sem consentimento', 'amber')}
      </a>`).join('') : '<p class="muted pad">Nenhum paciente encontrado.</p>';
  };

  main.innerHTML = pageHeader('Pacientes', '', '<button class="btn" id="add">Novo paciente</button>') + `
    <div class="card">
      <div class="row between">
        <input id="q" type="search" placeholder="Buscar por nome ou e-mail" class="grow">
        <label class="check"><input type="checkbox" id="arch"> Mostrar arquivados</label>
      </div>
      <div id="plist"></div>
    </div>`;
  draw();
  $('#q').oninput = draw;
  $('#arch').onchange = async (e) => { showArchived = e.target.checked; all = await api.listPatients(showArchived); draw(); };
  $('#add').onclick = async () => { const p = await patientModal(); if (p && p.id) goto(`#/pacientes/${p.id}`); };
}

export async function renderPatientDetail(id) {
  const main = shell('pacientes'); loading(main);
  const [p, consents, reports] = await Promise.all([api.getPatient(id), api.listConsents(id), api.listReports({ patientId: id })]);
  const active = api.hasActiveConsent(consents);

  main.innerHTML = `
    <p class="crumb"><a href="#/pacientes">← Pacientes</a></p>
    ${pageHeader(p.name, `${esc(p.email || 'sem e-mail')}${p.phone ? ' · ' + esc(p.phone) : ''}${p.birth_date ? ' · nasc. ' + fmtDate(p.birth_date) : ''}`, `
      <a class="btn" href="#/nova?paciente=${p.id}">Nova sessão</a>
      <a class="btn ghost" href="#/periodo?paciente=${p.id}">Relatório por período</a>
      <button class="btn ghost" id="edit">Editar</button>`)}
    ${p.notes ? `<div class="card"><h3>Observações</h3><p class="pre">${esc(p.notes)}</p></div>` : ''}

    <div class="grid2">
      <section class="card">
        <div class="row between"><h3>Consentimento (LGPD)</h3>${active ? chip('Ativo', 'green') : chip('Pendente', 'amber')}</div>
        ${consents.length ? consents.map((c) => `
          <div class="row-item static"><div class="small">${fmtDateTime(c.granted_at)} · ${esc(c.channel)}${c.revoked_at ? ` · <b>revogado em ${fmtDateTime(c.revoked_at)}</b>` : ''}</div>
          ${c.revoked_at ? '' : `<button class="link" data-revoke="${c.id}">Revogar</button>`}</div>`).join('') : '<p class="muted">Nenhum consentimento registrado. A gravação e o envio de áudio ficam bloqueados até que seja registrado.</p>'}
        <button class="btn ghost" id="consent">Registrar consentimento</button>
      </section>
      <section class="card">
        <h3>Portal do paciente</h3>
        ${p.email
          ? `<p>O paciente cria uma conta como <b>Paciente</b> em <code>${esc(siteUrl())}</code> usando o e-mail <b>${esc(p.email)}</b> e vê <b>somente</b> os relatórios que você revisar e liberar.</p>`
          : '<p class="muted">Cadastre o e-mail do paciente (botão Editar) para poder liberar relatórios no portal.</p>'}
      </section>
    </div>

    <section class="card"><h3>Relatórios</h3>
      ${reports.length ? reports.map(reportRow).join('') : '<p class="muted">Nenhum relatório ainda.</p>'}
    </section>

    <div class="row end">
      <button class="btn ghost" id="archive">${p.archived ? 'Desarquivar' : 'Arquivar paciente'}</button>
      <button class="btn danger" id="del">Excluir paciente e relatórios</button>
    </div>`;

  $('#edit').onclick = async () => { if (await patientModal(p)) renderPatientDetail(id); };
  $('#archive').onclick = async () => { await api.savePatient({ id, archived: !p.archived }); toast(p.archived ? 'Paciente reativado.' : 'Paciente arquivado.'); renderPatientDetail(id); };
  $('#del').onclick = async () => {
    if (!(await confirmBox(`Excluir ${p.name} e TODOS os relatórios dele? Esta ação não pode ser desfeita.`, 'Excluir definitivamente'))) return;
    await api.deletePatient(id); toast('Paciente excluído.'); goto('#/pacientes');
  };
  $$('[data-revoke]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Revogar este consentimento? A gravação de novas sessões ficará bloqueada.', 'Revogar'))) return;
    await api.revokeConsent(b.dataset.revoke); renderPatientDetail(id);
  }));
  $('#consent').onclick = async () => {
    const text = state.profile.consent_text || DEFAULT_CONSENT;
    const ok = await openModal('Registrar consentimento', `
      <div class="consent-text">${esc(text)}</div>
      <label class="field">Como foi obtido?
        <select name="channel"><option value="presencial">Presencial (verbal)</option><option value="escrito">Termo assinado</option><option value="digital">Digital (e-mail/mensagem)</option></select></label>
      <label class="check"><input type="checkbox" name="ok" required> Confirmo que o(a) paciente leu e concordou com o termo acima.</label>
      <p class="muted small">O texto pode ser ajustado em Configurações. Recomenda-se revisão por assessoria jurídica/conselho profissional.</p>`,
    { okText: 'Registrar', wide: true, onOk: (d) => api.addConsent({ patient_id: id, consent_text: text, channel: d.querySelector('[name=channel]').value }) });
    if (ok) { toast('Consentimento registrado.'); renderPatientDetail(id); }
  };
}

/* =====================================================================
   NOVA SESSÃO
   ===================================================================== */
export async function renderNewSession(params) {
  const main = shell('nova'); loading(main);
  const [patients, templates] = await Promise.all([api.listPatients(), api.listTemplates()]);
  const sessionTpls = templates.filter((t) => t.kind === 'sessao');
  const tplById = Object.fromEntries(sessionTpls.map((t) => [t.id, t]));
  const defTpl = sessionTpls.find((t) => t.specialty === state.profile.specialty) || sessionTpls[0];
  const pre = params.get('paciente');

  if (!patients.length) {
    main.innerHTML = pageHeader('Nova sessão') + '<div class="card"><p>Cadastre um paciente antes de registrar uma sessão.</p><a class="btn" href="#/pacientes">Ir para Pacientes</a></div>';
    return;
  }

  main.innerHTML = pageHeader('Nova sessão', 'Capte a sessão, confira a transcrição e gere o esboço do relatório.') + `
    <div class="card">
      <div class="grid2">
        <label class="field">Paciente<select id="patient"><option value="">Selecione…</option>
          ${patients.map((p) => `<option value="${p.id}" ${p.id === pre ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label class="field">Modelo de relatório<select id="tpl">
          ${sessionTpls.map((t) => `<option value="${t.id}" ${t === defTpl ? 'selected' : ''}>${esc(t.name)}${t.specialty ? ' · ' + esc(t.specialty) : ''}</option>`).join('')}</select></label>
        <label class="field">Data da sessão<input type="date" id="date" value="${todayISO()}"></label>
        <label class="field">Título<input id="title" value="Sessão de ${fmtDate(todayISO())}"></label>
      </div>
    </div>

    <div class="card">
      <h3>Captar a sessão</h3>
      <div id="gate" class="notice warn" hidden></div>
      <div class="row">
        <button class="btn" id="rec-start" ${canRecord() ? '' : 'disabled'}>● Iniciar gravação</button>
        <button class="btn danger" id="rec-stop" hidden>■ Parar e transcrever</button>
        <span id="clock" class="muted"></span>
        <label class="btn ghost" id="file-label">Enviar áudio<input type="file" id="file" accept="audio/*" hidden></label>
      </div>
      <p class="muted small">O áudio fica só na memória do navegador e é descartado após a transcrição. Apenas o texto é guardado, para conferência (auditoria) do que a IA escreveu.
        ${ai.hasWhisperKey() ? '' : ' Sem chave Whisper, a gravação usa a transcrição ao vivo do navegador (Chrome/Edge) e o envio de arquivos fica indisponível.'}</p>
      <div id="live" class="live" hidden></div>
      <label class="field">Transcrição (editável; você também pode colar ou digitar)
        <textarea id="transcript" rows="12" placeholder="A transcrição aparecerá aqui."></textarea></label>
    </div>

    <div class="row end">
      <button class="btn ghost" id="blank">Salvar sem IA (modelo em branco)</button>
      <button class="btn" id="gen">Gerar esboço com IA e salvar</button>
    </div>`;

  const cap = createCapture({
    onTick: (s) => ($('#clock').textContent = fmtClock(s)),
    onLive: (t) => { const l = $('#live'); l.hidden = false; l.textContent = 'Ao vivo: ' + t.slice(-300); },
  });
  let consentOk = false;

  const updateGate = () => {
    const gate = $('#gate'); const pid = $('#patient').value;
    let msg = '';
    if (!pid) msg = 'Selecione o paciente para liberar a gravação.';
    else if (!consentOk) msg = 'Este paciente ainda não tem consentimento registrado. Registre na ficha do paciente para liberar gravação/áudio (você ainda pode digitar ou colar a transcrição).';
    gate.hidden = !msg; gate.textContent = msg;
    const blocked = Boolean(msg) || cap.recording;
    $('#rec-start').disabled = !canRecord() || Boolean(msg) || cap.recording;
    $('#file-label').classList.toggle('disabled', Boolean(msg) || !ai.hasWhisperKey());
    $('#file').disabled = blocked || !ai.hasWhisperKey();
  };
  $('#patient').onchange = async () => {
    const pid = $('#patient').value;
    consentOk = pid ? api.hasActiveConsent(await api.listConsents(pid)) : false;
    updateGate();
  };
  if (pre) $('#patient').onchange(); else updateGate();

  const appendText = (t) => {
    const ta = $('#transcript');
    ta.value = (ta.value.trim() ? ta.value.trim() + '\n\n' : '') + t;
    autosize(ta);
  };

  $('#rec-start').onclick = async () => {
    try {
      await cap.start({ liveText: !ai.hasWhisperKey() && canLiveTranscribe });
      $('#rec-start').hidden = true; $('#rec-stop').hidden = false; $('#file-label').classList.add('disabled');
    } catch { toast('Não foi possível acessar o microfone. Verifique a permissão do navegador.', 'err'); }
  };
  $('#rec-stop').onclick = async (e) => {
    const { blob, live } = await cap.stop();
    $('#rec-stop').hidden = true; $('#rec-start').hidden = false; $('#live').hidden = true; $('#clock').textContent = '';
    if (ai.hasWhisperKey()) {
      await busy(e.target, 'Transcrevendo…', async () => { appendText(await ai.transcribeAudio(blob)); toast('Transcrição concluída. O áudio foi descartado.'); });
    } else if (live) { appendText(live); toast('Transcrição ao vivo adicionada. O áudio foi descartado.'); }
    else toast('Sem transcrição: cadastre a chave Whisper em Configurações ou digite o texto.', 'err');
    updateGate();
  };
  $('#file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const lab = $('#file-label'); lab.classList.add('disabled');
    try { toast('Transcrevendo áudio…'); appendText(await ai.transcribeAudio(f)); toast('Transcrição concluída. O arquivo não foi guardado.'); }
    catch (err) { toast(err.message, 'err'); }
    e.target.value = ''; updateGate();
  };

  const create = async (withAI, btn) => {
    const patient_id = $('#patient').value;
    if (!patient_id) return toast('Selecione o paciente.', 'err');
    const tpl = tplById[$('#tpl').value];
    const transcript = $('#transcript').value.trim();
    await busy(btn, withAI ? 'Gerando esboço…' : 'Salvando…', async () => {
      let sections = tpl.sections.map((s) => ({ title: s.title, text: '' }));
      if (withAI) {
        if (!transcript) throw new Error('Não há transcrição para gerar o esboço.');
        sections = await ai.generateSessionSections({ template: tpl.sections, transcript });
      }
      const rep = await api.createReport({
        patient_id, template_id: tpl.id, kind: 'sessao',
        title: $('#title').value.trim() || 'Sessão', session_date: $('#date').value || todayISO(),
        transcript: transcript || null, sections, ai_generated: withAI,
      });
      goto(`#/relatorio/${rep.id}`);
    });
  };
  $('#gen').onclick = (e) => create(true, e.target);
  $('#blank').onclick = (e) => create(false, e.target);
  $('#transcript').oninput = (e) => autosize(e.target);
  window.__cleanup = () => cap.cancel();
}

/* =====================================================================
   RELATÓRIO (editor)
   ===================================================================== */
export async function renderReport(id) {
  const main = shell('relatorios'); loading(main);
  const [r, audit] = await Promise.all([api.getReport(id), api.listAudit(id)]);
  const sections = JSON.parse(JSON.stringify(r.sections || []));
  let dirty = false;
  const reviewed = r.status === 'revisado';
  const canRelease = reviewed && r.patients?.email;

  main.innerHTML = `
    <p class="crumb"><a href="#/pacientes/${r.patients.id}">← ${esc(r.patients.name)}</a></p>
    <header class="page-head">
      <div class="grow"><input id="title" class="title-input" value="${esc(r.title)}">
        <p class="muted">${esc(r.patients.name)} · ${r.kind === 'periodo' ? `Período ${fmtDate(r.period_start)} a ${fmtDate(r.period_end)}` : `<input type="date" id="date" value="${esc(r.session_date)}" class="inline-date">`}
        ${r.ai_generated ? ' · ' + chip('Esboço com IA', 'blue') : ''} ${statusChip(r)}</p></div>
      <div class="row">
        <span id="dirty" class="muted small"></span>
        <button class="btn" id="save">Salvar</button>
      </div>
    </header>
    ${r.ai_generated && !reviewed ? '<div class="notice">Este texto foi gerado com apoio de IA e pode conter erros. Confira com a transcrição e edite antes de marcar como revisado.</div>' : ''}
    <div id="secs"></div>
    <div class="row"><button class="btn ghost" id="add-sec">+ Adicionar seção</button>
      ${r.kind === 'sessao' ? '<button class="btn ghost" id="regen">Regenerar com IA</button>' : ''}</div>

    <section class="card">
      <h3>Revisão e entrega</h3>
      <div class="row">
        ${reviewed
          ? '<button class="btn ghost" id="reopen">Reabrir para edição</button>'
          : '<button class="btn" id="review">Marcar como revisado</button>'}
        <button class="btn ${r.released_to_patient ? 'ghost' : ''}" id="release" ${canRelease ? '' : 'disabled'}>${r.released_to_patient ? 'Retirar do portal do paciente' : 'Liberar ao paciente'}</button>
        <button class="btn ghost" id="word">Exportar Word</button>
        <button class="btn ghost" id="pdf">Exportar PDF</button>
      </div>
      ${canRelease ? '' : `<p class="muted small">${reviewed ? 'Cadastre o e-mail do paciente para poder liberar.' : 'Marque como revisado para poder liberar ao paciente.'}</p>`}
    </section>

    ${r.transcript ? `<details class="card"><summary>Transcrição original (registro para auditoria — somente leitura)</summary><div class="transcript">${esc(r.transcript)}</div></details>` : ''}
    <details class="card"><summary>Histórico de alterações</summary>
      ${audit.length ? audit.map((a) => `<div class="small muted">${fmtDateTime(a.created_at)} · ${esc({ insert: 'criado', update: 'alterado', delete: 'excluído' }[a.action] || a.action)}${a.detail?.status ? ' · ' + esc(a.detail.status) : ''}${a.detail?.released ? ' · liberado' : ''}</div>`).join('') : '<p class="muted">Sem registros.</p>'}
    </details>
    <div class="row end"><button class="btn danger" id="del">Excluir relatório</button></div>`;

  const markDirty = () => { dirty = true; window.__dirty = true; $('#dirty').textContent = 'Alterações não salvas'; };
  const drawSections = () => {
    $('#secs').innerHTML = sections.map((s, i) => `
      <div class="card sec" data-i="${i}">
        <div class="row between"><input class="sec-title" data-f="title" value="${esc(s.title)}"><button class="link" data-rm="${i}">Remover</button></div>
        <textarea data-f="text" rows="3">${esc(s.text)}</textarea>
      </div>`).join('');
    $$('#secs textarea').forEach(autosize);
  };
  drawSections();
  $('#secs').addEventListener('input', (e) => {
    const card = e.target.closest('.sec'); if (!card) return;
    sections[+card.dataset.i][e.target.dataset.f] = e.target.value;
    if (e.target.tagName === 'TEXTAREA') autosize(e.target);
    markDirty();
  });
  $('#secs').addEventListener('click', (e) => {
    const rm = e.target.dataset.rm; if (rm === undefined) return;
    sections.splice(+rm, 1); drawSections(); markDirty();
  });
  $('#add-sec').onclick = () => { sections.push({ title: 'Nova seção', text: '' }); drawSections(); markDirty(); };
  $('#title').oninput = markDirty;
  if ($('#date')) $('#date').oninput = markDirty;

  const save = async (extra = {}) => {
    const patch = { title: $('#title').value.trim() || r.title, sections, ...extra };
    if ($('#date')) patch.session_date = $('#date').value || r.session_date;
    if (dirty && r.status === 'revisado' && !('status' in extra)) {
      Object.assign(patch, { status: 'rascunho', released_to_patient: false, released_at: null });
      toast('Relatório editado: voltou para rascunho e saiu do portal do paciente.');
    }
    await api.updateReport(id, patch);
    dirty = false; window.__dirty = false;
  };
  const reload = () => renderReport(id);

  $('#save').onclick = (e) => busy(e.target, 'Salvando…', async () => { await save(); toast('Salvo.'); reload(); });
  if ($('#review')) $('#review').onclick = async (e) => {
    if (!(await confirmBox('Confirmo que revisei o conteúdo e o conferi com o que foi dito na sessão.', 'Confirmar revisão'))) return;
    await busy(e.target, 'Salvando…', async () => { await save({ status: 'revisado' }); reload(); });
  };
  if ($('#reopen')) $('#reopen').onclick = (e) => busy(e.target, 'Salvando…', async () => {
    await save({ status: 'rascunho', released_to_patient: false, released_at: null }); reload();
  });
  $('#release').onclick = (e) => busy(e.target, 'Salvando…', async () => {
    const releasing = !r.released_to_patient;
    if (releasing && !(await confirmBox('Liberar este relatório para o paciente? Ele poderá ver o texto no portal (a transcrição não é exibida).', 'Liberar'))) return;
    await save({ released_to_patient: releasing, released_at: releasing ? new Date().toISOString() : null });
    toast(releasing ? 'Liberado ao paciente.' : 'Retirado do portal.'); reload();
  });
  const exportArgs = () => ({
    report: { ...r, title: $('#title').value.trim() || r.title, session_date: $('#date')?.value || r.session_date },
    patientName: r.patients.name, professional: state.profile, sections,
  });
  $('#word').onclick = () => exportWord(exportArgs());
  $('#pdf').onclick = () => exportPdf(exportArgs());
  $('#del').onclick = async () => {
    if (!(await confirmBox('Excluir este relatório definitivamente?', 'Excluir'))) return;
    await api.deleteReport(id); toast('Relatório excluído.'); goto(`#/pacientes/${r.patients.id}`);
  };
  if ($('#regen')) $('#regen').onclick = async (e) => {
    if (!r.transcript) return toast('Este relatório não tem transcrição para regenerar.', 'err');
    if (!(await confirmBox('Substituir o texto atual por um novo esboço da IA? Suas edições nas seções serão perdidas.', 'Regenerar'))) return;
    await busy(e.target, 'Gerando…', async () => {
      const tpl = sections.map((s) => ({ title: s.title, hint: '' }));
      const fresh = await ai.generateSessionSections({ template: tpl, transcript: r.transcript });
      await api.updateReport(id, { sections: fresh, ai_generated: true, status: 'rascunho', released_to_patient: false, released_at: null });
      toast('Novo esboço gerado.'); reload();
    });
  };
  window.__dirty = false;
}

/* =====================================================================
   RELATÓRIO POR PERÍODO
   ===================================================================== */
export async function renderPeriod(params) {
  const main = shell('periodo'); loading(main);
  const [patients, templates] = await Promise.all([api.listPatients(), api.listTemplates()]);
  const tpls = templates.filter((t) => t.kind === 'periodo');
  const pre = params.get('paciente');
  let found = [];

  main.innerHTML = pageHeader('Relatório por período', 'Reúna os atendimentos de um paciente e gere um relatório de acompanhamento.') + `
    <div class="card">
      <div class="grid2">
        <label class="field">Paciente<select id="patient"><option value="">Selecione…</option>
          ${patients.map((p) => `<option value="${p.id}" ${p.id === pre ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <label class="field">Modelo<select id="tpl">${tpls.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
        <label class="field">De<input type="date" id="from" value="${daysAgoISO(90)}"></label>
        <label class="field">Até<input type="date" id="to" value="${todayISO()}"></label>
      </div>
      <label class="check"><input type="checkbox" id="drafts"> Incluir sessões ainda em rascunho</label>
      <div class="row"><button class="btn" id="search">Buscar atendimentos</button></div>
    </div>
    <div id="result"></div>`;

  $('#search').onclick = (e) => busy(e.target, 'Buscando…', async () => {
    const patientId = $('#patient').value;
    if (!patientId) throw new Error('Selecione o paciente.');
    found = await api.listReports({
      patientId, kind: 'sessao', from: $('#from').value, to: $('#to').value,
      status: $('#drafts').checked ? undefined : 'revisado', withSections: true,
    });
    const box = $('#result');
    if (!found.length) { box.innerHTML = '<div class="card"><p class="muted">Nenhuma sessão encontrada nesse período. Só sessões revisadas entram por padrão.</p></div>'; return; }
    found.sort((a, b) => a.session_date.localeCompare(b.session_date));
    box.innerHTML = `<div class="card"><h3>${found.length} sessão(ões) encontrada(s)</h3>
      ${found.map((x) => `<label class="row-item static"><span><input type="checkbox" data-pick="${x.id}" checked> ${esc(x.title)} · ${fmtDate(x.session_date)}</span>${statusChip(x)}</label>`).join('')}
      <div class="row end">
        <button class="btn ghost" id="blank">Criar em branco</button>
        <button class="btn" id="gen">Gerar relatório de acompanhamento com IA</button>
      </div></div>`;

    const build = async (withAI, btn) => {
      const picked = found.filter((x) => $(`[data-pick="${x.id}"]`).checked);
      if (!picked.length) return toast('Selecione ao menos uma sessão.', 'err');
      const tpl = templates.find((t) => t.id === $('#tpl').value);
      if (!tpl) return toast('Nenhum modelo de período disponível.', 'err');
      const pname = patients.find((p) => p.id === patientId)?.name || '';
      await busy(btn, withAI ? 'Gerando…' : 'Criando…', async () => {
        let sections = tpl.sections.map((s) => ({ title: s.title, text: '' }));
        if (withAI) {
          sections = await ai.generatePeriodSections({
            template: tpl.sections,
            periodLabel: `${fmtDate($('#from').value)} a ${fmtDate($('#to').value)}`,
            sessions: picked.map((x) => ({ date: fmtDate(x.session_date), title: x.title, sections: x.sections })),
          });
        }
        const rep = await api.createReport({
          patient_id: patientId, template_id: tpl.id, kind: 'periodo',
          title: `Relatório de acompanhamento — ${pname}`, session_date: todayISO(),
          period_start: $('#from').value, period_end: $('#to').value, sections, ai_generated: withAI,
        });
        goto(`#/relatorio/${rep.id}`);
      });
    };
    $('#gen').onclick = (ev) => build(true, ev.target);
    $('#blank').onclick = (ev) => build(false, ev.target);
  });
  if (pre) $('#search').click();
}

/* =====================================================================
   MODELOS
   ===================================================================== */
const sectionsToText = (s) => s.map((x) => (x.hint ? `${x.title} | ${x.hint}` : x.title)).join('\n');
const textToSections = (t) => t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const [title, ...rest] = l.split('|'); return { title: title.trim(), hint: rest.join('|').trim() };
});

async function templateModal(t = {}) {
  return openModal(t.id ? 'Editar modelo' : 'Novo modelo', `
    <label class="field">Nome*<input name="name" required value="${esc(t.name || '')}"></label>
    <div class="grid2">
      <label class="field">Área<select name="specialty">${['Geral', ...SPECIALTIES].map((s) => `<option ${s === (t.specialty || state.profile.specialty) ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="field">Tipo<select name="kind"><option value="sessao" ${t.kind !== 'periodo' ? 'selected' : ''}>Sessão</option><option value="periodo" ${t.kind === 'periodo' ? 'selected' : ''}>Período</option></select></label>
    </div>
    <label class="field">Seções (uma por linha). Opcional: <code>Título | orientação para a IA</code>
      <textarea name="sections" rows="8" required>${esc(sectionsToText(t.sections || []))}</textarea></label>`,
  {
    wide: true,
    onOk: (d) => {
      const g = (n) => d.querySelector(`[name=${n}]`).value.trim();
      const sections = textToSections(g('sections'));
      if (!sections.length) throw new Error('Informe ao menos uma seção.');
      return api.saveTemplate({ ...(t.id && t.professional_id ? { id: t.id } : {}), name: g('name'), specialty: g('specialty'), kind: g('kind'), sections });
    },
  });
}

export async function renderTemplates() {
  const main = shell('modelos'); loading(main);
  const list = await api.listTemplates();
  const sys = list.filter((t) => !t.professional_id), mine = list.filter((t) => t.professional_id);
  const row = (t, own) => `<div class="row-item static">
    <div><div class="t">${esc(t.name)} ${chip(t.kind === 'periodo' ? 'Período' : 'Sessão')} ${t.specialty ? chip(t.specialty) : ''}</div>
    <div class="muted small">${t.sections.map((s) => esc(s.title)).join(' · ')}</div></div>
    <div class="row">${own
      ? `<button class="link" data-edit="${t.id}">Editar</button><button class="link" data-del="${t.id}">Excluir</button>`
      : `<button class="link" data-dup="${t.id}">Duplicar e editar</button>`}</div></div>`;
  main.innerHTML = pageHeader('Modelos de relatório', 'Defina as seções de cada tipo de relatório. A IA segue essas seções.', '<button class="btn" id="new">Novo modelo</button>') + `
    <section class="card"><h3>Meus modelos</h3>${mine.length ? mine.map((t) => row(t, true)).join('') : '<p class="muted">Você ainda não criou modelos. Duplique um do sistema para começar.</p>'}</section>
    <section class="card"><h3>Modelos do sistema</h3>${sys.map((t) => row(t, false)).join('')}</section>`;
  const byId = Object.fromEntries(list.map((t) => [t.id, t]));
  $('#new').onclick = async () => { if (await templateModal()) renderTemplates(); };
  $$('[data-edit]').forEach((b) => (b.onclick = async () => { if (await templateModal(byId[b.dataset.edit])) renderTemplates(); }));
  $$('[data-dup]').forEach((b) => (b.onclick = async () => {
    const t = byId[b.dataset.dup];
    if (await templateModal({ ...t, id: undefined, professional_id: undefined, name: t.name + ' (meu)' })) renderTemplates();
  }));
  $$('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Excluir este modelo? Relatórios já criados continuam intactos.', 'Excluir'))) return;
    await api.deleteTemplate(b.dataset.del); renderTemplates();
  }));
}

/* =====================================================================
   CONFIGURAÇÕES
   ===================================================================== */
export async function renderSettings() {
  const main = shell('config');
  const p = state.profile;
  const keys = ai.getKeys();
  main.innerHTML = pageHeader('Configurações') + `
    <section class="card"><h3>Seu perfil (aparece no timbre dos relatórios)</h3>
      <form id="prof" class="stack">
        <div class="grid2">
          <label class="field">Nome completo<input name="full_name" required value="${esc(p.full_name)}"></label>
          <label class="field">Área de atuação<select name="specialty">${SPECIALTIES.map((s) => `<option ${s === p.specialty ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
          <label class="field">Registro no conselho<input name="council_registry" value="${esc(p.council_registry || '')}" placeholder="ex.: CRP 20/12345"></label>
          <label class="field">Nome da clínica / consultório<input name="clinic_name" value="${esc(p.clinic_name || '')}"></label>
        </div>
        <label class="field">Texto do termo de consentimento
          <textarea name="consent_text" rows="9" placeholder="Deixe em branco para usar o texto padrão">${esc(p.consent_text || '')}</textarea></label>
        <div class="row"><button class="btn" type="submit">Salvar perfil</button>
          <button type="button" class="link" id="def-consent">Usar texto padrão</button></div>
      </form></section>

    <section class="card"><h3>Chaves de IA (somente neste computador)</h3>
      <p class="muted">Cada profissional usa a própria conta. As chaves ficam guardadas apenas neste navegador e <b>nunca</b> vão para o banco de dados. O texto das sessões é enviado ao provedor (Anthropic/OpenAI) para gerar o esboço; informe isso no consentimento. Defina um limite de gasto no painel de cada provedor.</p>
      <form id="keys" class="stack">
        <label class="field">Chave da Anthropic (Claude) — gera os esboços
          <input type="password" name="anthropic" autocomplete="off" placeholder="${keys.anthropic ? 'Chave salva — deixe em branco para manter' : 'sk-ant-…'}"></label>
        <label class="field">Chave da OpenAI (Whisper) — transcreve áudio
          <input type="password" name="openai" autocomplete="off" placeholder="${keys.openai ? 'Chave salva — deixe em branco para manter' : 'sk-…'}"></label>
        <div class="row"><button class="btn" type="submit">Salvar chaves</button>
          <button type="button" class="link" id="clear-keys">Remover chaves deste computador</button></div>
      </form></section>`;

  $('#def-consent').onclick = () => { $('[name=consent_text]').value = ''; toast('Será usado o texto padrão ao salvar.'); };
  $('#prof').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    await busy(e.target.querySelector('[type=submit]'), 'Salvando…', async () => {
      state.profile = await api.updateProfile(p.id, {
        full_name: f.get('full_name').trim(), specialty: f.get('specialty'),
        council_registry: f.get('council_registry').trim() || null,
        clinic_name: f.get('clinic_name').trim() || null,
        consent_text: f.get('consent_text').trim() || null,
      });
      toast('Perfil salvo.');
    });
  };
  $('#keys').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target); const cur = ai.getKeys();
    ai.setKeys({ anthropic: f.get('anthropic').trim() || cur.anthropic, openai: f.get('openai').trim() || cur.openai });
    toast('Chaves salvas neste computador.'); renderSettings();
  };
  $('#clear-keys').onclick = async () => {
    if (!(await confirmBox('Remover as chaves de IA deste computador?', 'Remover'))) return;
    ai.clearKeys(); toast('Chaves removidas.'); renderSettings();
  };
}
