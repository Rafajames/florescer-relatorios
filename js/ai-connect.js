// Componente para conectar uma IA (usado no primeiro acesso e em Configurações).
import * as ai from './ai.js';
import { $, $$, esc, toast, busy, chip } from './ui.js';

const ORDER = ['gemini', 'groq', 'anthropic', 'openai'];

export function connectorHtml(selected = 'gemini') {
  return `
    <div class="prov-list" role="radiogroup" aria-label="Provedor de IA">
      ${ORDER.map((id) => {
        const p = ai.PROVIDERS[id];
        return `<label class="prov ${id === selected ? 'on' : ''}">
          <input type="radio" name="provider" value="${id}" ${id === selected ? 'checked' : ''}>
          <span class="grow"><b>${esc(p.label)}</b>
            <small>${p.stt && p.text ? 'Escreve e transcreve áudio' : 'Escreve os relatórios'}${p.vision ? ' · lê fotos de documentos' : ''}</small></span>
          ${p.free ? chip('Plano gratuito', 'ok') : chip('Pago', '')}
        </label>`;
      }).join('')}
    </div>
    <div id="prov-help" class="prov-help"></div>
    <label class="field" style="margin-top:12px">Chave de acesso (API key)
      <input type="password" name="apikey" autocomplete="off" placeholder="Cole aqui a chave do provedor escolhido"></label>
    <div class="row">
      <button type="button" class="btn" id="prov-save">Testar e conectar</button>
      <span class="muted small" id="prov-msg"></span>
    </div>`;
}

export function bindConnector(root, { onSaved } = {}) {
  const help = () => {
    const id = $('input[name=provider]:checked', root).value;
    const p = ai.PROVIDERS[id];
    $$('.prov', root).forEach((l) => l.classList.toggle('on', l.querySelector('input').value === id));
    $('#prov-help', root).innerHTML = `
      <p><a href="${p.keyUrl}" target="_blank" rel="noopener">Abrir a página para criar a chave</a>. ${esc(p.steps)}</p>
      <p class="muted small">${esc(p.privacy)}</p>
      <p class="muted small">A chave fica só neste navegador. O sistema nunca envia o nome do paciente para a IA.</p>`;
  };
  $$('input[name=provider]', root).forEach((i) => (i.onchange = help));
  help();
  $('#prov-save', root).onclick = (e) => busy(e.currentTarget, 'Testando…', async () => {
    const id = $('input[name=provider]:checked', root).value;
    const key = $('input[name=apikey]', root).value.trim();
    if (!key) throw new Error('Cole a chave de acesso antes de conectar.');
    await ai.testKey(id, key);
    saveKey(id, key);
    $('input[name=apikey]', root).value = '';
    toast(`${ai.PROVIDERS[id].label} conectado.`);
    if (onSaved) onSaved(id);
  });
}

/** Guarda a chave e a define como provedor de texto (e de transcrição, se servir). */
export function saveKey(id, key) {
  const cur = ai.getKeys();
  const next = { ...cur, [id]: key };
  if (ai.PROVIDERS[id].text && !cur.textProvider) next.textProvider = id;
  if (ai.PROVIDERS[id].stt && !cur.sttProvider) next.sttProvider = id;
  ai.setKeys(next);
}
