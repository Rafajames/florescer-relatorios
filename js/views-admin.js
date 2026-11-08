// Administração: ajustes do sistema sem mexer no código. Não dá acesso a pacientes, relatórios nem transcrições.
import * as api from './api.js';
import { PROVIDERS } from './ai.js';
import { state, settings, applySettings, SPECIALTIES, DEFAULT_CONSENT } from './state.js';
import { $, $$, esc, toast, shell, pageHeader, icon, chip, loading, confirmBox, fmtDate } from './ui.js';

const TABS = [['modelos', 'Modelos do sistema'], ['textos', 'Textos padrão'], ['ia', 'Modelos de IA'], ['aviso', 'Aviso geral'], ['pessoas', 'Profissionais'], ['ajuda', 'Ajuda']];
const KINDS = { sessao: 'Evolução', anamnese: 'Anamnese', periodo: 'Período' };

async function save(key, value) {
  await api.saveSetting(key, value);
  applySettings(Object.entries({ ...settings, [key]: value }).map(([k, v]) => ({ key: k, value: v })), PROVIDERS);
  toast('Salvo.');
}

export async function renderAdmin() {
  if (!state.profile?.is_admin) { location.hash = '#/painel'; return; }
  const main = shell('admin');
  const tab = new URLSearchParams((location.hash.split('?')[1]) || '').get('aba') || 'modelos';
  main.innerHTML = pageHeader('Administração', 'Altere o sistema sem editar o código. Você não vê pacientes, relatórios nem transcrições.') +
    `<div class="adm-tabs">${TABS.map(([k, l]) => `<a class="btn ${k === tab ? '' : 'quiet'} sm" href="#/admin?aba=${k}">${l}</a>`).join('')}</div><div id="adm"></div>`;
  const box = $('#adm'); loading(box);
  try { await VIEWS[tab](box); } catch (e) { box.innerHTML = `<div class="callout warn">${icon('info')}<div class="grow"><p>${esc(e.message)}</p><p class="muted small">Se a tabela ainda não existe, rode o arquivo supabase/admin.sql no Supabase.</p></div></div>`; }
}

const VIEWS = {
  async modelos(box) {
    const { templateModal } = await import('./views-settings.js');
    const list = (await api.listTemplates()).filter((t) => !t.professional_id);
    box.innerHTML = `<section class="panel"><div class="row"><h2 class="grow">Modelos que todos os profissionais recebem</h2><button class="btn" id="new">${icon('plus')}Novo modelo</button></div>
      <p class="muted small">Alterações valem para novos relatórios. Relatórios já criados não mudam.</p>
      <div class="list">${list.map((t) => `<div class="li"><div class="grow"><div class="t">${esc(t.name)} ${chip(KINDS[t.kind] || 'Evolução', 'petrol')} ${t.specialty ? chip(t.specialty) : ''}</div>
        <div class="muted small">${t.sections.map((s) => esc(s.title)).join(', ')}</div></div>
        <button class="btn quiet sm" data-edit="${t.id}">${icon('edit')}Editar</button><button class="icon-btn" data-del="${t.id}" aria-label="Excluir modelo">${icon('trash')}</button></div>`).join('')}</div></section>`;
    const by = Object.fromEntries(list.map((t) => [t.id, t]));
    $('#new').onclick = async () => { if (await templateModal({ sys: true })) renderAdmin(); };
    $$('[data-edit]', box).forEach((b) => (b.onclick = async () => { if (await templateModal({ ...by[b.dataset.edit], sys: true })) renderAdmin(); }));
    $$('[data-del]', box).forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox('Excluir este modelo do sistema para todos?', 'Excluir'))) return;
      await api.deleteTemplate(b.dataset.del); toast('Modelo excluído.'); renderAdmin();
    }));
  },

  async textos(box) {
    box.innerHTML = `<section class="panel"><h2>Textos padrão</h2>
      <label class="field">Texto do consentimento (LGPD)<textarea id="c" rows="9">${esc(DEFAULT_CONSENT)}</textarea></label>
      <label class="field">Rodapé dos documentos<small>Usado quando o profissional não definiu o próprio rodapé.</small><input id="f" value="${esc(settings.doc_footer || '')}"></label>
      <label class="field">Áreas de atuação<small>Uma por linha.</small><textarea id="s" rows="9">${esc(SPECIALTIES.join('\n'))}</textarea></label>
      <div class="row"><button class="btn" id="ok">Salvar</button><button class="btn ghost" id="rs">Voltar ao padrão do sistema</button></div></section>`;
    $('#ok').onclick = async () => {
      const sp = $('#s').value.split('\n').map((x) => x.trim()).filter(Boolean);
      if (!sp.length) return toast('Informe ao menos uma área.');
      await save('consent_text', $('#c').value.trim()); await save('doc_footer', $('#f').value.trim()); await save('specialties', sp);
    };
    $('#rs').onclick = async () => {
      if (!(await confirmBox('Voltar consentimento, rodapé e áreas para o padrão original?', 'Voltar'))) return;
      await save('consent_text', ''); await save('doc_footer', ''); await save('specialties', []); location.reload();
    };
  },

  async ia(box) {
    const labels = { gemini: 'Gemini', groq: 'Groq', anthropic: 'Claude (Anthropic)', openai: 'OpenAI' };
    box.innerHTML = `<section class="panel"><h2>Modelos de IA</h2>
      <p class="muted small">Nome exato do modelo usado em cada serviço. Se um modelo for aposentado pelo fabricante, troque aqui. Vale para todos na próxima abertura do site.</p>
      <div class="grid2">${Object.keys(labels).map((k) => `<label class="field">${labels[k]}<input data-m="${k}" value="${esc(PROVIDERS[k].model)}"></label>`).join('')}</div>
      <button class="btn" id="ok">Salvar</button></section>`;
    $('#ok').onclick = () => save('models', Object.fromEntries($$('[data-m]', box).map((i) => [i.dataset.m, i.value.trim()]).filter(([, v]) => v)));
  },

  async aviso(box) {
    const n = settings.notice || {};
    box.innerHTML = `<section class="panel"><h2>Aviso geral</h2>
      <p class="muted small">Aparece no topo para todos que entram no sistema (profissionais e pacientes).</p>
      <label class="field">Mensagem<textarea id="t" rows="3">${esc(n.text || '')}</textarea></label>
      <div class="grid2"><label class="field">Tipo<select id="l"><option value="info">Informação</option><option value="warn" ${n.level === 'warn' ? 'selected' : ''}>Atenção</option></select></label>
      <label class="field">Exibição<select id="on"><option value="1">Mostrar</option><option value="" ${n.on ? '' : 'selected'}>Ocultar</option></select></label></div>
      <button class="btn" id="ok">Salvar</button></section>`;
    $('#ok').onclick = () => save('notice', { text: $('#t').value.trim(), level: $('#l').value, on: Boolean($('#on').value) });
  },

  async pessoas(box) {
    const list = await api.adminProfessionals();
    box.innerHTML = `<section class="panel"><h2>Profissionais cadastrados (${list.length})</h2>
      <p class="muted small">Só dados de cadastro. Conta desativada não consegue mais entrar nem usar o sistema; os dados dela ficam guardados.</p>
      <div class="list">${list.map((p) => `<div class="li"><div class="grow"><div class="t">${esc(p.full_name || '(sem nome)')} ${p.is_admin ? chip('Administrador', 'bloom') : ''} ${p.disabled ? chip('Desativado') : ''}</div>
        <div class="muted small">${esc(p.email)} · ${esc(p.specialty || 'Sem área')} · desde ${esc(fmtDate(p.created_at))}</div></div>
        ${p.id === state.profile.id ? '' : `<button class="btn quiet sm" data-t="${p.id}" data-off="${p.disabled ? '' : '1'}">${p.disabled ? 'Reativar' : 'Desativar'}</button>`}</div>`).join('')}</div></section>`;
    $$('[data-t]', box).forEach((b) => (b.onclick = async () => {
      const off = Boolean(b.dataset.off);
      if (off && !(await confirmBox('Desativar esta conta? A pessoa perde o acesso até você reativar.', 'Desativar'))) return;
      await api.adminSetDisabled(b.dataset.t, off); toast(off ? 'Conta desativada.' : 'Conta reativada.'); renderAdmin();
    }));
  },

  async ajuda(box) {
    const rows = Array.isArray(settings.help_extra) ? settings.help_extra.map((x) => ({ ...x })) : [];
    const draw = () => {
      box.innerHTML = `<section class="panel"><div class="row"><h2 class="grow">Tópicos extras da Ajuda</h2><button class="btn quiet sm" id="add">${icon('plus')}Novo tópico</button></div>
        <p class="muted small">Aparecem no fim da página Ajuda de todos os profissionais.</p>
        ${rows.map((r, i) => `<div class="sec-edit" data-i="${i}"><input data-f="t" placeholder="Título" value="${esc(r.t || '')}"><textarea data-f="text" rows="3" placeholder="Texto">${esc(r.text || '')}</textarea>
          <button class="icon-btn" data-rm="${i}" aria-label="Remover">${icon('trash')}</button></div>`).join('') || '<p class="muted">Nenhum tópico extra ainda.</p>'}
        <button class="btn" id="ok" style="margin-top:12px">Salvar</button></section>`;
      $('#add').onclick = () => { rows.push({ t: '', text: '' }); draw(); };
      $$('[data-rm]', box).forEach((b) => (b.onclick = () => { rows.splice(+b.dataset.rm, 1); draw(); }));
      box.oninput = (e) => { const r = e.target.closest('.sec-edit'); if (r && e.target.dataset.f) rows[+r.dataset.i][e.target.dataset.f] = e.target.value; };
      $('#ok').onclick = () => save('help_extra', rows.filter((r) => r.t.trim() && r.text.trim()));
    };
    draw();
  },
};
