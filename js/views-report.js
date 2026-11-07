import * as api from './api.js';
import * as ai from './ai.js';
import { exportWord, exportPdf } from './export.js';
import { state } from './state.js';
import { getPrefs } from './prefs.js';
import {
  $, $$, esc, fmtDate, fmtDateTime, fmtTime, toast, openModal, confirmBox, busy, autosize, debounce, wordCount,
  chip, statusChip, meta, callout, shell, loading, backLink, icon,
} from './ui.js';

const goto = (h) => { location.hash = h; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const visible = (s) => s.patient_visible !== false;

export async function renderReport(id) {
  const main = shell('relatorios'); loading(main);
  const [r, audit] = await Promise.all([api.getReport(id), api.listAudit(id)]);
  const prefs = getPrefs();
  const sections = clone(r.sections || []);
  let dirty = false, tab = 'relatorio', savedAt = null;
  const reviewed = r.status === 'revisado';
  const canRelease = reviewed && r.patients?.email;
  const pro = state.profile;
  const reg = [pro.specialty, pro.council_registry].filter(Boolean).join(', ');

  main.innerHTML = backLink(`#/pacientes/${r.patients.id}`, r.patients.name) + `
    <div class="editor">
      <div>
        <input id="title" class="title-input" value="${esc(r.title)}" aria-label="Título do relatório">
        ${meta([
          r.kind === 'periodo' ? `Período ${fmtDate(r.period_start)} a ${fmtDate(r.period_end)}` : `<input type="date" id="date" class="inline-date" value="${esc(r.session_date)}" aria-label="Data">`,
          statusChip(r), r.ai_generated ? chip('Esboço com IA', 'bloom') : '',
          `<span id="wc"></span>`,
        ])}
        ${r.ai_generated && !reviewed ? '<div style="height:14px"></div>' + callout('<p>Este texto foi gerado com apoio de IA e pode conter erros. Confira com a transcrição e edite antes de marcar como revisado.</p>', 'warn') : ''}
        <div class="tabs" role="tablist">
          <button class="tab on" data-tab="relatorio" role="tab">Relatório</button>
          ${r.transcript ? '<button class="tab" data-tab="transcricao" role="tab">Transcrição</button>' : ''}
          <button class="tab" data-tab="historico" role="tab">Histórico</button>
        </div>
        <div id="pane"></div>
      </div>

      <aside class="status-rail">
        <div class="panel">
          <ol class="flow">
            <li class="done"><span class="dot">${icon('check')}</span><div><b>Rascunho</b><span>Criado em ${fmtDate(r.created_at)}</span></div></li>
            <li class="${reviewed ? 'done' : 'cur'}"><span class="dot">${reviewed ? icon('check') : ''}</span><div><b>Revisado</b><span>${reviewed ? 'Conferido por você' : 'Falta sua conferência'}</span></div></li>
            <li class="${r.released_to_patient ? 'done' : reviewed ? 'cur' : ''}"><span class="dot">${r.released_to_patient ? icon('check') : ''}</span><div><b>Liberado ao paciente</b><span>${r.released_to_patient ? 'Visível no portal' : 'Só você vê por enquanto'}</span></div></li>
          </ol>
          <div class="stack-btns">
            ${!reviewed ? `<button class="btn bloom" id="review">${icon('check')}Marcar como revisado</button>` : ''}
            ${reviewed && !r.released_to_patient ? `<button class="btn bloom" id="release" ${canRelease ? '' : 'disabled'}>${icon('eye')}Liberar ao paciente</button>` : ''}
            ${r.released_to_patient ? `<button class="btn quiet" id="unrelease">${icon('eyeoff')}Retirar do portal</button>` : ''}
            ${reviewed ? `<button class="btn quiet" id="reopen">${icon('edit')}Reabrir para edição</button>` : ''}
          </div>
          ${reviewed && !r.patients?.email ? '<p class="small muted" style="margin-top:8px">Cadastre o e-mail do paciente para poder liberar.</p>' : ''}
          <div class="save-state" id="savestate"></div>
        </div>
        <div class="panel">
          <h3>Entrega</h3>
          <div class="stack-btns" style="margin-top:8px">
            <button class="btn quiet" id="preview">${icon('eye')}Prévia do portal</button>
            <button class="btn quiet" id="word">${icon('download')}Exportar Word</button>
            <button class="btn quiet" id="pdf">${icon('download')}Exportar PDF</button>
          </div>
          <label class="check small" style="margin-top:10px"><input type="checkbox" id="onlyvis">Exportar só as seções visíveis ao paciente</label>
        </div>
        <div class="panel flat">
          <button class="btn danger sm" id="del">${icon('trash')}Excluir relatório</button>
        </div>
      </aside>
    </div>`;

  /* ---------- estado de salvamento ---------- */
  const setState = (txt, ok) => { $('#savestate').innerHTML = `${ok ? icon('check') : ''}<span>${esc(txt)}</span>`; };
  const totalWords = () => sections.reduce((n, s) => n + wordCount(s.text), 0);
  const updateWc = () => { const el = $('#wc'); if (el) el.textContent = `${totalWords()} palavras`; };
  setState('Tudo salvo', true);

  const save = async (extra = {}) => {
    const patch = { title: $('#title').value.trim() || r.title, sections, ...extra };
    if ($('#date')) patch.session_date = $('#date').value || r.session_date;
    if (dirty && r.status === 'revisado' && !('status' in extra)) {
      Object.assign(patch, { status: 'rascunho', released_to_patient: false, released_at: null });
      toast('Você editou um relatório revisado: ele voltou para rascunho e saiu do portal.');
    }
    await api.updateReport(id, patch);
    dirty = false; window.__dirty = false; savedAt = new Date();
  };

  const autosave = debounce(async () => {
    if (!dirty || r.status !== 'rascunho' || !prefs.autosave) return;
    setState('Salvando…');
    try { await save(); setState(`Salvo automaticamente às ${fmtTime(savedAt)}`, true); }
    catch (e) { setState('Não foi possível salvar. Use o botão Salvar.'); }
  }, 2500);

  const markDirty = () => {
    dirty = true; window.__dirty = true; updateWc();
    setState(r.status === 'rascunho' && prefs.autosave ? 'Alterações pendentes…' : 'Alterações não salvas');
    autosave();
  };

  /* ---------- painéis ---------- */
  const sheet = () => `
    <article class="sheet">
      <div class="sheet-head"><b>${esc(pro.clinic_name || pro.full_name || '')}</b><span>${esc(pro.full_name || '')}${reg ? ', ' + esc(reg) : ''}</span></div>
      <div class="sheet-meta"><b>${esc(r.patients.name)}</b>${r.kind === 'periodo' ? `, período ${fmtDate(r.period_start)} a ${fmtDate(r.period_end)}` : `, ${fmtDate($('#date')?.value || r.session_date)}`}</div>
      <div id="secs">${sections.map((s, i) => secHtml(s, i)).join('')}</div>
      <div class="sheet-foot">${r.ai_generated ? 'Elaborado com apoio de ferramenta de inteligência artificial e revisado pelo(a) profissional responsável. ' : ''}Documento confidencial, com dados sensíveis de saúde (LGPD).</div>
    </article>
    <div class="row add-sec"><button class="btn quiet sm" id="add-sec">${icon('plus')}Adicionar seção</button>
      <button class="btn quiet sm" id="save">Salvar agora</button></div>`;

  const secHtml = (s, i) => `
    <div class="sec" data-i="${i}">
      <div class="sec-side">
        <input class="sec-title" data-f="title" value="${esc(s.title)}" aria-label="Título da seção">
        <div class="sec-tools">
          <button class="icon-btn" data-act="up" title="Subir seção" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
          <button class="icon-btn" data-act="down" title="Descer seção" ${i === sections.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
          <button class="icon-btn ${visible(s) ? '' : 'off'}" data-act="vis" title="${visible(s) ? 'Visível ao paciente (clique para ocultar)' : 'Oculta ao paciente (clique para mostrar)'}">${icon(visible(s) ? 'eye' : 'eyeoff')}</button>
          ${r.kind === 'sessao' ? `<button class="icon-btn" data-act="ai" title="Reescrever esta seção com IA">${icon('sparkle')}</button>` : ''}
          <button class="icon-btn" data-act="rm" title="Remover seção">${icon('trash')}</button>
        </div>
        ${visible(s) ? '' : '<span class="chip bloom sec-hidden">Oculta ao paciente</span>'}
      </div>
      <textarea data-f="text" rows="2" aria-label="Texto da seção ${esc(s.title)}">${esc(s.text)}</textarea>
    </div>`;

  const drawSheet = () => {
    $('#pane').innerHTML = sheet();
    $$('#pane textarea').forEach(autosize);
    updateWc();
    $('#add-sec').onclick = () => { sections.push({ title: 'Nova seção', text: '', patient_visible: prefs.sectionsVisibleToPatient }); drawSheet(); markDirty(); };
    $('#save').onclick = (e) => busy(e.target, 'Salvando…', async () => { await save(); setState(`Salvo às ${fmtTime(savedAt)}`, true); toast('Salvo.'); if (r.status === 'revisado') renderReport(id); });
    const secs = $('#secs');
    secs.addEventListener('input', (e) => {
      const card = e.target.closest('.sec'); if (!card) return;
      sections[+card.dataset.i][e.target.dataset.f] = e.target.value;
      if (e.target.tagName === 'TEXTAREA') autosize(e.target);
      markDirty();
    });
    secs.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const i = +btn.closest('.sec').dataset.i, act = btn.dataset.act;
      if (act === 'up' && i > 0) [sections[i - 1], sections[i]] = [sections[i], sections[i - 1]];
      else if (act === 'down' && i < sections.length - 1) [sections[i + 1], sections[i]] = [sections[i], sections[i + 1]];
      else if (act === 'vis') sections[i].patient_visible = !visible(sections[i]);
      else if (act === 'rm') {
        if (!(await confirmBox(`Remover a seção “${sections[i].title}”?`, 'Remover'))) return;
        sections.splice(i, 1);
      } else if (act === 'ai') return rewrite(i);
      drawSheet(); markDirty();
    });
  };

  const rewrite = async (i) => {
    if (!ai.hasClaudeKey()) return toast('Cadastre a chave da Anthropic em Configurações.', 'err');
    let result = '';
    const s = sections[i];
    await openModal(`Reescrever “${s.title}” com IA`, `
      <label class="field">O que você quer mudar?
        <textarea id="ins" rows="3" placeholder="Ex.: mais objetivo; destacar a queixa de sono; incluir o combinado para a próxima semana."></textarea></label>
      <button type="button" class="btn quiet" id="run">${icon('sparkle')}Gerar nova versão</button>
      <label class="field" style="margin-top:14px">Nova versão (você pode editar)<textarea id="out" rows="6" placeholder="O resultado aparece aqui."></textarea></label>
      <p class="muted small">Ao confirmar, o texto atual da seção é substituído. A IA usa a transcrição e o texto atual.</p>`,
    {
      okText: 'Substituir texto da seção', wide: true,
      onOpen: (d) => {
        $('#run', d).onclick = (e) => busy(e.currentTarget, 'Gerando…', async () => {
          $('#out', d).value = await ai.rewriteSection({
            title: s.title, current: s.text, transcript: r.transcript,
            instruction: $('#ins', d).value, options: { detail: prefs.detail, instructions: prefs.instructions },
          });
        });
      },
      onOk: (d) => { result = $('#out', d).value.trim(); if (!result) throw new Error('Gere a nova versão antes de confirmar.'); },
    });
    if (result) { sections[i].text = result; drawSheet(); markDirty(); }
  };

  const drawTranscript = () => {
    $('#pane').innerHTML = `
      <div class="row" style="margin-bottom:10px"><input id="tq" type="search" placeholder="Buscar na transcrição" style="max-width:320px;margin:0" aria-label="Buscar na transcrição"><span class="muted small" id="tcount"></span></div>
      <div class="transcript" id="ttext"></div>
      <p class="muted small" style="margin-top:8px">Somente leitura. É o registro do que foi captado, para você conferir o que a IA escreveu.</p>`;
    const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const paint = () => {
      const q = $('#tq').value.trim(); const t = r.transcript || '';
      if (!q) { $('#ttext').textContent = t; $('#tcount').textContent = ''; return; }
      let n = 0;
      $('#ttext').innerHTML = esc(t).replace(new RegExp(reEsc(esc(q)), 'gi'), (m) => { n++; return `<mark>${m}</mark>`; });
      $('#tcount').textContent = `${n} ocorrência(s)`;
    };
    $('#tq').oninput = paint; paint();
  };
  const drawHistory = () => {
    $('#pane').innerHTML = audit.length ? `<div class="list">${audit.map((a) => `
      <div class="li"><span class="grow">${esc({ insert: 'Criado', update: 'Alterado', delete: 'Excluído' }[a.action] || a.action)}${a.detail?.status ? `, ${esc(a.detail.status)}` : ''}${a.detail?.released ? ', liberado ao paciente' : ''}</span><span class="muted small">${fmtDateTime(a.created_at)}</span></div>`).join('')}</div>`
      : '<div class="empty">Sem registros ainda.</div>';
  };
  const showTab = (t) => {
    tab = t;
    $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    if (t === 'relatorio') drawSheet(); else if (t === 'transcricao') drawTranscript(); else drawHistory();
  };
  $$('.tab').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
  showTab('relatorio');
  void tab;

  /* ---------- ações ---------- */
  const reload = () => renderReport(id);
  if ($('#review')) $('#review').onclick = async (e) => {
    if (!(await confirmBox('Confirmo que revisei o conteúdo e o conferi com o que foi dito na sessão.', 'Confirmar revisão'))) return;
    await busy(e.target, 'Salvando…', async () => { await save({ status: 'revisado' }); toast('Marcado como revisado.'); reload(); });
  };
  if ($('#reopen')) $('#reopen').onclick = (e) => busy(e.target, 'Salvando…', async () => {
    await save({ status: 'rascunho', released_to_patient: false, released_at: null }); toast('Relatório reaberto para edição.'); reload();
  });
  if ($('#release')) $('#release').onclick = async (e) => {
    const n = sections.filter(visible).length;
    if (!(await confirmBox(`Liberar para o paciente? Ele verá ${n} de ${sections.length} seção(ões) no portal. A transcrição nunca é exibida.`, 'Liberar'))) return;
    await busy(e.target, 'Salvando…', async () => { await save({ released_to_patient: true, released_at: new Date().toISOString() }); toast('Liberado ao paciente.'); reload(); });
  };
  if ($('#unrelease')) $('#unrelease').onclick = (e) => busy(e.target, 'Salvando…', async () => {
    await save({ released_to_patient: false, released_at: null }); toast('Retirado do portal.'); reload();
  });
  $('#preview').onclick = () => openModal('Como o paciente vê', `
    ${sections.filter(visible).map((s) => `<h3 style="margin-top:12px">${esc(s.title)}</h3><p class="pre">${esc(s.text)}</p>`).join('') || '<p class="muted">Nenhuma seção visível ao paciente.</p>'}
    ${sections.some((s) => !visible(s)) ? `<p class="muted small" style="margin-top:14px">Ocultas: ${sections.filter((s) => !visible(s)).map((s) => esc(s.title)).join(', ')}.</p>` : ''}`,
  { wide: true });

  const exportArgs = () => {
    const secs = $('#onlyvis').checked ? sections.filter(visible) : sections;
    return {
      report: { ...r, title: $('#title').value.trim() || r.title, session_date: $('#date')?.value || r.session_date },
      patientName: r.patients.name, professional: state.profile, sections: secs,
    };
  };
  $('#word').onclick = () => exportWord(exportArgs());
  $('#pdf').onclick = () => exportPdf(exportArgs());
  $('#del').onclick = async () => {
    if (!(await confirmBox('Excluir este relatório definitivamente?', 'Excluir'))) return;
    await api.deleteReport(id); window.__dirty = false; toast('Relatório excluído.'); goto(`#/pacientes/${r.patients.id}`);
  };
  $('#title').oninput = markDirty;
  if ($('#date')) $('#date').oninput = markDirty;
  document.onkeydown = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); $('#save')?.click(); } };
  window.__cleanup = () => { document.onkeydown = null; };
  window.__dirty = false;
}
