// Plano terapêutico (metas) e escalas com gráfico, na ficha do paciente.
// As metas são marcadas em cada evolução; as escalas são criadas pelo próprio profissional.
import * as api from './api.js';
import { $, $$, esc, fmtDate, todayISO, toast, confirmBox, openModal, chip, icon } from './ui.js';

const META_ST = { em_andamento: 'Em andamento', alcancada: 'Alcançada', pausada: 'Pausada' };
const META_KIND = { em_andamento: 'petrol', alcancada: 'ok', pausada: '' };

/* ---------- metas ---------- */
/** reports: lista da ficha (com goal_ids), para contar em quantas sessões cada meta foi trabalhada. */
export async function metasPanel(box, patientId, reports) {
  const goals = await api.listGoals(patientId);
  const usos = (gid) => reports.filter((r) => (r.goal_ids || []).includes(gid));
  const again = () => metasPanel(box, patientId, reports);
  box.innerHTML = `<div class="panel-head" style="margin-top:22px"><h2>Plano terapêutico</h2><button class="btn quiet sm" id="meta-add">${icon('plus')}Nova meta</button></div>
    ${goals.length ? `<div class="table">${goals.map((g) => {
      const u = usos(g.id); const ult = u.map((r) => r.session_date).sort().pop();
      const atrasada = g.status === 'em_andamento' && g.due_date && g.due_date < todayISO();
      return `<div class="tr meta-row">
        <span class="grow"><b>${esc(g.title)}</b>${g.description ? `<br><small class="muted">${esc(g.description)}</small>` : ''}
          <br><small class="muted">${u.length ? `Trabalhada em ${u.length} ${u.length === 1 ? 'sessão' : 'sessões'} · última em ${fmtDate(ult)}` : 'Ainda não trabalhada em sessão'}${g.due_date ? ` · prazo ${fmtDate(g.due_date)}` : ''}</small>
          ${atrasada ? chip('Prazo vencido', 'warn') : ''}</span>
        <select data-meta-st="${g.id}" aria-label="Situação da meta" style="width:auto;margin:0;min-height:0;padding:5px 8px">${Object.entries(META_ST).map(([k, l]) => `<option value="${k}" ${k === g.status ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="icon-btn" data-meta-ed="${g.id}" title="Editar" aria-label="Editar meta">${icon('edit')}</button>
        <button class="icon-btn" data-meta-del="${g.id}" title="Excluir" aria-label="Excluir meta">${icon('trash')}</button></div>`;
    }).join('')}</div>`
      : '<p class="muted small">Nenhuma meta ainda. Crie as metas do tratamento e marque em cada evolução quais foram trabalhadas.</p>'}`;

  const form = (g) => openModal(g ? 'Editar meta' : 'Nova meta', `
    <label class="field">Meta<input name="title" value="${esc(g?.title || '')}" required maxlength="160" placeholder="Ex.: Vestir a camiseta sem ajuda"></label>
    <label class="field">Como será observada (opcional)<textarea name="description" rows="2" maxlength="600" placeholder="Ex.: em 4 de 5 tentativas, com apoio verbal">${esc(g?.description || '')}</textarea></label>
    <label class="field">Prazo (opcional)<input type="date" name="due_date" value="${g?.due_date || ''}"></label>`,
  { okText: 'Salvar', onOk: async (d) => {
    const f = (n) => d.querySelector(`[name=${n}]`).value.trim();
    if (!f('title')) return false;
    await api.saveGoal({ ...(g ? { id: g.id } : { patient_id: patientId }), title: f('title'), description: f('description') || null, due_date: f('due_date') || null });
    return true;
  } });
  $('#meta-add', box).onclick = async () => { if (await form()) { toast('Meta criada.'); again(); } };
  $$('[data-meta-ed]', box).forEach((b) => (b.onclick = async () => { if (await form(goals.find((g) => g.id === b.dataset.metaEd))) { toast('Meta atualizada.'); again(); } }));
  $$('[data-meta-st]', box).forEach((sel) => (sel.onchange = async () => { await api.saveGoal({ id: sel.dataset.metaSt, status: sel.value }); toast('Situação da meta atualizada.'); again(); }));
  $$('[data-meta-del]', box).forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Excluir esta meta? As evoluções continuam intactas.', 'Excluir'))) return;
    await api.deleteGoal(b.dataset.metaDel); toast('Meta excluída.'); again();
  }));
}

/** No editor da evolução: caixas para marcar as metas trabalhadas na sessão. Salva ao marcar. */
export async function metasDaSessao(box, report) {
  const goals = (await api.listGoals(report.patient_id)).filter((g) => g.status === 'em_andamento' || (report.goal_ids || []).includes(g.id));
  let marcadas = new Set(report.goal_ids || []);
  box.innerHTML = `<h3>Metas trabalhadas</h3>
    ${goals.length ? goals.map((g) => `<label class="check small" style="align-items:flex-start;margin:6px 0"><input type="checkbox" value="${g.id}" ${marcadas.has(g.id) ? 'checked' : ''}><span>${esc(g.title)}</span></label>`).join('')
      : `<p class="small muted">Este paciente ainda não tem metas. Crie em <a href="#/pacientes/${report.patient_id}">Plano terapêutico</a>, na ficha.</p>`}`;
  $$('input[type=checkbox]', box).forEach((c) => (c.onchange = async () => {
    if (c.checked) marcadas.add(c.value); else marcadas.delete(c.value);
    try { await api.updateReport(report.id, { goal_ids: [...marcadas] }); toast('Metas da sessão salvas.'); }
    catch (err) { toast(err.message, 'err'); c.checked = !c.checked; }
  }));
}

/* ---------- escalas ---------- */
/** Gráfico de linha simples (total por data). */
function grafico(scores, max) {
  if (scores.length < 2) return '';
  const W = 280, H = 90, P = 8;
  const x = (i) => P + (i * (W - 2 * P)) / (scores.length - 1);
  const y = (v) => H - P - (Math.max(0, Math.min(max, v)) / (max || 1)) * (H - 2 * P);
  const pts = scores.map((s, i) => `${x(i).toFixed(1)},${y(Number(s.total)).toFixed(1)}`).join(' ');
  return `<svg class="esc-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução da pontuação: de ${Number(scores[0].total)} para ${Number(scores[scores.length - 1].total)}, de um máximo de ${max}">
    <line x1="${P}" y1="${H - P}" x2="${W - P}" y2="${H - P}" stroke="currentColor" opacity=".18"/>
    <polyline points="${pts}" fill="none" stroke="var(--petrol)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${scores.map((s, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(Number(s.total)).toFixed(1)}" r="3.5" fill="var(--petrol)"><title>${fmtDate(s.date)}: ${Number(s.total)}</title></circle>`).join('')}</svg>`;
}

export async function escalasPanel(box, patientId) {
  const [scales, scores] = await Promise.all([api.listScales(), api.listScores(patientId)]);
  const again = () => escalasPanel(box, patientId);
  const maxOf = (s) => s.items.reduce((n, i) => n + Number(i.max || 0), 0);
  const usadas = scales.filter((s) => scores.some((x) => x.scale_id === s.id));
  box.innerHTML = `<div class="panel">
    <div class="panel-head"><h3>Escalas</h3></div>
    ${usadas.length ? usadas.map((s) => {
      const meus = scores.filter((x) => x.scale_id === s.id); const ult = meus[meus.length - 1];
      return `<div class="esc-bloco"><b>${esc(s.name)}</b><span class="small muted"> · última: ${Number(ult.total)} de ${maxOf(s)} em ${fmtDate(ult.date)}</span>
        ${grafico(meus, maxOf(s))}
        <div class="small">${meus.slice().reverse().slice(0, 4).map((m) => `${fmtDate(m.date)}: <b>${Number(m.total)}</b> <button class="link small" data-sc-del="${m.id}">excluir</button>`).join(' · ')}</div></div>`;
    }).join('') : '<p class="muted small">Nenhuma escala aplicada a este paciente.</p>'}
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
      ${scales.length ? `<select id="esc-sel" aria-label="Escala" style="width:auto;margin:0;min-height:0;padding:6px 8px">${scales.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
        <button class="btn sm" id="esc-aplicar">Aplicar</button>` : ''}
      <button class="btn quiet sm" id="esc-nova">${icon('plus')}Nova escala</button>
      ${scales.length ? '<button class="btn quiet sm" id="esc-gerir">Minhas escalas</button>' : ''}
    </div></div>`;

  $('#esc-nova', box).onclick = async () => {
    const r = await openModal('Nova escala', `
      <p class="muted small">Monte uma escala sua: um item por linha, com a nota máxima depois de uma barra. Use instrumentos próprios ou de uso livre.</p>
      <label class="field">Nome da escala<input name="name" required maxlength="100" placeholder="Ex.: Independência no vestir"></label>
      <label class="field">Itens (um por linha, no formato Item | nota máxima)<textarea name="items" rows="6" placeholder="Veste a camiseta | 4&#10;Abotoa | 4&#10;Calça os sapatos | 4"></textarea></label>`,
    { okText: 'Criar escala', onOk: async (d) => {
      const name = d.querySelector('[name=name]').value.trim();
      const items = d.querySelector('[name=items]').value.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [label, m] = l.split('|').map((x) => x.trim()); return { label, max: Math.min(100, Math.max(1, Number(m) || 5)) };
      }).filter((i) => i.label);
      if (!name || !items.length) { toast('Informe o nome e ao menos um item.', 'err'); return false; }
      await api.saveScale({ name, items }); return true;
    } });
    if (r) { toast('Escala criada.'); again(); }
  };
  if ($('#esc-gerir', box)) $('#esc-gerir', box).onclick = async () => {
    await openModal('Minhas escalas', `<p class="muted small">As escalas valem para todos os seus pacientes. Excluir uma escala apaga também as aplicações dela.</p>
      <div class="table">${scales.map((s) => `<div class="tr" style="display:flex;align-items:center;gap:10px"><span class="grow"><b>${esc(s.name)}</b><br><small class="muted">${s.items.map((i) => `${esc(i.label)} (0 a ${i.max})`).join(' · ')}</small></span>
        <button type="button" class="icon-btn" data-esc-del="${s.id}" title="Excluir escala" aria-label="Excluir escala">${icon('trash')}</button></div>`).join('')}</div>`,
    { cancelText: 'Fechar', onOpen: (d) => d.querySelectorAll('[data-esc-del]').forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox('Excluir esta escala e todas as aplicações dela, de todos os pacientes?', 'Excluir'))) return;
      await api.deleteScale(b.dataset.escDel); b.closest('.tr').remove(); toast('Escala excluída.');
    })) });
    again();
  };
  if ($('#esc-aplicar', box)) $('#esc-aplicar', box).onclick = async () => {
    const s = scales.find((x) => x.id === $('#esc-sel', box).value);
    const r = await openModal(`Aplicar: ${s.name}`, `
      <label class="field">Data<input type="date" name="date" value="${todayISO()}" required></label>
      ${s.items.map((it, i) => `<label class="field">${esc(it.label)} (0 a ${it.max})<input type="number" name="v${i}" min="0" max="${it.max}" step="1" value="0" required></label>`).join('')}
      <label class="field">Observação (opcional)<input name="notes" maxlength="300"></label>
      <p class="small" id="esc-total" role="status"></p>`,
    { okText: 'Salvar pontuação',
      onOpen: (d) => { const soma = () => { const t = s.items.reduce((n, it, i) => n + (Number(d.querySelector(`[name=v${i}]`).value) || 0), 0); d.querySelector('#esc-total').innerHTML = `Total: <b>${t}</b> de ${maxOf(s)}`; }; d.addEventListener('input', soma); soma(); },
      onOk: async (d) => {
        const vals = s.items.map((it, i) => Math.min(it.max, Math.max(0, Number(d.querySelector(`[name=v${i}]`).value) || 0)));
        await api.saveScore({ patient_id: patientId, scale_id: s.id, date: d.querySelector('[name=date]').value || todayISO(), vals, total: vals.reduce((a, b) => a + b, 0), notes: d.querySelector('[name=notes]').value.trim() || null });
        return true;
      } });
    if (r) { toast('Pontuação salva.'); again(); }
  };
  $$('[data-sc-del]', box).forEach((b) => (b.onclick = async () => { if (!(await confirmBox('Excluir esta aplicação da escala?', 'Excluir'))) return; await api.deleteScore(b.dataset.scDel); toast('Excluída.'); again(); }));
}
