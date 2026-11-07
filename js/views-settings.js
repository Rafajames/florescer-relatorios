import * as api from './api.js';
import * as ai from './ai.js';
import { state, SPECIALTIES, DEFAULT_CONSENT } from './state.js';
import { DEFAULT_PREFS, getPrefs } from './prefs.js';
import {
  $, $$, esc, fmtDateTime, todayISO, toast, openModal, confirmBox, busy, chip, callout, shell, loading, pageHeader, icon,
} from './ui.js';

/* =====================================================================
   CONFIGURAÇÕES
   ===================================================================== */
const TABS = [
  ['perfil', 'Perfil e timbre'], ['preferencias', 'Preferências'], ['chaves', 'Chaves de IA'],
  ['consentimento', 'Consentimento'], ['dados', 'Dados e privacidade'],
];

const download = (name, text, type) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export async function renderSettings(params) {
  const main = shell('config');
  const tab = TABS.some(([k]) => k === params.get('aba')) ? params.get('aba') : 'perfil';
  main.innerHTML = pageHeader('Configurações', 'Ajuste o sistema ao seu jeito de trabalhar.') + `
    <div class="settings">
      <nav class="subnav" aria-label="Seções">${TABS.map(([k, l]) => `<a href="#/config?aba=${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>
      <div id="pane"></div>
    </div>`;
  const pane = $('#pane');
  const p = state.profile;
  const saveProfile = async (patch) => { state.profile = await api.updateProfile(p.id, patch); };
  const savePrefs = (changes) => saveProfile({ preferences: { ...getPrefs(), ...changes } });

  if (tab === 'perfil') {
    pane.innerHTML = `
      <section class="panel"><h2>Perfil e timbre</h2>
        <p class="muted">Estas informações aparecem no topo dos relatórios e nas exportações.</p>
        <form id="prof">
          <div class="grid2">
            <label class="field">Nome completo<input name="full_name" required value="${esc(p.full_name)}"></label>
            <label class="field">Área de atuação<select name="specialty">${SPECIALTIES.map((s) => `<option ${s === p.specialty ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
            <label class="field">Registro no conselho<input name="council_registry" value="${esc(p.council_registry || '')}" placeholder="Ex.: CRP 20/12345"></label>
            <label class="field">Nome do consultório ou clínica<input name="clinic_name" value="${esc(p.clinic_name || '')}"></label>
          </div>
          <h3 style="margin:6px 0 8px">Prévia do timbre</h3>
          <div class="letterhead" id="lh" style="margin-bottom:16px"></div>
          <button class="btn" type="submit">Salvar perfil</button>
        </form></section>`;
    const lh = () => {
      const f = new FormData($('#prof'));
      const reg = [f.get('specialty'), f.get('council_registry')].filter(Boolean).join(', ');
      $('#lh').innerHTML = `<b>${esc(f.get('clinic_name') || f.get('full_name') || '')}</b><span>${esc(f.get('full_name') || '')}${reg ? ', ' + esc(reg) : ''}</span>`;
    };
    lh(); $('#prof').oninput = lh;
    $('#prof').onsubmit = (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      return busy(e.target.querySelector('[type=submit]'), 'Salvando…', async () => {
        await saveProfile({ full_name: f.get('full_name').trim(), specialty: f.get('specialty'), council_registry: f.get('council_registry').trim() || null, clinic_name: f.get('clinic_name').trim() || null });
        toast('Perfil salvo.');
      });
    };
  }

  if (tab === 'preferencias') {
    const pr = getPrefs();
    const tpls = (await api.listTemplates()).filter((t) => t.kind === 'sessao');
    pane.innerHTML = `
      <form id="pf">
      <section class="panel"><h2>Como a IA escreve</h2>
          <div class="field">Nível de detalhe dos esboços
            <div class="seg" style="margin-top:6px">${[['resumido', 'Resumido'], ['padrao', 'Padrão'], ['detalhado', 'Detalhado']]
              .map(([v, l]) => `<label><input type="radio" name="detail" value="${v}" ${pr.detail === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
          <label class="field">Instruções fixas para a IA
            <small>Valem para todos os esboços. Ex.: abordagem teórica que você usa, termos que prefere, o que não registrar.</small>
            <textarea name="instructions" rows="4">${esc(pr.instructions)}</textarea></label>
          <label class="check"><input type="checkbox" name="flagUncertain" ${pr.flagUncertain ? 'checked' : ''}><span>Marcar trechos duvidosos com [verificar]<small>Ajuda a achar o que a IA não teve certeza de ter entendido.</small></span></label>
          <p class="muted small">As regras de segurança (não inventar fatos, não usar nomes) sempre prevalecem sobre estas instruções.</p>
      </section>
      <section class="panel"><h2>Editor e novos relatórios</h2>
          <label class="check"><input type="checkbox" name="autosave" ${pr.autosave ? 'checked' : ''}><span>Salvar rascunhos automaticamente<small>Relatórios já revisados nunca são salvos sozinhos.</small></span></label>
          <label class="check"><input type="checkbox" name="sectionsVisibleToPatient" ${pr.sectionsVisibleToPatient ? 'checked' : ''}><span>Novas seções já nascem visíveis ao paciente<small>Você pode ocultar seção por seção no editor.</small></span></label>
          <div class="grid2" style="margin-top:10px">
            <label class="field">Modelo padrão de sessão<select name="defaultTemplateId"><option value="">Escolher pela minha área</option>
              ${tpls.map((t) => `<option value="${t.id}" ${t.id === pr.defaultTemplateId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
            <label class="field">Título padrão da sessão<input name="titlePattern" value="${esc(pr.titlePattern)}"><small>Use {data} para inserir a data da sessão.</small></label>
          </div>
          <div class="row"><button class="btn" type="submit">Salvar preferências</button><button type="button" class="link" id="reset">Restaurar padrões</button></div>
      </section></form>`;
    const form = $('#pf');
    form.onsubmit = (e) => {
      e.preventDefault(); const f = new FormData(form);
      return busy($('[type=submit]', form), 'Salvando…', async () => {
        await savePrefs({
          detail: f.get('detail') || 'padrao', instructions: f.get('instructions').trim(), flagUncertain: f.has('flagUncertain'),
          autosave: f.has('autosave'), sectionsVisibleToPatient: f.has('sectionsVisibleToPatient'),
          defaultTemplateId: f.get('defaultTemplateId'), titlePattern: f.get('titlePattern').trim() || DEFAULT_PREFS.titlePattern,
        });
        toast('Preferências salvas.');
      });
    };
    $('#reset').onclick = async () => {
      if (!(await confirmBox('Voltar todas as preferências para o padrão?', 'Restaurar'))) return;
      await saveProfile({ preferences: {} }); toast('Preferências restauradas.'); renderSettings(params);
    };
  }

  if (tab === 'chaves') {
    const keys = ai.getKeys();
    pane.innerHTML = `
      <section class="panel"><h2>Chaves de IA</h2>
        ${callout('<p>As chaves ficam guardadas só neste navegador e <b>nunca</b> vão para o banco de dados. O texto das sessões é enviado ao provedor (Anthropic ou OpenAI) para gerar o esboço, informe isso no consentimento. Defina um limite de gasto no painel de cada provedor.</p>')}
        <form id="keys">
          <label class="field">Anthropic (Claude), gera os esboços ${ai.hasClaudeKey() ? chip('Salva', 'ok') : chip('Não cadastrada', 'warn')}
            <input type="password" name="anthropic" autocomplete="off" placeholder="${keys.anthropic ? 'Deixe em branco para manter a atual' : 'sk-ant-…'}"></label>
          <label class="field">OpenAI (Whisper), transcreve áudio ${ai.hasWhisperKey() ? chip('Salva', 'ok') : chip('Não cadastrada', 'warn')}
            <input type="password" name="openai" autocomplete="off" placeholder="${keys.openai ? 'Deixe em branco para manter a atual' : 'sk-…'}"></label>
          <div class="row"><button class="btn" type="submit">Salvar chaves</button><button type="button" class="link" id="clear-keys">Remover as chaves deste computador</button></div>
        </form></section>`;
    $('#keys').onsubmit = (e) => {
      e.preventDefault(); const f = new FormData(e.target); const cur = ai.getKeys();
      ai.setKeys({ anthropic: f.get('anthropic').trim() || cur.anthropic, openai: f.get('openai').trim() || cur.openai });
      toast('Chaves salvas neste computador.'); renderSettings(params);
    };
    $('#clear-keys').onclick = async () => {
      if (!(await confirmBox('Remover as chaves de IA deste computador?', 'Remover'))) return;
      ai.clearKeys(); toast('Chaves removidas.'); renderSettings(params);
    };
  }

  if (tab === 'consentimento') {
    pane.innerHTML = `
      <section class="panel"><h2>Termo de consentimento</h2>
        <p class="muted">Este é o texto mostrado ao registrar o consentimento de cada paciente. Adapte à sua prática e peça revisão jurídica.</p>
        <form id="cf">
          <label class="field">Texto do termo<textarea name="consent_text" rows="12">${esc(p.consent_text || DEFAULT_CONSENT)}</textarea></label>
          <div class="row"><button class="btn" type="submit">Salvar termo</button><button type="button" class="link" id="def">Voltar ao texto padrão</button></div>
        </form></section>`;
    $('#def').onclick = () => { $('[name=consent_text]').value = DEFAULT_CONSENT; };
    $('#cf').onsubmit = (e) => {
      e.preventDefault();
      return busy($('[type=submit]', e.target), 'Salvando…', async () => {
        await saveProfile({ consent_text: new FormData(e.target).get('consent_text').trim() || null }); toast('Termo salvo.');
      });
    };
  }

  if (tab === 'dados') {
    pane.innerHTML = `
      <section class="panel"><h2>Seus dados</h2>
        <p class="muted">Você é responsável pelos dados dos seus pacientes. Guarde cópias em local seguro e criptografado.</p>
        <div class="row">
          <button class="btn quiet" id="bk">${icon('download')}Baixar backup completo (JSON)</button>
          <button class="btn quiet" id="csv">${icon('download')}Baixar lista de pacientes (CSV)</button>
        </div>
      </section>
      <section class="panel"><h2>Atividade recente</h2>
        <p class="muted">Quem criou, alterou ou liberou o quê. O conteúdo clínico não é gravado neste registro.</p>
        <div id="act"><p class="muted">Carregando…</p></div>
      </section>`;
    $('#bk').onclick = (e) => busy(e.currentTarget, 'Gerando…', async () => {
      const data = await api.exportEverything();
      download(`florescer-backup-${todayISO()}.json`, JSON.stringify(data, null, 2), 'application/json');
      toast('Backup baixado. Guarde o arquivo com cuidado: contém dados sensíveis.');
    });
    $('#csv').onclick = (e) => busy(e.currentTarget, 'Gerando…', async () => {
      const list = await api.listPatients(true);
      const head = ['Nome', 'E-mail', 'Telefone', 'Nascimento', 'Arquivado', 'Cadastrado em'];
      const rows = list.map((x) => [x.name, x.email, x.phone, x.birth_date, x.archived ? 'sim' : 'não', x.created_at?.slice(0, 10)]);
      download(`florescer-pacientes-${todayISO()}.csv`, '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\n'), 'text/csv');
    });
    try {
      const log = await api.listAuditAll();
      const ent = { reports: 'relatório', patients: 'paciente', consents: 'consentimento' };
      const act = { insert: 'criou', update: 'alterou', delete: 'excluiu' };
      $('#act').innerHTML = log.length ? `<div class="list">${log.map((a) => `<div class="li"><span class="grow">Você ${act[a.action] || a.action} um ${ent[a.entity] || a.entity}${a.detail?.released ? ' (liberado ao paciente)' : ''}${a.detail?.revoked ? ' (revogado)' : ''}</span><span class="muted small">${fmtDateTime(a.created_at)}</span></div>`).join('')}</div>` : '<p class="muted">Sem atividade registrada.</p>';
    } catch (err) { $('#act').innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
  }
}

/* =====================================================================
   MODELOS
   ===================================================================== */
async function templateModal(t = {}) {
  let rows = (t.sections || [{ title: '', hint: '' }]).map((s) => ({ ...s }));
  return openModal(t.id && t.professional_id ? 'Editar modelo' : 'Novo modelo', `
    <label class="field">Nome do modelo<input name="name" required value="${esc(t.name || '')}"></label>
    <div class="grid2">
      <label class="field">Área<select name="specialty">${['Geral', ...SPECIALTIES].map((s) => `<option ${s === (t.specialty || state.profile.specialty) ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="field">Tipo<select name="kind"><option value="sessao" ${t.kind !== 'periodo' ? 'selected' : ''}>Sessão</option><option value="periodo" ${t.kind === 'periodo' ? 'selected' : ''}>Período</option></select></label>
    </div>
    <div class="field" style="margin-bottom:6px">Seções do relatório<small>O título vira o cabeçalho. A orientação diz à IA o que escrever ali.</small></div>
    <div id="rows"></div>
    <button type="button" class="btn quiet sm" id="addrow">${icon('plus')}Adicionar seção</button>`,
  {
    wide: true,
    onOpen: (d) => {
      const draw = () => {
        $('#rows', d).innerHTML = rows.map((r, i) => `
          <div class="sec-edit" data-i="${i}">
            <input data-f="title" placeholder="Título da seção" value="${esc(r.title)}" aria-label="Título">
            <input data-f="hint" placeholder="Orientação para a IA (opcional)" value="${esc(r.hint || '')}" aria-label="Orientação">
            <div class="row"><button type="button" class="icon-btn" data-a="up" title="Subir" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
              <button type="button" class="icon-btn" data-a="down" title="Descer" ${i === rows.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
              <button type="button" class="icon-btn" data-a="rm" title="Remover">${icon('trash')}</button></div>
          </div>`).join('');
      };
      draw();
      $('#rows', d).addEventListener('input', (e) => { const row = e.target.closest('.sec-edit'); if (row) rows[+row.dataset.i][e.target.dataset.f] = e.target.value; });
      $('#rows', d).addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const i = +b.closest('.sec-edit').dataset.i;
        if (b.dataset.a === 'up' && i > 0) [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
        if (b.dataset.a === 'down' && i < rows.length - 1) [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]];
        if (b.dataset.a === 'rm') rows.splice(i, 1);
        draw();
      });
      $('#addrow', d).onclick = () => { rows.push({ title: '', hint: '' }); draw(); };
    },
    onOk: (d) => {
      const g = (n) => d.querySelector(`[name=${n}]`).value.trim();
      const sections = rows.map((r) => ({ title: (r.title || '').trim(), hint: (r.hint || '').trim() })).filter((r) => r.title);
      if (!sections.length) throw new Error('Informe ao menos uma seção com título.');
      return api.saveTemplate({ ...(t.id && t.professional_id ? { id: t.id } : {}), name: g('name'), specialty: g('specialty'), kind: g('kind'), sections });
    },
  });
}

export async function renderTemplates() {
  const main = shell('modelos'); loading(main);
  const list = await api.listTemplates();
  const sys = list.filter((t) => !t.professional_id), mine = list.filter((t) => t.professional_id);
  const row = (t, own) => `<div class="li">
    <div class="grow"><div class="t">${esc(t.name)} ${chip(t.kind === 'periodo' ? 'Período' : 'Sessão', 'petrol')} ${t.specialty ? chip(t.specialty) : ''}</div>
    <div class="muted small">${t.sections.map((s) => esc(s.title)).join(', ')}</div></div>
    ${own
      ? `<button class="btn quiet sm" data-edit="${t.id}">${icon('edit')}Editar</button><button class="icon-btn" data-del="${t.id}" title="Excluir modelo" aria-label="Excluir modelo">${icon('trash')}</button>`
      : `<button class="btn quiet sm" data-dup="${t.id}">Duplicar e editar</button>`}</div>`;

  main.innerHTML = pageHeader('Modelos de relatório', 'Defina as seções de cada tipo de relatório. A IA segue essas seções.', `<button class="btn" id="new">${icon('plus')}Novo modelo</button>`) + `
    <section class="panel"><h2>Meus modelos</h2>
      ${mine.length ? `<div class="list">${mine.map((t) => row(t, true)).join('')}</div>` : '<div class="empty"><b>Você ainda não criou modelos</b>Duplique um modelo do sistema para adaptar ao seu jeito.</div>'}</section>
    <section class="panel"><h2>Modelos do sistema</h2><div class="list">${sys.map((t) => row(t, false)).join('')}</div></section>`;

  const byId = Object.fromEntries(list.map((t) => [t.id, t]));
  $('#new').onclick = async () => { if (await templateModal()) renderTemplates(); };
  $$('[data-edit]').forEach((b) => (b.onclick = async () => { if (await templateModal(byId[b.dataset.edit])) renderTemplates(); }));
  $$('[data-dup]').forEach((b) => (b.onclick = async () => {
    const t = byId[b.dataset.dup];
    if (await templateModal({ ...t, id: undefined, professional_id: undefined, name: t.name + ' (meu)' })) renderTemplates();
  }));
  $$('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Excluir este modelo? Relatórios já criados continuam intactos.', 'Excluir'))) return;
    await api.deleteTemplate(b.dataset.del); toast('Modelo excluído.'); renderTemplates();
  }));
}
