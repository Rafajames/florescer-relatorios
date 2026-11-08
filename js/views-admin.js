// Administração: ajustes do sistema sem mexer no código. Não dá acesso a pacientes, relatórios nem transcrições.
import * as api from './api.js';
import { PROVIDERS } from './ai.js';
import { state, settings, applySettings, SPECIALTIES, DEFAULT_CONSENT } from './state.js';
import { $, $$, esc, toast, shell, pageHeader, icon, chip, loading, confirmBox, fmtDate, fmtDateTime } from './ui.js';

const TABS = [['uso', 'Uso'], ['modelos', 'Modelos do sistema'], ['textos', 'Textos padrão'], ['ia', 'Modelos de IA'], ['aviso', 'Aviso geral'], ['pessoas', 'Profissionais'], ['convites', 'Convites'], ['ajuda', 'Textos da Ajuda'], ['registro', 'Registro']];
const KINDS = { sessao: 'Evolução', anamnese: 'Anamnese', periodo: 'Período' };

async function save(key, value) {
  window.__dirty = false; const n = document.getElementById('adm-dirty'); if (n) n.classList.add('hide');
  const old = settings[key] === undefined ? null : settings[key];
  await api.saveSetting(key, value);
  api.addAdminLog('config', key, old, value);
  applySettings(Object.entries({ ...settings, [key]: value }).map(([k, v]) => ({ key: k, value: v })), PROVIDERS);
  toast('Salvo.');
}

export async function renderAdmin() {
  if (!state.profile?.is_admin) { location.hash = '#/painel'; return; }
  const main = shell('admin');
  const tab = new URLSearchParams((location.hash.split('?')[1]) || '').get('aba') || 'uso';
  main.innerHTML = pageHeader('Administração', 'Altere o sistema sem código. Você não vê pacientes nem relatórios.') +
    `<label class="adm-sel-wrap"><span class="sr">Seção</span><select class="adm-sel" id="adm-sel">${TABS.map(([k, l]) => `<option value="${k}" ${k === tab ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div class="adm-tabs">${TABS.map(([k, l]) => `<a class="btn ${k === tab ? '' : 'quiet'} sm" href="#/admin?aba=${k}">${l}</a>`).join('')}</div><div id="adm"></div>`;
  $('#adm-sel').onchange = (e) => { location.hash = '#/admin?aba=' + e.target.value; };
  const box = $('#adm'); loading(box);
  window.__dirty = false;
  let note = document.getElementById('adm-dirty');
  if (!note) { note = document.createElement('div'); note.id = 'adm-dirty'; note.className = 'adm-dirty hide'; note.setAttribute('role', 'status'); note.textContent = 'Alterações não salvas. Toque em Salvar.'; document.body.appendChild(note); }
  const markDirty = () => { window.__dirty = true; note.classList.remove('hide'); };
  box.addEventListener('input', markDirty); box.addEventListener('change', markDirty);
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
        <button class="btn quiet sm" data-edit="${t.id}">${icon('edit')}Editar</button><button class="icon-btn danger" data-del="${t.id}" aria-label="Excluir modelo">${icon('trash')}</button></div>`).join('')}</div></section>`;
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
    const custom = (settings.ai_custom || []).map((c) => ({ ...c }));
    const list = (a) => (a || []).join(', ');
    const draw = () => {
      box.innerHTML = `<section class="panel"><h2>Serviços de IA</h2>
        <p class="muted small">Modelo padrão de cada serviço e outros modelos que o profissional pode escolher (separados por vírgula). Vale na próxima abertura do site.</p>
        <div class="ai-grid">${Object.keys(labels).map((k) => `<div class="ai-card"><h3>${labels[k]}</h3>
          <label class="field">Modelo padrão<input data-m="${k}" value="${esc(PROVIDERS[k].model)}"></label>
          <label class="field">Outros modelos<input data-l="${k}" value="${esc(list((settings.ai_models || {})[k]))}" placeholder="ex.: modelo-a, modelo-b"></label></div>`).join('')}</div>
        <h2 style="margin-top:24px">Outros serviços</h2>
        <p class="muted small">Qualquer serviço compatível com o formato da OpenAI (OpenRouter, Mistral, DeepSeek, Together…). O endereço base termina antes de /chat/completions. O serviço precisa aceitar chamadas vindas do navegador.</p>
        ${custom.map((c, i) => `<div class="ai-card" data-i="${i}"><h3>${esc(c.name || 'Novo serviço')}</h3>
          <input data-f="name" placeholder="Nome (ex.: OpenRouter)" value="${esc(c.name || '')}"><input data-f="base" placeholder="Endereço base (ex.: https://openrouter.ai/api/v1)" value="${esc(c.base || '')}">
          <input data-f="model" placeholder="Modelo padrão" value="${esc(c.model || '')}"><input data-f="models" placeholder="Outros modelos, separados por vírgula" value="${esc(list(c.models))}">
          <input data-f="keyUrl" placeholder="Link para criar a chave (opcional)" value="${esc(c.keyUrl || '')}">
          <button class="btn quiet sm danger" data-rm="${i}">${icon('trash')}Remover serviço</button></div>`).join('')}
        <div class="row" style="margin-top:12px"><button class="btn quiet" id="add">${icon('plus')}Adicionar serviço</button><button class="btn" id="ok">Salvar</button></div></section>`;
      $('#add').onclick = () => { custom.push({ id: 'c' + Date.now().toString(36), name: '', base: '', model: '', models: [] }); draw(); };
      $$('[data-rm]', box).forEach((b) => (b.onclick = () => { custom.splice(+b.dataset.rm, 1); draw(); }));
      box.oninput = (e) => {
        const r = e.target.closest('.ai-card'); if (!r || !e.target.dataset.f) return;
        const c = custom[+r.dataset.i], f = e.target.dataset.f;
        c[f] = f === 'models' ? e.target.value.split(',').map((x) => x.trim()).filter(Boolean) : e.target.value.trim();
      };
      $('#ok').onclick = async () => {
        const csv = (v) => v.split(',').map((x) => x.trim()).filter(Boolean);
        await save('models', Object.fromEntries($$('[data-m]', box).map((i) => [i.dataset.m, i.value.trim()]).filter(([, v]) => v)));
        await save('ai_models', Object.fromEntries($$('[data-l]', box).map((i) => [i.dataset.l, csv(i.value)])));
        await save('ai_custom', custom.filter((c) => c.name && c.base && c.model).map((c) => ({ ...c, base: c.base.replace(/\/+$/, '') })));
      };
    };
    draw();
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
        ${p.id === state.profile.id ? '' : `<button class="btn quiet sm danger" data-mfa="${p.id}" title="Remove o autenticador de quem não consegue entrar">Resetar autenticador</button><button class="btn quiet sm ${p.disabled ? '' : 'danger'}" data-t="${p.id}" data-off="${p.disabled ? '' : '1'}">${p.disabled ? 'Reativar' : 'Desativar'}</button>`}</div>`).join('')}</div></section>`;
    $$('[data-mfa]', box).forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox('Remover o autenticador desta conta? A pessoa volta a entrar só com a senha e pode ativar de novo.', 'Remover autenticador'))) return;
      await api.adminResetMfa(b.dataset.mfa); api.addAdminLog('reset_mfa', b.dataset.mfa); toast('Autenticador removido.');
    }));
    $$('[data-t]', box).forEach((b) => (b.onclick = async () => {
      const off = Boolean(b.dataset.off);
      if (off && !(await confirmBox('Desativar esta conta? A pessoa não consegue mais entrar até você reativar. Os dados dela continuam guardados.', 'Desativar conta'))) return;
      await api.adminSetDisabled(b.dataset.t, off); api.addAdminLog(off ? 'desativar' : 'reativar', b.dataset.t); toast(off ? 'Conta desativada.' : 'Conta reativada.'); renderAdmin();
    }));
  },

  async ajuda(box) {
    const { helpDefaults, resolvedHelp } = await import('./views-help.js');
    const D = helpDefaults(), R = resolvedHelp();
    const attr = (v) => esc(v);
    const field = (key, label, val, def) => `<details class="ht-d"><summary><span>${esc(label)}</span>${val !== def ? chip('Alterado', 'bloom') : ''}</summary>
      <div class="ht-body"><textarea rows="3" data-k="${attr(key)}" data-def="${attr(def)}" aria-label="${attr(label)}">${esc(val)}</textarea>
      <button type="button" class="link small" data-reset="${attr(key)}">Voltar ao original</button></div></details>`;
    const firstHtml = R.FIRST.map(([t, d], n) => field('first|' + t, t, d, D.FIRST[n][1])).join('');
    const topicsHtml = R.TOPICS.map((tp, ti) => `<details class="ht-group"><summary><span>${esc(tp.t)}</span><span class="muted small">${tp.items.length} itens</span></summary>
      ${tp.items.map(([k, v], n) => field(tp.t + '|' + k, k, v, D.TOPICS[ti].items[n][1])).join('')}</details>`).join('');
    box.innerHTML = `<section class="panel"><h2>Textos da Ajuda</h2>
      <p class="muted small">É o que o profissional lê em Ajuda. Abra um grupo, altere o texto e salve. "Voltar ao original" restaura o texto do sistema.</p>
      <details class="ht-group" open><summary><span>Primeiros passos</span><span class="muted small">${R.FIRST.length} passos</span></summary>${firstHtml}</details>
      ${topicsHtml}
      <div class="row" style="margin-top:14px"><button class="btn" id="ok-help">Salvar textos da Ajuda</button></div></section>
      <section class="panel"><h2>Tópicos extras</h2><p class="muted small">Aparecem no fim da página Ajuda, depois dos textos acima.</p><div id="ext"></div></section>`;
    box.onclick = (e) => {
      const b = e.target.closest('[data-reset]'); if (!b) return;
      const ta = box.querySelector(`[data-k="${CSS.escape(b.dataset.reset)}"]`);
      if (ta) { ta.value = ta.dataset.def; ta.dispatchEvent(new Event('input')); }
    };
    $('#ok-help').onclick = async () => {
      const edits = {};
      box.querySelectorAll('textarea[data-k]').forEach((ta) => { const v = ta.value.trim(); if (v && v !== ta.dataset.def) edits[ta.dataset.k] = v; });
      await save('help_edits', edits);
      renderAdmin();
    };
    const rows = Array.isArray(settings.help_extra) ? settings.help_extra.map((x) => ({ ...x })) : [];
    const draw = () => {
      $('#ext').innerHTML = `${rows.map((r, i) => `<div class="ht-item" data-i="${i}"><input data-f="t" placeholder="Título" value="${esc(r.t || '')}"><textarea data-f="text" rows="3" placeholder="Texto">${esc(r.text || '')}</textarea>
          <button class="link small danger" data-rm="${i}">Remover tópico</button></div>`).join('') || '<p class="muted">Nenhum tópico extra ainda.</p>'}
        <div class="row" style="margin-top:12px"><button class="btn quiet" id="add">${icon('plus')}Novo tópico</button><button class="btn" id="ok">Salvar tópicos extras</button></div>`;
      $('#add').onclick = () => { rows.push({ t: '', text: '' }); draw(); };
      $$('[data-rm]', box).forEach((b) => (b.onclick = () => { rows.splice(+b.dataset.rm, 1); draw(); }));
      $('#ok').onclick = () => save('help_extra', rows.filter((r) => r.t && r.t.trim() && r.text && r.text.trim()));
      $('#ext').oninput = (e) => { const r = e.target.closest('.ht-item'); if (r && e.target.dataset.f) rows[+r.dataset.i][e.target.dataset.f] = e.target.value; };
    };
    draw();
  },

  async uso(box) {
    const s = await api.adminStats();
    const card = (n, l) => `<div class="adm-num"><b>${n}</b><span>${l}</span></div>`;
    box.innerHTML = `<section class="panel"><h2>Uso do sistema</h2><p class="muted small">Só totais. Nenhum conteúdo de paciente ou relatório aparece aqui.</p>
      <div class="adm-stats">${card(s.professionals, 'profissionais')}${card(s.new_professionals_30d, 'novos nos últimos 30 dias')}${card(s.patient_accounts, 'pacientes com acesso ao portal')}
      ${card(s.patients, 'pacientes cadastrados')}${card(s.reports, 'relatórios')}${card(s.reports_7d, 'relatórios nos últimos 7 dias')}${card(s.released, 'liberados a pacientes')}${card(s.with_mfa, 'contas com autenticador')}</div>
      <div class="adm-links"><a class="btn quiet sm" href="#/admin?aba=convites">Ver convites</a><a class="btn quiet sm" href="#/admin?aba=pessoas">Ver profissionais</a><a class="btn quiet sm" href="#/admin?aba=registro">Ver registro</a></div></section>`;
  },

  async convites(box) {
    const req = settings.invite_required === true, list = await api.listInvites();
    box.innerHTML = `<section class="panel"><h2>Convites para profissionais</h2>
      <p class="muted small">Com a exigência ligada, só se cadastra como profissional quem tiver um código seu (cada código vale uma vez). Desligada, qualquer pessoa pode se cadastrar.</p>
      <label class="check"><input type="checkbox" id="req" ${req ? 'checked' : ''}> Exigir código de convite no cadastro de profissionais</label>
      <div class="row" style="margin:14px 0"><input id="note" placeholder="Para quem é (opcional)" style="max-width:260px"><button class="btn" id="gen">${icon('plus')}Gerar código</button></div>
      <div class="list">${list.map((i) => `<div class="li"><div class="grow"><div class="t"><code>${esc(i.code)}</code> ${i.used_by ? chip('Usado', 'ok') : i.active ? chip('Disponível', 'petrol') : chip('Cancelado')}</div>
        <div class="muted small">${esc(i.note || 'Sem observação')} · criado em ${esc(fmtDate(i.created_at))}${i.used_at ? ' · usado em ' + esc(fmtDate(i.used_at)) : ''}</div></div>
        ${i.used_by ? '' : `<button class="btn quiet sm ${i.active ? 'danger' : ''}" data-c="${i.code}" data-a="${i.active ? '' : '1'}">${i.active ? 'Cancelar' : 'Reativar'}</button>`}</div>`).join('') || '<p class="muted">Nenhum código ainda.</p>'}</div></section>`;
    $('#req').onchange = (e) => save('invite_required', e.target.checked);
    $('#gen').onclick = async () => {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 32]).join('');
      await api.createInvite(code, $('#note').value.trim() || null); api.addAdminLog('convite', code); toast('Código gerado: ' + code); renderAdmin();
    };
    $$('[data-c]', box).forEach((b) => (b.onclick = async () => { const on = Boolean(b.dataset.a); await api.setInviteActive(b.dataset.c, on); api.addAdminLog(on ? 'reativar_convite' : 'cancelar_convite', b.dataset.c); renderAdmin(); }));
  },

  async registro(box) {
    const log = await api.listAdminLog();
    const NAMES = { config: 'Alterou configuração', reset_mfa: 'Resetou autenticador', desativar: 'Desativou conta', reativar: 'Reativou conta', convite: 'Gerou convite', cancelar_convite: 'Cancelou convite', reativar_convite: 'Reativou convite', desfazer: 'Desfez uma ação' };
    const UNDO = ['config', 'desativar', 'reativar', 'cancelar_convite'];
    box.innerHTML = `<section class="panel"><h2>Registro de ações</h2><p class="muted small">As 60 mudanças mais recentes. Em alterações de configuração, "Desfazer" volta ao valor anterior.</p>
      <div class="list">${log.map((l) => `<div class="li"><div class="grow"><div class="t">${esc(NAMES[l.action] || l.action)} ${l.target ? `<code>${esc(String(l.target).slice(0, 40))}</code>` : ''}</div>
        <div class="muted small">${esc(fmtDateTime(l.at))}</div></div>${UNDO.includes(l.action) ? `<button class="btn quiet sm" data-u="${l.id}">Desfazer</button>` : ''}</div>`).join('') || '<p class="muted">Nada registrado ainda.</p>'}</div></section>`;
    const by = Object.fromEntries(log.map((l) => [l.id, l]));
    $$('[data-u]', box).forEach((b) => (b.onclick = async () => {
      const l = by[b.dataset.u];
      const what = { config: `Voltar "${l.target}" ao valor anterior?`, desativar: 'Reativar esta conta?', reativar: 'Desativar esta conta de novo?', cancelar_convite: 'Reativar este convite?' }[l.action];
      if (!(await confirmBox(what, 'Desfazer'))) return;
      if (l.action === 'config') await save(l.target, l.old_value === null ? (typeof settings[l.target] === 'boolean' ? false : '') : l.old_value);
      else if (l.action === 'desativar') await api.adminSetDisabled(l.target, false);
      else if (l.action === 'reativar') await api.adminSetDisabled(l.target, true);
      else if (l.action === 'cancelar_convite') await api.setInviteActive(l.target, true);
      api.addAdminLog('desfazer', l.target); toast('Desfeito.'); renderAdmin();
    }));
  },
};
