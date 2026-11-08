// Botão único "Novo": pergunta o que criar.
import * as api from './api.js';
import { openModal, esc, icon, toast } from './ui.js';
import { newDocument } from './views-home.js';

const OPTIONS = [
  ['sessao', 'mic', 'Evolução (sessão)', 'Gravar ou digitar uma sessão e gerar o relatório.', true],
  ['anamnese', 'file', 'Anamnese', 'Entrevista inicial do paciente.', true],
  ['documento', 'edit', 'Documento livre', 'Página em branco, como no Word, com tabelas.', true],
  ['periodo', 'calendar', 'Relatório por período', 'Junta várias sessões de um paciente.', false],
  ['paciente', 'users', 'Paciente', 'Cadastrar um novo paciente.', false],
  ['modelo', 'layout', 'Modelo de documento', 'Criar ou enviar um modelo.', false],
];

export async function openNewMenu() {
  let patients = [];
  try { patients = await api.listPatients(); } catch { /* segue sem lista */ }
  let choice = null;
  await openModal('O que você quer criar?', `
    <label class="field">Paciente <small>(para evolução, anamnese, documento e período)</small>
      <select id="nm-p"><option value="">Escolher depois</option>${patients.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
    <div class="new-grid">${OPTIONS.map(([k, ic, t, d]) => `<button type="button" class="new-opt" data-k="${k}">${icon(ic)}<span><b>${t}</b><small>${d}</small></span></button>`).join('')}</div>`,
  { cancelText: 'Fechar', wide: true, onOpen: (dlg) => {
    dlg.querySelectorAll('.new-opt').forEach((b) => (b.onclick = () => { choice = [b.dataset.k, dlg.querySelector('#nm-p').value]; dlg.querySelector('[data-cancel]').click(); }));
  } });
  if (!choice) return;
  const [k, pid] = choice, q = pid ? `paciente=${pid}` : '';
  if (k === 'sessao') location.hash = `#/nova${q ? '?' + q : ''}`;
  else if (k === 'anamnese') location.hash = `#/nova?${q ? q + '&' : ''}tipo=anamnese`;
  else if (k === 'periodo') location.hash = `#/periodo${q ? '?' + q : ''}`;
  else if (k === 'paciente') location.hash = '#/pacientes';
  else if (k === 'modelo') location.hash = '#/modelos';
  else if (k === 'documento') { if (!pid) return toast('Escolha o paciente para criar o documento.', 'err'); newDocument(pid); }
}
