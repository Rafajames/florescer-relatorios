// Primeiro acesso do profissional: perfil e marca, IA (opcional) e pronto.
import * as api from './api.js';
import * as ai from './ai.js';
import { state, SPECIALTIES } from './state.js';
import { brandOf, applyBrand, rememberBrand, imageToDataUrl, PALETTES, slugify } from './brand.js';
import { connectorHtml, bindConnector } from './ai-connect.js';
import { $, $$, esc, toast, busy, icon } from './ui.js';

export function renderOnboarding(done) {
  let step = 1;
  const p = state.profile;
  const draft = { ...brandOf(p), clinic_name: p.clinic_name || '', council_registry: p.council_registry || '', specialty: p.specialty || SPECIALTIES[0] };
  const steps = ['Seu perfil', 'Inteligência artificial', 'Pronto'];

  const finish = async () => {
    state.profile = await api.updateProfile(p.id, { onboarded: true });
    done();
  };

  const draw = () => {
    $('#app').innerHTML = `
    <div class="onb">
      <header class="onb-head"><span class="brand"><span class="mark">${icon('flower')}</span><b>Bem-vindo ao Florescer</b></span>
        <ol class="onb-steps">${steps.map((t, i) => `<li class="${i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}"><span>${i + 1 < step ? icon('check') : i + 1}</span>${t}</li>`).join('')}</ol></header>
      <main class="onb-card" id="onb-body"></main>
    </div>`;
    ({ 1: step1, 2: step2, 3: step3 })[step]();
  };

  const step1 = () => {
    $('#onb-body').innerHTML = `
      <h1>Vamos deixar a plataforma com a sua cara</h1>
      <p class="muted">Tudo isso pode ser mudado depois, em Configurações.</p>
      <form id="f1">
        <div class="grid2">
          <label class="field">Nome do consultório ou clínica<input name="org" value="${esc(draft.org_name || draft.clinic_name)}" placeholder="Ex.: Espaço Florescer"></label>
          <label class="field">Área de atuação<select name="specialty">${SPECIALTIES.map((s) => `<option ${s === draft.specialty ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
          <label class="field">Registro no conselho<input name="reg" value="${esc(draft.council_registry)}" placeholder="Ex.: CRP 20/12345"></label>
          <label class="field">Sua logo (opcional)<input type="file" name="logo" accept="image/*"></label>
        </div>
        <div class="field">Cores
          <div class="swatches">${PALETTES.map((pl, i) => `<label class="swatch" title="${esc(pl.name)}"><input type="radio" name="pal" value="${i}" ${pl.color === draft.color ? 'checked' : ''}><span style="background:linear-gradient(135deg,${pl.color} 55%,${pl.accent} 55%)"></span></label>`).join('')}</div></div>
        <div class="row end"><button class="btn lg" type="submit">Continuar</button></div>
      </form>`;
    $$('input[name=pal]').forEach((r) => (r.onchange = () => { const pl = PALETTES[+r.value]; draft.color = pl.color; draft.accent = pl.accent; applyBrand(draft); }));
    $('#f1').onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      return busy(e.target.querySelector('[type=submit]'), 'Salvando…', async () => {
        const file = f.get('logo');
        if (file && file.size) draft.logo = await imageToDataUrl(file);
        draft.org_name = f.get('org').trim();
        const branding = { ...(p.branding || {}), org_name: draft.org_name, logo: draft.logo, color: draft.color, accent: draft.accent };
        const patch = { clinic_name: draft.org_name || null, specialty: f.get('specialty'), council_registry: f.get('reg').trim() || null, branding };
        if (!p.slug && draft.org_name) patch.slug = slugify(draft.org_name) || null;
        try { state.profile = await api.updateProfile(p.id, patch); }
        catch (err) { if (patch.slug) { delete patch.slug; state.profile = await api.updateProfile(p.id, patch); } else throw err; }
        Object.assign(draft, { specialty: patch.specialty });
        const b = brandOf(state.profile); applyBrand(b); rememberBrand(b);
        step = 2; draw();
      });
    };
  };

  const step2 = () => {
    const connected = ai.hasTextAI();
    $('#onb-body').innerHTML = `
      <h1>Quer usar inteligência artificial?</h1>
      <p class="muted">É opcional. Sem IA, você grava ou digita a sessão e escreve o relatório no editor. Com IA, ela gera um rascunho que você revisa. Você pode conectar depois.</p>
      ${connected ? `<div class="callout ok">${icon('check')}<div class="grow"><p>IA já conectada neste navegador (${esc(ai.PROVIDERS[ai.textProvider()].label)}).</p></div></div>` : ''}
      <div id="conn">${connectorHtml('gemini')}</div>
      <div class="row end" style="margin-top:18px">
        <button class="btn quiet" id="skip">${connected ? 'Continuar' : 'Pular, usar sem IA'}</button>
      </div>`;
    bindConnector($('#conn'), { onSaved: () => { step = 3; draw(); } });
    $('#skip').onclick = () => { step = 3; draw(); };
  };

  const step3 = () => {
    $('#onb-body').innerHTML = `
      <h1>Tudo pronto</h1>
      <p class="muted">Sugestão de primeiros passos:</p>
      <ol class="todo">
        <li>Cadastre um paciente e registre o consentimento (LGPD).</li>
        <li>Faça um teste de microfone antes da primeira sessão.</li>
        <li>Em Modelos, envie um documento seu para virar modelo de relatório.</li>
      </ol>
      <p class="muted small">${ai.hasTextAI() ? 'IA conectada.' : 'Você está no modo sem IA. Conecte uma quando quiser, em Configurações → Chaves de IA.'}</p>
      <div class="row end"><button class="btn lg" id="go">Começar a usar</button></div>`;
    $('#go').onclick = (e) => busy(e.currentTarget, 'Abrindo…', finish);
  };

  draw();
  void toast;
}
