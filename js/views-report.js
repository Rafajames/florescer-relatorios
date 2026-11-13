import * as api from './api.js';
import * as ai from './ai.js';
import { exportWord, exportPdf, previewHtml } from './export.js';
import { state } from './state.js';
import { getPrefs } from './prefs.js';
import { brandOf } from './brand.js';
import { sanitize, textToHtml, toolbarHtml, runCmd } from './richtext.js';
import { KIND_LABEL } from './export.js';
import {
  $, $$, esc, fmtDate, fmtDateTime, fmtTime, toast, openModal, confirmBox, busy, autosize, debounce, wordCount,
  chip, statusChip, meta, callout, shell, loading, backLink, icon,
  celebrar,
} from './ui.js';

const goto = (h) => { location.hash = h; };
const clone = (x) => JSON.parse(JSON.stringify(x));
const visible = (s) => s.patient_visible !== false;

export async function renderReport(id) {
  const main = shell('relatorios'); loading(main);
  const [r, audit, versions, tplList] = await Promise.all([api.getReport(id), api.listAudit(id), api.listVersions(id).catch(() => []), api.listTemplates().catch(() => [])]);
  // timbre do documento enviado como modelo (logo, marca d'água, cabeçalho e rodapé), se o modelo tiver
  const tplLayout = ((tplList.find((t) => t.id === r.template_id) || {}).meta || {}).layout;
  const layout = tplLayout && tplLayout.use !== false ? tplLayout : null;
  const prefs = getPrefs();
  const sections = clone(r.sections || []);
  let dirty = false, tab = 'relatorio', savedAt = null, confirmedLive = false;
  const reviewed = r.status === 'revisado';
  const canRelease = reviewed && r.patients?.email;
  const pro = state.profile;
  const reg = [pro.specialty, pro.council_registry].filter(Boolean).join(', ');
  const brand = brandOf(pro);

  let queue = [];
  try { queue = JSON.parse(sessionStorage.getItem('florescer.queue') || '[]'); } catch { queue = []; }
  const qi = queue.indexOf(id), nextId = qi >= 0 ? queue[qi + 1] : null;
  const queueBar = qi >= 0 && queue.length > 1 ? `<div class="callout">${icon('info')}<div class="grow"><p>Editando ${qi + 1} de ${queue.length} relatórios selecionados.</p></div>${nextId ? `<a class="btn sm" href="#/relatorio/${nextId}">Próximo →</a>` : '<a class="btn sm quiet" href="#/relatorios">Voltar à lista</a>'}</div>` : '';
  main.innerHTML = backLink(`#/pacientes/${r.patients.id}`, r.patients.name) + queueBar + `
    <div class="editor">
      <div>
        <input id="title" class="title-input" value="${esc(r.title)}" aria-label="Título do relatório">
        ${meta([
          r.kind === 'periodo' ? `Período ${fmtDate(r.period_start)} a ${fmtDate(r.period_end)}` : `<input type="date" id="date" class="inline-date" value="${esc(r.session_date)}" aria-label="Data">`,
          chip(KIND_LABEL[r.kind] || 'Registro', 'petrol'), statusChip(r), r.ai_generated ? chip('Esboço com IA', 'bloom') : '',
          `<span id="wc"></span>`,
          r.transcript || r.notes ? `<button type="button" class="link" id="side-toggle" aria-pressed="false">Ver transcrição ao lado</button>` : '',
        ])}
        ${r.released_to_patient ? '<div style="height:14px"></div>' + callout('<p>Este relatório está <b>liberado ao paciente</b>. Você pode editar a qualquer momento: ao salvar, o paciente passa a ver a versão nova. As versões anteriores ficam no Histórico.</p>') : reviewed ? '<div style="height:14px"></div>' + callout('<p>Este relatório já foi revisado. Você pode continuar editando; use <b>Salvar agora</b> para gravar as mudanças.</p>') : ''}
        ${r.ai_generated && !reviewed ? '<div style="height:14px"></div>' + callout('<p>Este texto foi gerado com apoio de IA e pode conter erros. Confira com a transcrição e edite antes de marcar como revisado.</p>', 'warn') : ''}
        <div class="tabs" role="tablist">
          <button class="tab on" data-tab="relatorio" role="tab">Relatório</button>
          ${r.transcript || r.notes ? '<button class="tab" data-tab="transcricao" role="tab">Transcrição e anotações</button>' : ''}
          <button class="tab" data-tab="historico" role="tab">Histórico e versões</button>
        </div>
        <div id="split"><div id="pane"></div><aside class="side-ts hide" id="side" aria-label="Transcrição ao lado"></aside></div>
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
            ${reviewed ? `<button class="btn quiet" id="reopen">${icon('edit')}Voltar para rascunho</button>` : ''}
          </div>
          ${reviewed && !r.patients?.email ? '<p class="small muted" style="margin-top:8px">Cadastre o e-mail do paciente para poder liberar.</p>' : ''}
          <div class="save-state" id="savestate"></div>
        </div>
        ${r.kind === 'anamnese' ? `<div class="panel">
          <h3>Cadastro do paciente</h3>
          <p class="small muted">Leva nascimento, responsáveis e diagnóstico desta anamnese para a ficha do paciente. Você confere antes.</p>
          <button class="btn quiet" id="to-cad">${icon('users')}Atualizar cadastro</button>
        </div>` : ''}
        ${r.kind === 'sessao' ? '<div class="panel" id="pl-metas-sessao"></div>' : ''}
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
    setState(r.status === 'rascunho' && prefs.autosave ? 'Alterações pendentes…' : 'Alterações não salvas. Use Salvar agora.');
    autosave();
  };

  /* ---------- painéis ---------- */
  const collapse = window.matchMedia && window.matchMedia('(max-width:760px)').matches;
  let openSec = 0;
  const sheet = () => `
    <article class="sheet ${r.kind === 'documento' ? 'doc-free' : ''}">
      <div class="sheet-head">${brand.logo ? `<img class="sheet-logo" src="${esc(brand.logo)}" alt="">` : ''}<div><b>${esc(brand.org_name || pro.clinic_name || pro.full_name || '')}</b><span>${esc(pro.full_name || '')}${reg ? ', ' + esc(reg) : ''}</span></div></div>
      <div class="sheet-meta"><b>${esc(r.patients.name)}</b>${r.kind === 'periodo' ? `, período ${fmtDate(r.period_start)} a ${fmtDate(r.period_end)}` : `, ${fmtDate($('#date')?.value || r.session_date)}`}</div>
      <div id="secs">${sections.map((s, i) => secHtml(s, i)).join('')}</div>
      <div class="sheet-foot">${r.ai_generated ? 'Elaborado com apoio de ferramenta de inteligência artificial e revisado pelo(a) profissional responsável. ' : ''}Documento confidencial, com dados sensíveis de saúde (LGPD).</div>
    </article>
    <div class="row add-sec"><button class="btn quiet sm" id="add-sec" ${r.kind === 'documento' ? 'hidden' : ''}>${icon('plus')}Adicionar campo</button>
      <button class="btn quiet sm" id="save">Salvar agora</button></div>`;

  const secHtml = (s, i) => `
    <div class="sec ${collapse && i !== openSec ? 'collapsed' : ''}" data-i="${i}">
      <div class="sec-side">
        <button type="button" class="icon-btn sec-toggle" data-act="open" aria-label="Abrir ou fechar esta seção">${icon('down')}</button>
        <input class="sec-title" data-f="title" value="${esc(s.title)}" aria-label="Título da seção">
        <div class="sec-tools">
          <button class="icon-btn" data-act="up" title="Subir seção" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
          <button class="icon-btn" data-act="down" title="Descer seção" ${i === sections.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
          <button class="icon-btn ${visible(s) ? '' : 'off'}" data-act="vis" title="${visible(s) ? 'Visível ao paciente (clique para ocultar)' : 'Oculta ao paciente (clique para mostrar)'}">${icon(visible(s) ? 'eye' : 'eyeoff')}</button>
          ${r.kind !== 'periodo' && ai.hasTextAI() && (!s.type || s.type === 'longo' || s.type === 'curto') ? `<button class="icon-btn" data-act="ai" title="Reescrever esta seção com IA">${icon('sparkle')}</button>` : ''}
          <button class="icon-btn" data-act="rm" title="Remover seção">${icon('trash')}</button>
        </div>
        ${visible(s) ? '' : '<span class="chip bloom sec-hidden">Oculta ao paciente</span>'}
      </div>
      ${fieldHtml(s)}
    </div>`;

  const fieldHtml = (s) => {
    const label = `aria-label="Texto de ${esc(s.title)}"`;
    if (s.type === 'marcar') return `<select data-f="text" class="fld" ${label}>${['', 'Sim', 'Não', 'Não abordado.'].map((o) => `<option ${o === (s.text || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    if (s.type === 'escolha') { const opts = ['', ...(s.options || [])]; if (s.text && !opts.includes(s.text)) opts.push(s.text); return `<select data-f="text" class="fld" ${label}>${opts.map((o) => `<option ${o === (s.text || '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; }
    if (s.type === 'curto' || s.type === 'data') return `<input data-f="text" class="fld" ${label} value="${esc(s.text)}" ${s.type === 'data' ? 'placeholder="DD/MM/AAAA"' : ''}>`;
    return `<div class="rt-wrap">${toolbarHtml()}<div class="rt fld" contenteditable="true" role="textbox" aria-multiline="true" data-f="html" data-empty="${!(s.text || '').trim()}" ${label}>${s.html ? sanitize(s.html) : textToHtml(s.text)}</div></div>`;
  };

  const drawSheet = () => {
    $('#pane').innerHTML = sheet();
    $$('#pane textarea').forEach(autosize);
    updateWc();
    $('#add-sec').onclick = () => { sections.push({ title: 'Novo campo', text: '', patient_visible: prefs.sectionsVisibleToPatient }); drawSheet(); markDirty(); };
    $('#save').onclick = async (e) => {
      const btn = e.currentTarget;
      if (r.released_to_patient && dirty && !confirmedLive) {
        if (!(await confirmBox('Este relatório está liberado. Ao salvar, o paciente passa a ver a versão nova. Salvar mesmo assim?', 'Salvar'))) return;
        confirmedLive = true;
      }
      await busy(btn, 'Salvando…', async () => { await save(); setState(`Salvo às ${fmtTime(savedAt)}`, true); toast('Salvo.'); });
    };
    const secs = $('#secs');
    secs.addEventListener('input', (e) => {
      const card = e.target.closest('.sec'); if (!card) return;
      if (e.target.dataset.f === 'html') { const sec = sections[+card.dataset.i]; sec.html = sanitize(e.target.innerHTML); sec.text = e.target.innerText.trim(); e.target.dataset.empty = String(!sec.text); markDirty(); return; }
      sections[+card.dataset.i][e.target.dataset.f] = e.target.value;
      if (e.target.tagName === 'TEXTAREA') autosize(e.target);
      markDirty();
    });
    secs.addEventListener('change', (e) => {
      const card = e.target.closest('.sec'); if (!card || e.target.tagName !== 'SELECT') return;
      sections[+card.dataset.i][e.target.dataset.f] = e.target.value; markDirty();
    });
    secs.addEventListener('mousedown', (e) => { if (e.target.closest('.rt-b')) e.preventDefault(); });
    secs.addEventListener('paste', (e) => { if (!e.target.closest('.rt')) return; e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
    secs.addEventListener('click', async (e) => {
      const rb = e.target.closest('.rt-b'); if (rb) { runCmd(rb.dataset.cmd); const ed = rb.closest('.rt-wrap').querySelector('.rt'); ed.dispatchEvent(new Event('input', { bubbles: true })); return; }
      const btn = e.target.closest('[data-act]'); if (!btn) return;
      const i = +btn.closest('.sec').dataset.i, act = btn.dataset.act;
      if (act === 'open') {
        const card = btn.closest('.sec'); const wasClosed = card.classList.contains('collapsed');
        $$('.sec', secs).forEach((c) => c.classList.toggle('collapsed', collapse));
        card.classList.toggle('collapsed', !wasClosed && collapse); openSec = i;
        $$('textarea', card).forEach(autosize); return;
      }
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
    if (!ai.hasTextAI()) return toast(ai.noAIMessage, 'err');
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
    if (result) { sections[i].text = result; delete sections[i].html; drawSheet(); markDirty(); }
  };

  const drawTranscript = () => {
    $('#pane').innerHTML = `
      <div class="row" style="margin-bottom:10px"><input id="tq" type="search" placeholder="Buscar na transcrição" style="max-width:320px;margin:0" aria-label="Buscar na transcrição"><span class="muted small" id="tcount"></span></div>
      ${r.notes ? `<h3 style="margin-bottom:6px">Anotações da sessão</h3><div class="transcript" style="max-height:none;margin-bottom:16px">${esc(r.notes)}</div>` : ''}
      <h3 style="margin-bottom:6px">Transcrição</h3>
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
    const ev = audit.length ? `<div class="list">${audit.map((a) => `
      <div class="li"><span class="grow">${esc({ insert: 'Criado', update: 'Alterado', delete: 'Excluído' }[a.action] || a.action)}${a.detail?.status ? `, ${esc(a.detail.status)}` : ''}${a.detail?.released ? ', liberado ao paciente' : ''}</span><span class="muted small">${fmtDateTime(a.created_at)}</span></div>`).join('')}</div>`
      : '<p class="muted">Sem registros ainda.</p>';
    const ver = versions.length ? `<div class="list">${versions.map((v) => `
      <div class="li"><span class="grow"><span class="t">Versão de ${fmtDateTime(v.saved_at)}</span><br><span class="muted small">${esc(v.title || '')}, ${wordCount((v.sections || []).map((x) => x.text).join(' '))} palavras</span></span>
      <button class="btn quiet sm" data-view="${v.id}">Ver</button><button class="btn quiet sm" data-restore="${v.id}">Restaurar</button></div>`).join('')}</div>
      <p class="muted small" style="margin-top:8px">Restaurar traz o texto da versão para o editor. Ele só vale depois de você salvar.</p>`
      : '<p class="muted">As versões anteriores aparecem aqui depois das primeiras alterações.</p>';
    $('#pane').innerHTML = `<h3 style="margin-bottom:8px">Versões anteriores</h3>${ver}<h3 style="margin:22px 0 8px">Atividade</h3>${ev}`;
    $$('[data-view]').forEach((bt) => (bt.onclick = () => {
      const v = versions.find((x) => String(x.id) === bt.dataset.view);
      openModal(`Versão de ${fmtDateTime(v.saved_at)}`, (v.sections || []).map((x) => `<h3 style="margin-top:12px">${esc(x.title)}</h3><p class="pre">${esc(x.text)}</p>`).join(''), { wide: true });
    }));
    $$('[data-restore]').forEach((bt) => (bt.onclick = async () => {
      const v = versions.find((x) => String(x.id) === bt.dataset.restore);
      if (!(await confirmBox('Trazer o texto desta versão para o editor? O texto atual será substituído até você salvar.', 'Restaurar'))) return;
      sections.splice(0, sections.length, ...clone(v.sections || []));
      showTab('relatorio'); markDirty(); toast('Versão trazida para o editor. Salve para confirmar.');
    }));
  };
  const showTab = (t) => {
    tab = t;
    $$('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    if (t === 'relatorio') drawSheet(); else if (t === 'transcricao') drawTranscript(); else drawHistory();
  };
  $$('.tab').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
  const st = $('#side-toggle');
  if (st) st.onclick = () => {
    const side = $('#side'); const on = side.classList.contains('hide');
    side.classList.toggle('hide', !on); $('#split').classList.toggle('on', on);
    st.setAttribute('aria-pressed', String(on)); st.textContent = on ? 'Esconder transcrição' : 'Ver transcrição ao lado';
    if (on) { side.innerHTML = `<div class="panel"><h3 style="margin-bottom:8px">Transcrição e anotações</h3>${r.notes ? `<p class="muted small">Anotações</p><div class="transcript" style="margin-bottom:12px">${esc(r.notes)}</div>` : ''}<div class="transcript">${esc(r.transcript || '')}</div></div>`; }
  };
  showTab('relatorio');
  void tab;

  /* ---------- ações ---------- */
  const reload = () => renderReport(id);
  if ($('#review')) $('#review').onclick = async (e) => {
    if (!(await confirmBox('Confirmo que revisei o conteúdo e o conferi com o que foi dito na sessão.', 'Confirmar revisão'))) return;
    await busy(e.target, 'Salvando…', async () => { await save({ status: 'revisado' }); toast('Marcado como revisado.'); reload(); });
  };
  if ($('#reopen')) $('#reopen').onclick = (e) => busy(e.target, 'Salvando…', async () => {
    await save({ status: 'rascunho', released_to_patient: false, released_at: null }); toast('Relatório voltou para rascunho.'); reload();
  });
  if ($('#release')) $('#release').onclick = async (e) => {
    const n = sections.filter(visible).length;
    if (!(await confirmBox(`Liberar para o paciente? Ele verá ${n} de ${sections.length} seção(ões) no portal. A transcrição nunca é exibida.`, 'Liberar'))) return;
    await busy(e.target, 'Salvando…', async () => { await save({ released_to_patient: true, released_at: new Date().toISOString() }); celebrar('liberado', 'Primeiro relatório liberado ao paciente!'); toast('Liberado ao paciente.'); reload(); });
  };
  if ($('#unrelease')) $('#unrelease').onclick = (e) => busy(e.target, 'Salvando…', async () => {
    await save({ released_to_patient: false, released_at: null }); toast('Retirado do portal.'); reload();
  });
  // prévia editável: o texto muda o relatório ao aplicar; para gravar, use Salvar agora
  const pvField = (s) => (['marcar', 'escolha', 'curto', 'data'].includes(s.type)
    ? fieldHtml(s)
    : `<div class="rt fld" contenteditable="true" data-f="html" aria-label="Texto de ${esc(s.title)}">${s.html ? sanitize(s.html) : textToHtml(s.text)}</div>`);
  $('#preview').onclick = () => openModal('Como o paciente vê', `
    <p class="muted small">Você pode editar o texto aqui. Ao aplicar, as mudanças entram no relatório e passam a valer quando você salvar.</p>
    ${sections.map((s, i) => [s, i]).filter(([s]) => visible(s)).map(([s, i]) => `<div class="pv-sec" data-i="${i}" style="margin-top:12px"><label class="small muted">${esc(s.title)}</label>${pvField(s)}</div>`).join('') || '<p class="muted">Nenhuma seção visível ao paciente.</p>'}
    ${sections.some((s) => !visible(s)) ? `<p class="muted small" style="margin-top:14px">Ocultas: ${sections.filter((s) => !visible(s)).map((s) => esc(s.title)).join(', ')}.</p>` : ''}`,
  { wide: true, okText: 'Aplicar alterações', onOk: (d) => {
    $$('.pv-sec', d).forEach((box) => {
      const s = sections[+box.dataset.i]; const el = box.querySelector('[data-f]');
      if (!s || !el) return;
      if (el.dataset.f === 'html') { s.html = sanitize(el.innerHTML); s.text = el.innerText.trim(); }
      else s[el.dataset.f] = el.value;
    });
    showTab('relatorio'); markDirty(); toast('Alterações aplicadas. Clique em Salvar agora para gravar.');
  } });

  const exportArgs = () => {
    const secs = $('#onlyvis').checked ? sections.filter(visible) : sections;
    return {
      report: { ...r, title: $('#title').value.trim() || r.title, session_date: $('#date')?.value || r.session_date },
      patientName: r.patients.name, professional: state.profile, sections: secs, layout,
    };
  };
  if ($('#pl-metas-sessao')) import('./views-clinico.js').then((m) => m.metasDaSessao($('#pl-metas-sessao'), r)).catch(() => { const el = $('#pl-metas-sessao'); if (el) el.remove(); });
  if ($('#to-cad')) $('#to-cad').onclick = async () => {
    const txt = (re) => { const sec = sections.find((x) => re.test(x.title || '')); return sec ? String(sec.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''; };
    const dm = txt(/nascimento/i).match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const nasc = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : '';
    const resp = txt(/pais|respons[áa]ve|m[ãa]e/i), diag = txt(/diagn[óo]stico/i);
    const achados = [nasc && ['nasc', 'Data de nascimento', `${dm[1]}/${dm[2]}/${dm[3]}`], resp && ['resp', 'Responsáveis', resp], diag && ['diag', 'Diagnóstico (vai para as Observações)', diag]].filter(Boolean);
    if (!achados.length) return toast('Não encontrei nascimento, responsáveis nem diagnóstico preenchidos nesta anamnese.', 'err');
    const pick = await openModal('Atualizar cadastro do paciente', `<p>Marque o que deve ir para a ficha de <b>${esc(r.patients.name)}</b>. O que já estiver lá é substituído.</p>
      ${achados.map(([k, l, v]) => `<label class="check" style="align-items:flex-start;margin-bottom:8px"><input type="checkbox" name="${k}" checked><span><b>${l}:</b> ${esc(v)}</span></label>`).join('')}`,
    { okText: 'Atualizar cadastro', onOk: (d) => Object.fromEntries(achados.map(([k]) => [k, d.querySelector(`[name=${k}]`).checked])) });
    if (!pick || pick === true) return;
    try {
      const pid = r.patients.id;
      if (pick.nasc || pick.diag) {
        const atual = await api.getPatient(pid);
        const linha = `Diagnóstico: ${diag}`;
        const notes = pick.diag && !String(atual.notes || '').includes(linha) ? [atual.notes, linha].filter(Boolean).join('\n') : atual.notes;
        await api.savePatient({ id: pid, ...(pick.nasc ? { birth_date: nasc } : {}), notes: notes || null });
      }
      if (pick.resp) await api.savePatientAdmin({ patient_id: pid, guardian: resp.slice(0, 200) });
      toast('Cadastro do paciente atualizado.');
    } catch (err) { toast(err.message || String(err), 'err'); }
  };
  $('#word').onclick = () => exportWord(exportArgs());
  $('#pdf').onclick = () => {
    const args = exportArgs();
    openModal('Prévia do PDF', `<iframe class="pdf-prev" title="Prévia do documento" srcdoc="${esc(previewHtml(args))}"></iframe>
      <p class="muted small">É assim que o documento sai. Em “Imprimir ou salvar”, escolha “Salvar como PDF” no destino.</p>`,
    { okText: 'Imprimir ou salvar PDF', wide: true, onOk: () => { exportPdf(args); return true; } });
  };
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
