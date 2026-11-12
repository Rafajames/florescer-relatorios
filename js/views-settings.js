import * as api from './api.js';
import * as ai from './ai.js';
import { state, SPECIALTIES, DEFAULT_CONSENT } from './state.js';
import { DEFAULT_PREFS, getPrefs } from './prefs.js';
import { brandOf, applyBrand, rememberBrand, imageToDataUrl, PALETTES, slugify, CONTACT_FIELDS, contactOf } from './brand.js';
import { setTemplateDraft } from './views-template-editor.js';
import { connectorHtml, bindConnector } from './ai-connect.js';
import { importTemplate } from './import-template.js';
import { getLook, setLook } from './theme.js';
import { COUNCILS, UFS, registryText, cleanUrl } from './credentials.js';
import {
  $, $$, esc, fmtDateTime, todayISO, toast, openModal, confirmBox, busy, chip, callout, shell, loading, pageHeader, icon, dropzone, bindDrops, emptyState,
} from './ui.js';

/* =====================================================================
   CONFIGURAÇÕES
   ===================================================================== */
const ALL_TABS = [
  ['perfil', 'Perfil e timbre'], ['aparencia', 'Aparência e marca'], ['preferencias', 'Preferências'], ['chaves', 'Chaves de IA'],
  ['consentimento', 'Consentimento'], ['seguranca', 'Segurança'], ['dados', 'Dados e privacidade'],
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
  const adm = Boolean(state.profile.is_admin); // o administrador só usa a segurança da conta
  const TABS = adm ? ALL_TABS.filter(([k]) => k === 'seguranca') : ALL_TABS;
  const tab = TABS.some(([k]) => k === params.get('aba')) ? params.get('aba') : TABS[0][0];
  main.innerHTML = pageHeader('Configurações', 'Ajuste o sistema ao seu jeito de trabalhar.', `<a class="btn quiet" href="#/ajuda">${icon('info')}Ajuda</a><button class="btn quiet" data-logout>${icon('logout')}Sair da conta</button>`) + `
    <div class="settings">
      <nav class="subnav" aria-label="Seções">${TABS.map(([k, l]) => `<a href="#/config?aba=${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>
      <div id="pane"></div>
    </div>`;
  const pane = $('#pane');
  const p = state.profile;
  const saveProfile = async (patch) => { state.profile = await api.updateProfile(p.id, patch); };
  const savePrefs = (changes) => saveProfile({ preferences: { ...getPrefs(), ...changes } });

  if (tab === 'perfil') {
    const cr = p.credentials || {};
    pane.innerHTML = `
      <section class="panel"><h2>Perfil e timbre</h2>
        <p class="muted">Estas informações aparecem no topo dos relatórios e nas exportações.</p>
        <form id="prof">
          <div class="grid2">
            <label class="field">Nome completo<input name="full_name" required value="${esc(p.full_name)}"></label>
            <label class="field">Área de atuação<select name="specialty">${SPECIALTIES.map((s) => `<option ${s === p.specialty ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
            <label class="field">Nome do consultório ou clínica<input name="clinic_name" value="${esc(p.clinic_name || '')}"></label>
            <label class="field">Categoria ou especialidade<input name="category" value="${esc(cr.category || '')}" placeholder="Ex.: Psicóloga clínica, Fisioterapeuta neurofuncional"></label>
          </div>
          <h3 style="margin:6px 0 4px">Registro no conselho</h3>
          <p class="muted small" style="margin-bottom:8px">Aparece para seus pacientes no portal e nos documentos. É informado por você; o sistema não confere junto ao conselho.</p>
          <div class="grid3">
            <label class="field">Conselho<select name="council">${COUNCILS.map((c) => `<option ${c === (cr.council || '') ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
            <label class="field">Número<input name="number" value="${esc(cr.number || '')}" placeholder="Ex.: 12345"></label>
            <label class="field">Estado (UF)<select name="uf"><option value=""></option>${UFS.map((u) => `<option ${u === (cr.uf || '') ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
          </div>
          <h3 style="margin:6px 0 4px">Redes sociais e site (opcional)</h3>
          <div class="grid3">
            <label class="field">Instagram<input name="instagram" value="${esc(cr.instagram || '')}" placeholder="instagram.com/seuperfil"></label>
            <label class="field">Site<input name="site" value="${esc(cr.site || '')}" placeholder="www.seusite.com.br"></label>
            <label class="field">Outra rede<input name="other" value="${esc(cr.other || '')}" placeholder="linkedin.com/in/..."></label>
          </div>
          <h3 style="margin:6px 0 8px">Prévia do timbre</h3>
          <div class="letterhead" id="lh" style="margin-bottom:16px"></div>
          <button class="btn" type="submit">Salvar perfil</button>
        </form></section>`;
    const lh = () => {
      const f = new FormData($('#prof'));
      const reg = [f.get('specialty'), registryText({ council: f.get('council'), uf: f.get('uf'), number: (f.get('number') || '').trim() })].filter(Boolean).join(', ');
      $('#lh').innerHTML = `<b>${esc(f.get('clinic_name') || f.get('full_name') || '')}</b><span>${esc(f.get('full_name') || '')}${reg ? ', ' + esc(reg) : ''}</span>`;
    };
    lh(); $('#prof').oninput = lh;
    $('#prof').onsubmit = (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      return busy(e.target.querySelector('[type=submit]'), 'Salvando…', async () => {
        const g = (n) => (f.get(n) || '').trim();
        const bad = ['instagram', 'site', 'other'].filter((n) => g(n) && !cleanUrl(g(n)));
        if (bad.length) throw new Error('Confira o endereço digitado em Redes sociais e site. Use algo como instagram.com/seuperfil.');
        const credentials = { council: g('council'), number: g('number'), uf: g('uf'), category: g('category'), instagram: cleanUrl(g('instagram')), site: cleanUrl(g('site')), other: cleanUrl(g('other')) };
        await saveProfile({ full_name: g('full_name'), specialty: f.get('specialty'), council_registry: registryText(credentials) || null, credentials, clinic_name: g('clinic_name') || null });
        toast('Perfil salvo.');
      });
    };
  }

  if (tab === 'aparencia') {
    const pub = (p.branding && p.branding.public) || {};
    const b = brandOf(p);
    const draft = { ...b };
    const base = location.origin + location.pathname;
    const look = getLook();
    const segHtml = (name, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${look[name] === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    pane.innerHTML = `
      <section class="panel"><h2>Conforto de leitura neste aparelho</h2>
        <p class="muted">Vale só para este navegador. Não muda a marca nem os documentos.</p>
        <div class="grid2">
          <div class="field">Tema${segHtml('theme', [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']])}</div>
          <div class="field">Tamanho da letra${segHtml('size', [['normal', 'Normal'], ['lg', 'Grande'], ['xl', 'Extra']])}</div>
        </div>
        <label class="check"><input type="checkbox" id="hc" ${look.contrast === 'high' ? 'checked' : ''}><span>Alto contraste e foco bem visível<small>Bordas e textos mais fortes, ajuda quem usa o teclado.</small></span></label>
      </section>
      <form id="bf">
      <section class="panel"><h2>Aparência e marca</h2>
        <p class="muted">A plataforma passa a ter a sua cara: logo, cores e nome aparecem no menu, na tela de login e nos documentos.</p>
        <div class="grid2">
          <label class="field">Nome que aparece na plataforma<input name="org_name" value="${esc(draft.org_name)}" placeholder="Ex.: Espaço Florescer"></label>
          <label class="field">Frase da tela de login<input name="tagline" value="${esc(draft.tagline)}" placeholder="Ex.: Cuidado com escuta e ciência."></label>
        </div>
        <div class="grid2">
          <div class="field">Logo
            <div class="logo-pick"><span class="logo-box" id="logo-box"></span>
              <div class="grow">${dropzone({ id: 'logo-file', accept: 'image/*', title: 'Enviar logo', hint: 'Arraste a imagem para cá ou clique.' })}</div>
              <button type="button" class="link" id="logo-rm">Remover logo</button></div>
            <small>PNG com fundo transparente fica melhor. A imagem é reduzida automaticamente.</small></div>
          <div class="field">Assinatura ou carimbo (opcional)
            <div class="logo-pick"><span class="logo-box" id="sig-box"></span>
              <div class="grow">${dropzone({ id: 'sig-file', accept: 'image/*', title: 'Enviar assinatura', hint: 'Arraste a imagem para cá ou clique.' })}</div>
              <button type="button" class="link" id="sig-rm">Remover</button></div>
            <small>Aparece acima do seu nome no fim dos documentos.</small></div>
        </div>
        <div class="field">Cores
          <div class="swatches">${PALETTES.map((pl, i) => `<label class="swatch" title="${esc(pl.name)}"><input type="radio" name="pal" value="${i}" ${pl.color === draft.color && pl.accent === draft.accent ? 'checked' : ''}><span style="background:linear-gradient(135deg,${pl.color} 55%,${pl.accent} 55%)"></span></label>`).join('')}</div>
          <div class="row" style="margin-top:8px">
            <label class="small">Cor principal <input type="color" name="color" value="${esc(draft.color)}" style="width:52px;min-height:34px;padding:2px;margin:0 0 0 4px"></label>
            <label class="small">Cor de destaque <input type="color" name="accent" value="${esc(draft.accent)}" style="width:52px;min-height:34px;padding:2px;margin:0 0 0 4px"></label></div></div>
        <fieldset class="field" style="border:0;padding:0;margin:0"><legend style="font-weight:600;margin-bottom:6px">Contato no rodapé dos documentos</legend>
          <div class="grid2">${CONTACT_FIELDS.map(([k, l]) => `<label class="field">${l}<input name="c_${k}" value="${esc(contactOf(draft)[k] || '')}"></label>`).join('')}</div>
          <small class="muted">Cada campo aparece separado no rodapé do PDF e do Word. Deixe vazio o que não quiser mostrar.</small></fieldset>
        <label class="field">Outras informações no rodapé (opcional)<textarea name="footer" rows="2" placeholder="Ex.: CNPJ, horário de atendimento">${esc(draft.footer)}</textarea></label>
      </section>
      <section class="panel"><h2>Estilo dos documentos</h2>
        <p class="muted">Vale para o PDF e o Word. Veja o resultado em “Exportar PDF” (há uma prévia antes de imprimir).</p>
        <div class="grid2">
          <label class="field">Tipo de letra<select name="doc_font">${[['moderna', 'Moderna (sem serifa)'], ['classica', 'Clássica (com serifa)']].map(([v, l]) => `<option value="${v}" ${(b.doc_font || 'moderna') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">Margem da página<select name="doc_margin">${[['estreita', 'Estreita'], ['normal', 'Normal'], ['ampla', 'Ampla']].map(([v, l]) => `<option value="${v}" ${(b.doc_margin || 'normal') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <label class="field">Cabeçalho<select name="doc_header">${[['side', 'Logo ao lado do nome, alinhado à esquerda'], ['center', 'Centralizado']].map(([v, l]) => `<option value="${v}" ${(b.doc_header || 'side') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </section>
      <section class="panel"><h2>Seu link próprio</h2>
        <p class="muted">Quem abrir este link vê a tela de login com a sua marca. Mande aos seus pacientes.</p>
        <label class="field">Endereço<div class="row" style="flex-wrap:nowrap"><span class="muted small" style="white-space:nowrap">${esc(base)}#/c/</span><input name="slug" value="${esc(b.slug)}" placeholder="meu-consultorio" style="margin:0" pattern="[a-z0-9\\-]{3,40}"></div>
          <small>Só letras minúsculas, números e hífen (3 a 40 caracteres).</small></label>
        <p class="small" id="slug-link"></p>
      </section>
      <section class="panel"><h2>Página pública de apresentação</h2>
        <p class="muted">Uma página simples com a sua apresentação e um botão de WhatsApp, para divulgar. Usa o endereço do seu link próprio.</p>
        <label class="check"><input type="checkbox" name="pub_on" ${pub.on ? 'checked' : ''}> Publicar minha página de apresentação</label>
        <label class="field">Apresentação<textarea name="pub_bio" rows="4" maxlength="1200" placeholder="Quem você é, como trabalha, para quem atende.">${esc(pub.bio || '')}</textarea></label>
        <label class="field">Áreas de atuação (uma por linha)<textarea name="pub_areas" rows="3" maxlength="600" placeholder="Ex.: Integração sensorial&#10;Atraso no desenvolvimento">${esc((pub.areas || []).join('\n'))}</textarea></label>
        <div class="grid2">
          <label class="field">WhatsApp para contato<input name="pub_whats" value="${esc(pub.whatsapp || '')}" placeholder="(00) 00000-0000"></label>
          <label class="field">Cidade e forma de atendimento<input name="pub_city" value="${esc(pub.city || '')}" maxlength="100" placeholder="Ex.: Boa Vista/RR · presencial e online"></label>
        </div>
        <p class="small" id="pub-link"></p>
      </section>
      <section class="panel"><h2>Prévia</h2>
        <div class="brand-preview" id="prev"></div>
        <div class="row" style="margin-top:14px"><button class="btn" type="submit">Salvar aparência</button><button type="button" class="link" id="brand-reset">Voltar ao padrão da Potira</button></div>
      </section></form>`;
    $$('input[name=theme],input[name=size]', pane).forEach((i) => (i.onchange = () => setLook({ [i.name]: i.value })));
    $('#hc').onchange = (e) => setLook({ contrast: e.target.checked ? 'high' : 'normal' });
    const f = $('#bf');
    const el = (n) => f.elements[n];
    const pubDraft = () => ({ on: el('pub_on').checked, bio: el('pub_bio').value.trim(), areas: el('pub_areas').value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12),
      whatsapp: el('pub_whats').value.trim(), city: el('pub_city').value.trim() });
    const img = (id, src) => { $(id).innerHTML = src ? `<img src="${src}" alt="">` : '<span class="muted small">Sem imagem</span>'; };
    const paint = () => {
      draft.org_name = el('org_name').value.trim(); draft.tagline = el('tagline').value.trim(); draft.footer = el('footer').value.trim();
      draft.color = el('color').value; draft.accent = el('accent').value;
      draft.contact = Object.fromEntries(CONTACT_FIELDS.map(([k]) => [k, el('c_' + k).value.trim()]));
      img('#logo-box', draft.logo); img('#sig-box', draft.signature);
      applyBrand(draft);
      const slug = el('slug').value.trim();
      $('#pub-link').innerHTML = !el('pub_on').checked ? '' : slug ? `Sua página: <a href="${esc(base)}#/p/${esc(slugify(slug))}" target="_blank" rel="noopener">${esc(base)}#/p/${esc(slugify(slug))}</a> (vale depois de salvar)` : 'Defina o endereço em “Seu link próprio” para a página funcionar.';
      $('#slug-link').innerHTML = slug ? `Seu link: <a href="${esc(base)}#/c/${esc(slug)}" target="_blank" rel="noopener">${esc(base)}#/c/${esc(slug)}</a>` : '';
      $('#prev').innerHTML = `
        <div class="prev-login" style="background:${esc(draft.color)}">${draft.logo ? `<span class="mark has-logo"><img src="${draft.logo}" alt=""></span>` : ''}
          <b>${esc(draft.org_name || p.full_name)}</b><span>${esc(draft.tagline || 'Acesse sua área.')}</span><i style="background:${esc(draft.accent)}">Entrar</i></div>
        <div class="letterhead" style="border-bottom-color:${esc(draft.color)}">${draft.logo ? `<img class="lh-logo" src="${draft.logo}" alt="">` : ''}<div><b style="color:${esc(draft.color)}">${esc(draft.org_name || p.clinic_name || p.full_name)}</b><span>${esc(p.full_name)}${p.council_registry ? ', ' + esc(p.council_registry) : ''}</span></div></div>`;
    };
    f.oninput = paint;
    $$('input[name=pal]', f).forEach((r) => (r.onchange = () => { const pl = PALETTES[+r.value]; el('color').value = pl.color; el('accent').value = pl.accent; paint(); }));
    const pick = (inputId, key, max) => { $(inputId).onchange = async (e) => { try { draft[key] = await imageToDataUrl(e.target.files[0], { max }); paint(); } catch (err) { toast(err.message, 'err'); } e.target.value = ''; }; };
    pick('#logo-file', 'logo', 400); pick('#sig-file', 'signature', 300); bindDrops(f, null, { preview: false });
    $('#logo-rm').onclick = () => { draft.logo = ''; paint(); };
    $('#sig-rm').onclick = () => { draft.signature = ''; paint(); };
    $('#brand-reset').onclick = async () => {
      if (!(await confirmBox('Remover logo, cores e textos personalizados?', 'Voltar ao padrão'))) return;
      // volta só a aparência ao padrão; dados de pagamento, convênios e sequência de recibos ficam
      const manter = Object.fromEntries(Object.entries(state.profile.branding || {}).filter(([k]) => ['payment', 'insurers', 'recibo_seq', 'charge_absence'].includes(k)));
      await saveProfile({ branding: manter, slug: null }); const nb = brandOf(state.profile); applyBrand(nb); rememberBrand(nb); toast('Aparência restaurada.'); renderSettings(params);
    };
    f.onsubmit = (e) => {
      e.preventDefault(); paint();
      const slug = slugify(el('slug').value);
      if (el('slug').value.trim() && (slug.length < 3)) return toast('O endereço precisa ter ao menos 3 caracteres.', 'err');
      if (el('pub_on').checked && !slug) return toast('Para publicar a página, defina o endereço em “Seu link próprio”.', 'err');
      return busy($('[type=submit]', f), 'Salvando…', async () => {
        await saveProfile({
          clinic_name: draft.org_name || p.clinic_name, slug: slug || null,
          branding: { ...(state.profile.branding || {}), public: pubDraft(), org_name: draft.org_name, tagline: draft.tagline, logo: draft.logo, signature: draft.signature, color: draft.color, accent: draft.accent, footer: draft.footer, contact: draft.contact, doc_font: el('doc_font').value, doc_margin: el('doc_margin').value, doc_header: el('doc_header').value },
        });
        const nb = brandOf(state.profile); applyBrand(nb); rememberBrand(nb);
        toast('Aparência salva.'); renderSettings(params);
      });
    };
    paint();
  }

  if (tab === 'preferencias') {
    const pr = getPrefs();
    const tpls = api.templatesForMe(await api.listTemplates(), state.profile).filter((t) => t.kind === 'sessao');
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
    const have = Object.keys(ai.PROVIDERS).filter((id) => keys[id]);
    const textOpts = have.filter((id) => ai.PROVIDERS[id].text), sttOpts = have.filter((id) => ai.PROVIDERS[id].stt);
    pane.innerHTML = `
      <section class="panel"><h2>Inteligência artificial</h2>
        ${callout('<p>A IA é <b>opcional</b>. Sem ela, você grava ou digita a sessão e escreve o relatório no editor. As chaves ficam guardadas só neste navegador e <b>nunca</b> vão para o banco. O texto das sessões (sem o nome do paciente) é enviado ao provedor escolhido; informe isso no consentimento.</p>')}
        <h3 style="margin:14px 0 8px">Conectadas neste navegador</h3>
        ${have.length ? `<div class="list">${have.map((id) => `<div class="li"><div class="grow"><div class="t">${esc(ai.PROVIDERS[id].label)} ${ai.PROVIDERS[id].free ? chip('Gratuito', 'ok') : ''}</div></div><button class="btn quiet sm" data-rm="${id}">Remover</button></div>`).join('')}</div>` : '<p class="muted">Nenhuma IA conectada. O sistema está no modo manual.</p>'}
        ${have.length ? `<div class="grid2" style="margin-top:14px">
          <label class="field">Escrever relatórios com<select id="sel-text">${textOpts.map((id) => `<option value="${id}" ${ai.textProvider() === id ? 'selected' : ''}>${esc(ai.PROVIDERS[id].label)}</option>`).join('')}</select></label>
          <label class="field">Transcrever áudio com<select id="sel-stt">${sttOpts.length ? sttOpts.map((id) => `<option value="${id}" ${ai.sttProvider() === id ? 'selected' : ''}>${esc(ai.PROVIDERS[id].label)}</option>`).join('') : '<option value="">Conecte Groq ou OpenAI</option>'}</select>
            <small>Sem isso, a gravação usa a transcrição ao vivo do navegador (Chrome ou Edge), que é grátis.</small></label></div>` : ''}
      </section>
      <section class="panel"><h2>Conectar uma IA</h2><div id="conn">${connectorHtml('gemini')}</div></section>
      ${have.length ? '<section class="panel flat"><button class="btn danger sm" id="clear-keys">Remover todas as chaves deste computador</button></section>' : ''}`;
    bindConnector($('#conn'), { onSaved: () => renderSettings(params) });
    $$('[data-rm]').forEach((bt) => (bt.onclick = () => {
      const k = ai.getKeys(); delete k[bt.dataset.rm];
      if (k.textProvider === bt.dataset.rm) delete k.textProvider;
      if (k.sttProvider === bt.dataset.rm) delete k.sttProvider;
      ai.setKeys(k); toast('Chave removida.'); renderSettings(params);
    }));
    if ($('#sel-text')) $('#sel-text').onchange = (e) => { ai.setKeys({ ...ai.getKeys(), textProvider: e.target.value }); toast('Salvo.'); };
    if ($('#sel-stt')) $('#sel-stt').onchange = (e) => { ai.setKeys({ ...ai.getKeys(), sttProvider: e.target.value }); toast('Salvo.'); };
    if ($('#clear-keys')) $('#clear-keys').onclick = async () => {
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

  if (tab === 'seguranca') {
    const fs = await api.mfaFactors(), on = fs.find((f) => f.status === 'verified');
    pane.innerHTML = `<section class="panel"><h2>Autenticador no login</h2>
      <p class="muted">Proteção extra: além da senha, o login pede um código de 6 dígitos de um aplicativo (Google Authenticator, Authy, Microsoft Authenticator). É opcional e vale só para a sua conta.</p>
      ${on ? `<p>${chip('Ativado', 'ok')}</p><p class="muted small">Se perder o celular, use "Perdi meu autenticador" na tela de login (link por e-mail) ou peça ao administrador.</p><button class="btn quiet" id="mfa-off">Desativar autenticador</button>`
        : '<p>' + chip('Desativado', '') + '</p><button class="btn" id="mfa-on">Ativar autenticador</button>'}
      <div id="mfa-box"></div></section>`;
    const off = $('#mfa-off');
    if (off) off.onclick = async () => {
      if (!(await confirmBox('Desativar o autenticador? O login volta a pedir só a senha.', 'Desativar'))) return;
      await api.mfaUnenroll(on.id); toast('Autenticador desativado.'); renderSettings(params);
    };
    const act = $('#mfa-on');
    if (act) act.onclick = async (e) => {
      for (const f of fs) { try { await api.mfaUnenroll(f.id); } catch { /* resto de tentativa anterior */ } }
      const en = await api.mfaEnroll();
      $('#mfa-box').innerHTML = `<ol class="mfa-steps">
        <li><b>Instale um aplicativo</b><span>Google Authenticator, Microsoft Authenticator ou Authy. São gratuitos.</span></li>
        <li><b>Adicione esta conta</b><span>No aplicativo, toque em "+" e depois em "Ler QR code". Escaneie o código abaixo.</span>
          <img alt="QR code do autenticador" src="${en.totp.qr_code}" class="mfa-qr">
          <span class="muted small">Sem câmera? Digite esta chave no aplicativo: <code>${esc(en.totp.secret)}</code></span></li>
        <li><b>Confirme com o código</b><span>O aplicativo mostra um código de 6 dígitos que muda a cada 30 segundos.</span>
          <div class="row"><input id="mfa-c" inputmode="numeric" maxlength="7" placeholder="000000" autocomplete="one-time-code" style="max-width:150px"><button class="btn" id="mfa-ok">Confirmar e ativar</button></div></li>
      </ol>`;
      e.currentTarget.classList.add('hide');
      $('#mfa-ok').onclick = (b) => busy(b.currentTarget, 'Verificando…', async () => {
        try { await api.mfaVerify(en.id, $('#mfa-c').value); } catch { throw new Error('Código incorreto. Confira o aplicativo e tente de novo.'); }
        toast('Autenticador ativado.'); renderSettings(params);
      });
    };
  }

  if (tab === 'dados') {
    pane.innerHTML = `
      <section class="panel" id="pasta-box"></section>
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
    // Pasta dos documentos neste computador (Chrome ou Edge no computador)
    const drawPasta = async () => {
      const pasta = await import('./pasta.js');
      const box = $('#pasta-box');
      if (!pasta.suportada()) {
        box.innerHTML = `<h2>Pasta dos documentos neste computador</h2><p class="muted">Este navegador não permite que a plataforma grave em uma pasta. Use o Chrome ou o Edge no computador. Aqui, os arquivos continuam sendo baixados normalmente.</p>`;
        return;
      }
      const st = await pasta.estado(); const h = await pasta.raiz();
      box.innerHTML = `<h2>Pasta dos documentos neste computador</h2>
        <p class="muted">Escolha uma pasta e a plataforma cria uma subpasta por paciente (Relatórios, Recibos, Cobranças, Laudos e exames). Os arquivos em Word e os laudos e exames anexados vão direto para lá. O PDF sai pela janela de impressão: a pasta do paciente já fica criada para você salvar nela.</p>
        <p class="small">${st === 'sem' ? 'Nenhuma pasta escolhida.' : `Pasta: <b>${esc(h.name)}</b> ${st === 'ok' ? chip('Liberada', 'ok') : chip('Precisa liberar o acesso', 'warn')}`}</p>
        <div class="row">
          ${st === 'pedir' ? `<button class="btn" id="pasta-lib">Liberar acesso à pasta</button>` : ''}
          <button class="btn ${st === 'sem' ? '' : 'quiet'}" id="pasta-esc">${icon('plus')}${st === 'sem' ? 'Escolher pasta' : 'Trocar de pasta'}</button>
          ${st !== 'sem' ? '<button class="btn quiet" id="pasta-esq">Deixar de usar a pasta</button>' : ''}
        </div>
        <p class="muted small">Os arquivos ficam só neste computador. A plataforma não guarda cópia; faça backup da pasta (ou escolha uma pasta dentro do OneDrive ou do Google Drive). Vale só para este navegador.</p>`;
      $('#pasta-esc').onclick = async () => { try { const n = await pasta.escolher(); if (n) { toast(`Pasta "${n}" escolhida.`); drawPasta(); } } catch (err) { toast(err.message || String(err), 'err'); } };
      if ($('#pasta-lib')) $('#pasta-lib').onclick = async () => { if (await pasta.liberar()) toast('Acesso liberado.'); else toast('O navegador não liberou o acesso.', 'err'); drawPasta(); };
      if ($('#pasta-esq')) $('#pasta-esq').onclick = async () => { await pasta.esquecer(); toast('A plataforma deixou de usar a pasta. Os arquivos continuam no computador.'); drawPasta(); };
    };
    drawPasta().catch(() => { const box = $('#pasta-box'); if (box) box.remove(); });
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
const TYPES = [['longo', 'Texto longo'], ['curto', 'Texto curto'], ['data', 'Data'], ['marcar', 'Sim ou não'], ['escolha', 'Escolha']];
const KINDS = { sessao: 'Evolução', anamnese: 'Anamnese', periodo: 'Período' };

export async function templateModal(t = {}) {
  let rows = (t.sections || [{ title: '', hint: '', type: 'longo' }]).map((s) => ({ type: 'longo', ...s }));
  const heading = t.imported ? 'Revisar modelo importado' : t.id && (t.professional_id || t.sys) ? 'Editar modelo' : 'Novo modelo';
  return openModal(heading, `
    ${t.imported ? `<div class="callout ok">${icon('info')}<div class="grow"><p>Importado de <b>${esc(t.imported.source)}</b>${t.imported.usedAI ? ' com ajuda da IA' : ' por leitura automática'}. Confira os campos, ajuste os tipos e acrescente o que faltar.</p></div></div>` : ''}
    <label class="field">Nome do modelo<input name="name" required value="${esc(t.name || '')}"></label>
    <div class="grid2">
      <label class="field">Área<select name="specialty">${['Geral', ...SPECIALTIES].map((s) => `<option ${s === (t.specialty || state.profile.specialty) ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="field">Usar para<select name="kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}" ${(t.kind || 'sessao') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="field" style="margin-bottom:6px">Campos do documento<small>O título vira o cabeçalho do campo. A orientação diz à IA o que escrever ali. O tipo muda como o campo aparece no editor.</small></div>
    <div id="rows"></div>
    <button type="button" class="btn quiet sm" id="addrow">${icon('plus')}Adicionar campo</button>`,
  {
    wide: true,
    onOpen: (d) => {
      const draw = () => {
        $('#rows', d).innerHTML = rows.map((r, i) => `
          <div class="sec-edit tpl-row" data-i="${i}">
            <input data-f="title" placeholder="Título do campo" value="${esc(r.title)}" aria-label="Título">
            <select data-f="type" aria-label="Tipo do campo">${TYPES.map(([v, l]) => `<option value="${v}" ${(r.type || 'longo') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
            <div class="row"><button type="button" class="icon-btn" data-a="up" title="Subir" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
              <button type="button" class="icon-btn" data-a="down" title="Descer" ${i === rows.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
              <button type="button" class="icon-btn" data-a="rm" title="Remover">${icon('trash')}</button></div>
            <input data-f="hint" class="tpl-hint" placeholder="Orientação para a IA (opcional)" value="${esc(r.hint || '')}" aria-label="Orientação">
            ${r.type === 'escolha' ? `<input data-f="options" class="tpl-hint" placeholder="Opções separadas por vírgula" value="${esc((r.options || []).join(', '))}" aria-label="Opções">` : ''}
          </div>`).join('');
      };
      draw();
      $('#rows', d).addEventListener('input', (e) => {
        const row = e.target.closest('.sec-edit'); if (!row) return;
        const f = e.target.dataset.f, r = rows[+row.dataset.i];
        if (f === 'options') r.options = e.target.value.split(',').map((x) => x.trim()).filter(Boolean); else r[f] = e.target.value;
      });
      $('#rows', d).addEventListener('change', (e) => { if (e.target.dataset.f === 'type') draw(); });
      $('#rows', d).addEventListener('click', (e) => {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const i = +b.closest('.sec-edit').dataset.i;
        if (b.dataset.a === 'up' && i > 0) [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
        if (b.dataset.a === 'down' && i < rows.length - 1) [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]];
        if (b.dataset.a === 'rm') rows.splice(i, 1);
        draw();
      });
      $('#addrow', d).onclick = () => { rows.push({ title: '', hint: '', type: 'longo' }); draw(); };
    },
    onOk: (d) => {
      const g = (n) => d.querySelector(`[name=${n}]`).value.trim();
      const sections = rows.map((r) => ({
        title: (r.title || '').trim(), hint: (r.hint || '').trim(), type: r.type || 'longo',
        ...(r.type === 'escolha' && r.options?.length ? { options: r.options } : {}),
      })).filter((r) => r.title);
      if (!sections.length) throw new Error('Informe ao menos um campo com título.');
      const meta = t.imported ? { source: t.imported.source, ai: t.imported.usedAI } : (t.meta || {});
      return api.saveTemplate({ ...(t.id && (t.professional_id || t.sys) ? { id: t.id } : {}), ...(t.sys ? { professional_id: null } : {}), name: g('name'), specialty: g('specialty'), kind: g('kind'), sections, meta });
    },
  });
}

export async function renderTemplates() {
  const main = shell('modelos'); loading(main);
  const list = api.templatesForMe(await api.listTemplates(), state.profile);
  const prefs = getPrefs();
  const padrao = new Set([prefs.defaultTemplateId, prefs.defaultAnamneseTemplateId].filter(Boolean));
  // Os tipos de documento vêm primeiro; cada modelo é um cartão curto. Os campos ficam para quem abrir o modelo.
  const TIPOS = [['anamnese', 'Anamnese', 'clipboard', 'Entrevista inicial'], ['sessao', 'Evolução', 'mic', 'Registro de cada sessão'],
    ['periodo', 'Relatório por período', 'calendar', 'Resumo de várias sessões']];
  const doTipo = (k) => list.filter((t) => (t.kind || 'sessao') === k);
  const card = (t) => {
    const meu = Boolean(t.professional_id);
    return `<article class="tpl-card ${meu ? 'meu' : ''}">
      <button type="button" class="tpl-open" data-open="${t.id}" aria-label="Abrir o modelo ${esc(t.name)}">
        <b>${esc(t.name)}</b>
        <span class="tpl-sub">${t.sections.length} campo${t.sections.length === 1 ? '' : 's'}${t.specialty ? ' · ' + esc(t.specialty) : ''}</span>
        <span class="tpl-chips">${meu ? chip('Meu', 'bloom') : chip('Da Potira')}${padrao.has(t.id) ? chip('Padrão', 'ok') : ''}${t.meta?.layout ? chip('Com timbre', 'petrol') : ''}</span>
      </button>
      ${meu ? `<button class="icon-btn tpl-del" data-del="${t.id}" title="Excluir modelo" aria-label="Excluir o modelo ${esc(t.name)}">${icon('trash')}</button>` : ''}</article>`;
  };
  const grupo = ([k, nome, ic, sub]) => {
    const ts = doTipo(k).sort((x, y) => Boolean(y.professional_id) - Boolean(x.professional_id) || x.name.localeCompare(y.name));
    return `<section class="tpl-grupo" data-tipo="${k}">
      <div class="tpl-tipo"><span class="tpl-ic">${icon(ic)}</span><div><h2>${nome}</h2><span class="muted small">${sub} · ${ts.length} modelo${ts.length === 1 ? '' : 's'}</span></div></div>
      ${ts.length ? `<div class="tpl-grid">${ts.map(card).join('')}</div>` : '<p class="muted small">Nenhum modelo deste tipo ainda.</p>'}</section>`;
  };

  main.innerHTML = pageHeader('Modelos de documento', 'Abra um modelo para ver os campos e editar.',
    `<label class="btn quiet" style="cursor:pointer">${icon('download')}Enviar documento meu<input type="file" id="imp" accept=".docx,.pdf,image/*" hidden></label>
     <button class="btn" id="new">${icon('plus')}Novo modelo</button>`) + `
    <div id="imp-msg"></div>
    <div class="tabs tpl-filtro" role="tablist" aria-label="Tipo de documento">
      <button type="button" class="tab on" data-f="">Todos</button>
      ${TIPOS.map(([k, nome]) => `<button type="button" class="tab" data-f="${k}">${nome} <small>${doTipo(k).length}</small></button>`).join('')}
    </div>
    ${TIPOS.map(grupo).join('')}`;

  const byId = Object.fromEntries(list.map((t) => [t.id, t]));
  // filtro por tipo de documento
  $$('.tpl-filtro .tab').forEach((b) => (b.onclick = () => {
    $$('.tpl-filtro .tab').forEach((x) => x.classList.toggle('on', x === b));
    $$('.tpl-grupo').forEach((g) => { g.style.display = !b.dataset.f || g.dataset.tipo === b.dataset.f ? '' : 'none'; });
  }));
  const copiar = (t) => { setTemplateDraft({ name: t.name + ' (meu)', specialty: t.specialty, kind: t.kind, sections: t.sections, meta: {} }); location.hash = '#/modelos/novo'; };
  // Abrir: o modelo próprio vai para o editor; o da Potira abre para leitura, com o botão de editar uma cópia.
  $$('[data-open]').forEach((b) => (b.onclick = async () => {
    const t = byId[b.dataset.open];
    if (t.professional_id) { location.hash = `#/modelos/editar/${t.id}`; return; }
    const TIPO_CAMPO = { longo: 'Texto longo', curto: 'Texto curto', data: 'Data', marcar: 'Sim ou não', escolha: 'Lista de opções' };
    const r = await openModal(t.name, `<p class="muted small">${esc(KINDS[t.kind] || 'Evolução')}${t.specialty ? ' · ' + esc(t.specialty) : ''} · ${t.sections.length} campos. Este modelo é da Potira: para mudar, edite uma cópia sua.</p>
      <ol class="tpl-campos">${t.sections.map((sec) => `<li><b>${esc(sec.title)}</b><span class="muted small"> · ${TIPO_CAMPO[sec.type] || 'Texto longo'}</span>${sec.hint ? `<br><span class="muted small">${esc(sec.hint)}</span>` : ''}</li>`).join('')}</ol>`,
    { okText: 'Editar uma cópia', cancelText: 'Fechar', wide: true, onOk: () => true });
    if (r) copiar(t);
  }));
  $('#new').onclick = () => { setTemplateDraft(null); location.hash = '#/modelos/novo'; };
  $('#imp').onchange = async (e) => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    const msg = $('#imp-msg');
    msg.innerHTML = callout('<p id="imp-status">Lendo o documento…</p>');
    try {
      const r = await importTemplate(file, { onStatus: (t) => { const el = $('#imp-status'); if (el) el.textContent = t; } });
      msg.innerHTML = '';
      setTemplateDraft({ name: r.name, sections: r.sections, kind: 'sessao', meta: { source: r.source, ai: r.usedAI, ...(r.layout ? { layout: { ...r.layout, use: true } } : {}), ...(r.isDocx ? {} : { noLayout: true }) } });
      location.hash = '#/modelos/novo';
    } catch (err) { msg.innerHTML = callout(`<p>${esc(err.message)}</p>`, 'warn'); }
  };
  $$('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Excluir este modelo? Relatórios já criados continuam intactos.', 'Excluir'))) return;
    await api.deleteTemplate(b.dataset.del); toast('Modelo excluído.'); renderTemplates();
  }));
}
