// Editor de modelo em formato de documento (como um Word): os campos aparecem em sequência,
// numa página só. O profissional rola, edita o título, a orientação e o tipo de cada campo.
import * as api from './api.js';
import { state, SPECIALTIES } from './state.js';
import { $, $$, esc, toast, confirmBox, shell, loading, icon, callout, backLink, acoesModal } from './ui.js';
import { getPrefs } from './prefs.js';

const TYPES = [['longo', 'Texto longo'], ['curto', 'Texto curto'], ['data', 'Data'], ['marcar', 'Sim ou não'], ['escolha', 'Escolha']];
const KINDS = { sessao: 'Evolução', anamnese: 'Anamnese', periodo: 'Período' };

// Rascunho vindo de outra tela (duplicar ou importar), usado na próxima abertura de "novo".
let draft = null;
export const setTemplateDraft = (d) => { draft = d; };

const blank = () => ({ title: '', hint: '', type: 'longo' });

/** Pré-visualização do campo, como ficaria no documento impresso. */
function preview(r) {
  if (r.type === 'data') return '<span class="tpl-blank tpl-blank-short">__/__/____</span>';
  if (r.type === 'curto') return '<span class="tpl-blank"></span>';
  if (r.type === 'marcar') return '☐ Sim &nbsp;&nbsp; ☐ Não &nbsp;&nbsp; ☐ Não abordado';
  if (r.type === 'escolha') {
    const opts = r.options || [];
    return opts.length ? opts.map((o) => `☐ ${esc(o)}`).join(' &nbsp;&nbsp; ') : '<span class="muted">Liste as opções acima</span>';
  }
  return '<span class="tpl-blank"></span>'.repeat(Math.min(Math.max(+r.lines || 2, 1), 12));
}

export async function renderTemplateEditor(id) {
  const main = shell('modelos'); loading(main);
  let t, guia = false;
  if (id === 'novo') {
    t = draft ? { ...draft } : { name: '', specialty: state.profile.specialty || 'Geral', kind: 'sessao', sections: [] };
    draft = null;
  } else {
    const found = (await api.listTemplates()).find((x) => x.id === id);
    if (!found) {
      main.innerHTML = callout('<p>Modelo não encontrado.</p>', 'warn') + `<p><a class="btn quiet" href="#/modelos">Voltar aos modelos</a></p>`;
      return;
    }
    // Modelo da Potira é só um guia: abre no editor e, ao salvar, vira um modelo do profissional. O original não muda.
    if (!found.professional_id) { guia = true; t = { name: found.name, specialty: found.specialty, kind: found.kind, sections: found.sections, meta: {} }; }
    else t = { ...found };
  }
  const rows = (t.sections || []).map((s) => ({ type: 'longo', ...s }));
  if (!rows.length) rows.push(blank());
  const isNew = !t.id;
  const lay = t.meta?.layout ? { ...t.meta.layout } : null;
  const prefs0 = getPrefs();
  const ehPadrao = isNew ? Boolean(t.meta?.source) : [prefs0.defaultTemplateId, prefs0.defaultAnamneseTemplateId].includes(t.id);
  const areas = ['Geral', ...SPECIALTIES];
  const areaOpts = areas.map((s) => `<option ${s === (t.specialty || '') ? 'selected' : ''}>${esc(s)}</option>`).join('');

  main.innerHTML = `
    <div class="row" style="margin-bottom:10px">${backLink('#/modelos', 'Modelos')}<span class="grow"></span>
      <button class="btn quiet" id="tpl-cancel">Cancelar</button>${isNew ? '' : `<button class="btn quiet" id="tpl-copy">${icon('plus')}Salvar como cópia</button>`}<button class="btn" id="tpl-save">${icon('check')}Salvar modelo</button></div>
    ${guia ? callout('<p>Este é um modelo da Potira, para servir de guia. Edite à vontade: ao salvar, ele vira um modelo <b>seu</b> e o original continua igual.</p>', 'ok') : ''}
    ${t.meta?.source ? callout(`<p>Importado de <b>${esc(t.meta.source)}</b>${t.meta.ai ? ' com ajuda da IA' : ''}. Confira os campos e acrescente o que faltar.${t.meta.noLayout ? ' A logo, a marca d’água, o cabeçalho e o rodapé só são lidos de arquivos Word (.docx).' : ''}</p>`, 'ok') : ''}
    ${lay ? `<section class="panel tpl-lay"><h2>Timbre do seu documento</h2>
      <p class="muted small">Lido do arquivo enviado. Os documentos feitos com este modelo saem com esta logo, marca d’água, cabeçalho e rodapé, no lugar do timbre das Configurações.</p>
      <label class="check"><input type="checkbox" id="lay-use" ${lay.use !== false ? 'checked' : ''}> Usar este timbre nos documentos deste modelo</label>
      <div class="lay-imgs">
        ${lay.logo ? `<figure data-img="logo"><img src="${lay.logo}" alt="Logo lida do documento"><figcaption>Logo <button type="button" class="link" data-layrm="logo">Remover</button></figcaption></figure>` : ''}
        ${lay.watermark?.image ? `<figure data-img="watermark"><img src="${lay.watermark.image}" alt="Marca d’água lida do documento"><figcaption>Marca d’água <button type="button" class="link" data-layrm="watermark">Remover</button></figcaption></figure>` : ''}
      </div>
      ${lay.watermark?.text ? `<label class="field">Marca d’água (texto)<input id="lay-wm" value="${esc(lay.watermark.text)}"></label>` : ''}
      <label class="field">Cabeçalho<textarea id="lay-h" rows="3" placeholder="Sem texto de cabeçalho no documento">${esc(lay.header || '')}</textarea><small>A primeira linha sai em destaque.</small></label>
      <label class="field">Rodapé<textarea id="lay-f" rows="3" placeholder="Sem texto de rodapé no documento">${esc(lay.footer || '')}</textarea></label>
    </section>` : ''}
    <div class="sheet tpl-sheet">
      <input id="tpl-name" class="tpl-name" placeholder="Nome do modelo" value="${esc(t.name || '')}" aria-label="Nome do modelo">
      <div class="tpl-meta">
        <label>Área <select id="tpl-area">${areaOpts}</select></label>
        <label>Usar para <select id="tpl-kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}" ${(t.kind || 'sessao') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="check" id="tpl-def-wrap"><input type="checkbox" id="tpl-def" ${ehPadrao ? 'checked' : ''}> Usar como modelo padrão</label>
      </div>
      <p class="muted small tpl-help">Este é o documento. Cada campo é uma linha dele: escreva o título, e se quiser, uma orientação para a IA. Passe o mouse sobre um campo para subir, descer ou remover. Dê Enter no título para criar o campo seguinte.</p>
      <div id="tpl-doc"></div>
      <button type="button" class="tpl-add" id="tpl-add">${icon('plus')}Adicionar campo</button>
    </div>`;

  const doc = $('#tpl-doc');
  const draw = () => {
    doc.innerHTML = rows.map((r, i) => `
      <div class="tpl-f" data-i="${i}">
        <div class="tpl-f-head">
          <input class="tpl-f-title" data-f="title" value="${esc(r.title)}" placeholder="Título do campo" aria-label="Título do campo ${i + 1}">
          <select class="tpl-f-type" data-f="type" aria-label="Tipo do campo">${TYPES.map(([v, l]) => `<option value="${v}" ${(r.type || 'longo') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </div>
        <textarea class="tpl-f-hint" data-f="hint" rows="1" placeholder="Orientação para a IA (opcional)" aria-label="Orientação">${esc(r.hint || '')}</textarea>
        ${r.type === 'escolha' ? `<input class="tpl-f-opts" data-f="options" value="${esc((r.options || []).join(', '))}" placeholder="Opções separadas por vírgula" aria-label="Opções">` : ''}
        <div class="tpl-f-preview">${preview(r)}</div>
        ${(r.type || 'longo') === 'longo' ? `<div class="tpl-f-lines"><span class="muted small">Linhas para escrever: ${Math.min(Math.max(+r.lines || 2, 1), 12)}</span>
          <button type="button" class="btn quiet sm" data-a="less" ${(+r.lines || 2) <= 1 ? 'disabled' : ''}>− linha</button><button type="button" class="btn quiet sm" data-a="more" ${(+r.lines || 2) >= 12 ? 'disabled' : ''}>${icon('plus')}linha</button></div>` : ''}
        <div class="tpl-f-tools">
          <button type="button" class="icon-btn" data-a="up" title="Subir" aria-label="Subir campo" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
          <button type="button" class="icon-btn" data-a="down" title="Descer" aria-label="Descer campo" ${i === rows.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
          <button type="button" class="icon-btn" data-a="rm" title="Remover campo" aria-label="Remover campo">${icon('trash')}</button>
        </div>
      </div>`).join('');
  };
  const grow = (el) => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  const growAll = () => doc.querySelectorAll('.tpl-f-hint').forEach(grow);
  draw(); growAll();

  // Edição sem redesenhar (para não perder o foco ao digitar)
  doc.addEventListener('input', (e) => {
    const el = e.target, f = el.dataset.f; if (!f) return;
    const r = rows[+el.closest('.tpl-f').dataset.i];
    if (f === 'options') r.options = el.value.split(',').map((x) => x.trim()).filter(Boolean);
    else r[f] = el.value;
    if (f === 'hint') grow(el);
    if (f === 'options') { el.closest('.tpl-f').querySelector('.tpl-f-preview').innerHTML = preview(r); }
  });
  doc.addEventListener('change', (e) => {
    if (e.target.dataset.f === 'type') { rows[+e.target.closest('.tpl-f').dataset.i].type = e.target.value; draw(); growAll(); }
  });
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset.f === 'title') {
      e.preventDefault();
      const i = +e.target.closest('.tpl-f').dataset.i;
      rows.splice(i + 1, 0, blank()); draw(); growAll();
      doc.querySelectorAll('.tpl-f-title')[i + 1]?.focus();
    }
  });
  doc.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const i = +b.closest('.tpl-f').dataset.i;
    if (b.dataset.a === 'up' && i > 0) [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
    if (b.dataset.a === 'down' && i < rows.length - 1) [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]];
    if (b.dataset.a === 'more' || b.dataset.a === 'less') {
      const r = rows[i], n = Math.min(Math.max(+r.lines || 2, 1), 12);
      r.lines = Math.min(Math.max(n + (b.dataset.a === 'more' ? 1 : -1), 1), 12);
    }
    if (b.dataset.a === 'rm') {
      const r = rows[i];
      if ((r.title || '').trim() && !(await confirmBox(`Remover o campo “${r.title.trim()}”?`, 'Remover'))) return;
      rows.splice(i, 1);
      if (!rows.length) rows.push(blank());
    }
    draw(); growAll();
  });

  $('#tpl-add').onclick = () => { rows.push(blank()); draw(); growAll(); doc.querySelectorAll('.tpl-f-title').item(rows.length - 1)?.focus(); };
  $('#tpl-cancel').onclick = () => { location.hash = '#/modelos'; };
  // o padrão vale para evolução e anamnese; relatório por período não tem modelo padrão
  const syncDef = () => { $('#tpl-def-wrap').style.display = $('#tpl-kind').value === 'periodo' ? 'none' : ''; };
  $('#tpl-kind').addEventListener('change', syncDef); syncDef();
  $$('[data-layrm]').forEach((b) => (b.onclick = () => { lay[b.dataset.layrm] = null; b.closest('figure').remove(); }));
  const salvar = (asCopy) => async (e) => {
    let name = $('#tpl-name').value.trim();
    if (asCopy && name === (t.name || '').trim()) name += ' (cópia)';
    const sections = rows.map((r) => ({
      title: (r.title || '').trim(), hint: (r.hint || '').trim(), type: r.type || 'longo',
      ...(r.type === 'escolha' && r.options?.length ? { options: r.options } : {}),
      ...((r.type || 'longo') === 'longo' && +r.lines > 0 && +r.lines !== 2 ? { lines: Math.min(+r.lines, 12) } : {}),
    })).filter((r) => r.title);
    if (!name) return toast('Dê um nome ao modelo.', 'err');
    if (!sections.length) return toast('Informe ao menos um campo com título.', 'err');
    const btn = e.currentTarget; btn.disabled = true;
    try {
      const meta = { ...(t.meta || {}) };
      if (lay) {
        const wmText = $('#lay-wm') ? $('#lay-wm').value.trim() : '';
        meta.layout = { ...lay, use: $('#lay-use').checked, header: $('#lay-h').value.trim(), footer: $('#lay-f').value.trim(),
          watermark: lay.watermark?.image ? lay.watermark : (wmText ? { text: wmText } : null) };
      }
      const kind = $('#tpl-kind').value;
      const saved = await api.saveTemplate({
        ...(isNew || asCopy ? {} : { id: t.id }),
        name, specialty: $('#tpl-area').value, kind, sections, meta,
      });
      // modelo padrão: marca (ou desmarca) nas preferências do profissional
      const key = kind === 'sessao' ? 'defaultTemplateId' : kind === 'anamnese' ? 'defaultAnamneseTemplateId' : null;
      const prefs = getPrefs();
      const patch = {};
      if (key && $('#tpl-def').checked) patch[key] = saved.id;
      ['defaultTemplateId', 'defaultAnamneseTemplateId'].forEach((k) => { if (prefs[k] === saved.id && !(k === key && $('#tpl-def').checked)) patch[k] = ''; });
      if (Object.keys(patch).some((k) => patch[k] !== prefs[k])) {
        const row = await api.updateProfile(state.profile.id, { preferences: { ...prefs, ...patch } });
        state.profile = { ...state.profile, preferences: row.preferences };
      }
      toast(key && $('#tpl-def').checked ? 'Modelo salvo e definido como padrão.' : 'Modelo salvo.');
      const antes = location.hash;
      await depoisDeSalvar(saved);
      if (location.hash === antes) location.hash = '#/modelos';
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  };
  $('#tpl-save').onclick = salvar(false);
  if ($('#tpl-copy')) $('#tpl-copy').onclick = salvar(true);
}

/** Depois de salvar o modelo: o que fazer com ele agora. */
async function depoisDeSalvar(t) {
  const timbre = () => document.querySelector('#ds-timbre')?.checked || false;
  const exp = () => import('./export.js');
  await acoesModal('Modelo salvo. O que fazer agora?', `<p class="muted small">“${esc(t.name)}” está em Modelos de documento, no grupo ${t.kind === 'anamnese' ? 'Anamnese' : t.kind === 'periodo' ? 'Relatório por período' : 'Evolução'}, com a etiqueta “Meu”.</p>
    <label class="check small"><input type="checkbox" id="ds-timbre"> Com a minha logo e marca d’água (sem marcar, sai em branco)</label>`, [
    t.kind === 'anamnese' && { icon: 'users', label: 'Enviar para um paciente preencher', sub: 'Escolha o paciente e mande o link pelo WhatsApp',
      run: async () => { const m = await import('./views-home.js'); await m.enviarModeloParaPreencher(t.id); return true; } },
    (t.kind === 'anamnese' || t.kind === 'sessao') && { icon: 'mic', label: 'Usar agora com um paciente', sub: 'Abre um registro novo já com este modelo',
      run: () => { location.hash = `#/nova?tipo=${t.kind}&modelo=${t.id}`; return new Promise((r) => setTimeout(() => r(true), 0)); } },
    { icon: 'download', label: 'Baixar em PDF (em branco)', sub: 'Para imprimir e preencher à mão', run: async () => { (await exp()).exportModeloPdf({ template: t, professional: state.profile, timbre: timbre() }); return false; } },
    { icon: 'download', label: 'Baixar em Word (para editar)', run: async () => { (await exp()).exportModeloWord({ template: t, professional: state.profile, timbre: timbre() }); return false; } },
  ]);
}
