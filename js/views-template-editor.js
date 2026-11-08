// Editor de modelo em formato de documento (como um Word): os campos aparecem em sequência,
// numa página só. O profissional rola, edita o título, a orientação e o tipo de cada campo.
import * as api from './api.js';
import { state, SPECIALTIES } from './state.js';
import { $, $$, esc, toast, confirmBox, shell, loading, icon, callout, backLink } from './ui.js';

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
  return '<span class="tpl-blank"></span><span class="tpl-blank"></span>';
}

export async function renderTemplateEditor(id) {
  const main = shell('modelos'); loading(main);
  let t;
  if (id === 'novo') {
    t = draft ? { ...draft } : { name: '', specialty: state.profile.specialty || 'Geral', kind: 'sessao', sections: [] };
    draft = null;
  } else {
    const found = (await api.listTemplates()).find((x) => x.id === id);
    if (!found || !found.professional_id) {
      main.innerHTML = callout('<p>Este modelo não pode ser editado aqui. Use “Duplicar e editar” para criar uma cópia sua.</p>', 'warn')
        + `<p><a class="btn quiet" href="#/modelos">Voltar aos modelos</a></p>`;
      return;
    }
    t = { ...found };
  }
  const rows = (t.sections || []).map((s) => ({ type: 'longo', ...s }));
  if (!rows.length) rows.push(blank());
  const isNew = !t.id;
  const areas = ['Geral', ...SPECIALTIES];
  const areaOpts = areas.map((s) => `<option ${s === (t.specialty || '') ? 'selected' : ''}>${esc(s)}</option>`).join('');

  main.innerHTML = `
    <div class="row" style="margin-bottom:10px">${backLink('#/modelos', 'Modelos')}<span class="grow"></span>
      <button class="btn quiet" id="tpl-cancel">Cancelar</button><button class="btn" id="tpl-save">${icon('check')}Salvar modelo</button></div>
    ${t.meta?.source ? callout(`<p>Importado de <b>${esc(t.meta.source)}</b>${t.meta.ai ? ' com ajuda da IA' : ''}. Confira os campos e acrescente o que faltar.</p>`, 'ok') : ''}
    <div class="sheet tpl-sheet">
      <input id="tpl-name" class="tpl-name" placeholder="Nome do modelo" value="${esc(t.name || '')}" aria-label="Nome do modelo">
      <div class="tpl-meta">
        <label>Área <select id="tpl-area">${areaOpts}</select></label>
        <label>Usar para <select id="tpl-kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}" ${(t.kind || 'sessao') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
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
        <input class="tpl-f-hint" data-f="hint" value="${esc(r.hint || '')}" placeholder="Orientação para a IA (opcional)" aria-label="Orientação">
        ${r.type === 'escolha' ? `<input class="tpl-f-opts" data-f="options" value="${esc((r.options || []).join(', '))}" placeholder="Opções separadas por vírgula" aria-label="Opções">` : ''}
        <div class="tpl-f-preview">${preview(r)}</div>
        <div class="tpl-f-tools">
          <button type="button" class="icon-btn" data-a="up" title="Subir" aria-label="Subir campo" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
          <button type="button" class="icon-btn" data-a="down" title="Descer" aria-label="Descer campo" ${i === rows.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
          <button type="button" class="icon-btn" data-a="rm" title="Remover campo" aria-label="Remover campo">${icon('trash')}</button>
        </div>
      </div>`).join('');
  };
  draw();

  // Edição sem redesenhar (para não perder o foco ao digitar)
  doc.addEventListener('input', (e) => {
    const el = e.target, f = el.dataset.f; if (!f) return;
    const r = rows[+el.closest('.tpl-f').dataset.i];
    if (f === 'options') r.options = el.value.split(',').map((x) => x.trim()).filter(Boolean);
    else r[f] = el.value;
    if (f === 'options') { el.closest('.tpl-f').querySelector('.tpl-f-preview').innerHTML = preview(r); }
  });
  doc.addEventListener('change', (e) => {
    if (e.target.dataset.f === 'type') { rows[+e.target.closest('.tpl-f').dataset.i].type = e.target.value; draw(); }
  });
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset.f === 'title') {
      e.preventDefault();
      const i = +e.target.closest('.tpl-f').dataset.i;
      rows.splice(i + 1, 0, blank()); draw();
      doc.querySelectorAll('.tpl-f-title')[i + 1]?.focus();
    }
  });
  doc.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const i = +b.closest('.tpl-f').dataset.i;
    if (b.dataset.a === 'up' && i > 0) [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
    if (b.dataset.a === 'down' && i < rows.length - 1) [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]];
    if (b.dataset.a === 'rm') {
      const r = rows[i];
      if ((r.title || '').trim() && !(await confirmBox(`Remover o campo “${r.title.trim()}”?`, 'Remover'))) return;
      rows.splice(i, 1);
      if (!rows.length) rows.push(blank());
    }
    draw();
  });

  $('#tpl-add').onclick = () => { rows.push(blank()); draw(); doc.querySelectorAll('.tpl-f-title').item(rows.length - 1)?.focus(); };
  $('#tpl-cancel').onclick = () => { location.hash = '#/modelos'; };
  $('#tpl-save').onclick = async (e) => {
    const name = $('#tpl-name').value.trim();
    const sections = rows.map((r) => ({
      title: (r.title || '').trim(), hint: (r.hint || '').trim(), type: r.type || 'longo',
      ...(r.type === 'escolha' && r.options?.length ? { options: r.options } : {}),
    })).filter((r) => r.title);
    if (!name) return toast('Dê um nome ao modelo.', 'err');
    if (!sections.length) return toast('Informe ao menos um campo com título.', 'err');
    const btn = e.currentTarget; btn.disabled = true;
    try {
      await api.saveTemplate({
        ...(isNew ? {} : { id: t.id }),
        name, specialty: $('#tpl-area').value, kind: $('#tpl-kind').value, sections,
        meta: t.meta || {},
      });
      toast('Modelo salvo.');
      location.hash = '#/modelos';
    } catch (err) { toast(err.message, 'err'); btn.disabled = false; }
  };
}
