// Cobrança de um paciente: escolha da chave PIX, mensagem editável, copiar, baixar (.txt/PDF/Word) e WhatsApp.
import { $, esc, fmtDate, toast, openModal, callout } from './ui.js';
import { pixCode, cobrancaTexto, waLink, chavesPix } from './cobranca.js';
import { brl, exportCobrancaPdf } from './export.js';

const slug = (s) => String(s || 'paciente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'paciente';

function baixarTexto(name, text) {
  const blob = new Blob(['﻿', text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * patient: { name, phone }. items: [{ date, time, amount }] (sessões realizadas e não pagas).
 * A chave escolhida/editada na janela vale só para esta cobrança; o perfil não muda.
 */
export function abrirCobranca({ profile, patient, items }) {
  const pay = profile?.branding?.payment || {};
  const chaves = chavesPix(pay);
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const semValor = items.filter((i) => !(Number(i.amount) > 0)).length;
  const nomeRecebedor = profile.branding?.org_name || profile.full_name;
  const gerarPix = (key) => (key ? pixCode({ key, name: nomeRecebedor, city: pay.city, amount: total }) : '');
  const chaveInicial = chaves[0]?.key || '';
  let chaveAtual = chaveInicial;
  let pix = gerarPix(chaveAtual);
  const mensagem = cobrancaTexto({ patient: patient.name, professional: profile.full_name, items, pix, pixKey: chaveAtual });
  const waUrl = (texto) => (patient.phone ? waLink(patient.phone, texto) : null);

  return openModal(`Cobrar ${patient.name}`, `
    ${semValor ? callout(`<p>${semValor} sessão(ões) estão sem valor. Ajuste o valor antes de enviar.</p>`, 'warn') : ''}
    <div class="table">${items.map((i) => `<div class="tr" style="display:flex;justify-content:space-between;gap:10px">
      <span>${fmtDate(i.date)}${i.time ? ' · ' + esc(String(i.time).slice(0, 5)) : ''}</span><b>${brl(i.amount)}</b></div>`).join('')}
      <div class="tr" style="display:flex;justify-content:space-between"><b>Total</b><b>${brl(total)}</b></div></div>
    ${chaves.length > 1 ? `<label class="field">Usar a chave PIX
      <select id="cb-chave">${chaves.map((c) => `<option value="${esc(c.key)}" ${c.key === chaveInicial ? 'selected' : ''}>${esc(c.label)} · ${esc(c.key)}</option>`).join('')}</select></label>` : ''}
    <label class="field">Chave PIX desta cobrança (pode editar)<input id="cb-key" value="${esc(chaveInicial)}" placeholder="CPF, CNPJ, e-mail ou telefone" autocomplete="off"></label>
    <label class="field">Código PIX copia-e-cola<textarea readonly rows="3" id="cb-pix">${esc(pix)}</textarea></label>
    <label class="field">Mensagem (você pode editar antes de enviar)<textarea id="cb-msg" rows="10">${esc(mensagem)}</textarea></label>
    <div class="row" style="flex-wrap:wrap;gap:8px">
      <button type="button" class="btn quiet" id="cb-copy">Copiar mensagem</button>
      <button type="button" class="btn quiet" id="cb-pixcopy">Copiar PIX</button>
      <button type="button" class="btn quiet" id="cb-txt">Baixar mensagem (.txt)</button>
      <button type="button" class="btn quiet" id="cb-pdf">Baixar cobrança (PDF)</button>
    </div>
    <div class="row" style="margin-top:12px">${waUrl(mensagem)
      ? '<a class="btn" id="cb-wa" target="_blank" rel="noopener" href="#">Enviar pelo WhatsApp</a>'
      : '<span class="small muted">Cadastre o telefone do paciente para enviar pelo WhatsApp.</span>'}</div>`,
  { cancelText: 'Fechar', onOpen: (d) => {
    const msgEl = $('#cb-msg', d), keyEl = $('#cb-key', d), pixEl = $('#cb-pix', d), chaveEl = $('#cb-chave', d);
    const wa = $('#cb-wa', d);
    const syncWa = () => { if (wa) wa.href = waUrl(msgEl.value) || '#'; };
    syncWa();
    msgEl.addEventListener('input', syncWa);

    // Troca a chave: gera o novo código e troca o código e a chave já escritos na mensagem.
    const trocarChave = (novaChave) => {
      const novo = gerarPix(novaChave);
      keyEl.value = novaChave;
      if (!novo) { pixEl.value = ''; toast('Informe a chave PIX para gerar o código.', 'err'); return; }
      let texto = msgEl.value;
      if (pix && texto.includes(pix)) texto = texto.split(pix).join(novo);
      else texto = cobrancaTexto({ patient: patient.name, professional: profile.full_name, items, pix: novo, pixKey: novaChave });
      // a chave antiga aparece na linha "Chave PIX: ..."; o código novo já foi colocado acima
      if (chaveAtual && chaveAtual !== novaChave) texto = texto.split(`Chave PIX: ${chaveAtual}`).join(`Chave PIX: ${novaChave}`);
      msgEl.value = texto; chaveAtual = novaChave; pix = novo; pixEl.value = novo; syncWa();
    };
    keyEl.addEventListener('input', () => trocarChave(keyEl.value.trim()));
    if (chaveEl) chaveEl.addEventListener('change', () => trocarChave(chaveEl.value));

    const copiar = async (texto, ok) => {
      try { await navigator.clipboard.writeText(texto); toast(ok); }
      catch { toast('Não foi possível copiar. Selecione o texto e copie.', 'err'); }
    };
    $('#cb-copy', d).onclick = () => copiar(msgEl.value, 'Mensagem copiada.');
    $('#cb-pixcopy', d).onclick = () => { if (!pix) return toast('Informe a chave PIX primeiro.', 'err'); copiar(pix, 'Código PIX copiado.'); };
    $('#cb-txt', d).onclick = () => { baixarTexto(`cobranca_${slug(patient.name)}.txt`, msgEl.value); toast('Mensagem baixada.'); };
    const docArgs = () => ({ professional: profile, patientName: patient.name, items, payment: { ...pay, pix: keyEl.value.trim() }, pixCode: pix });
    $('#cb-pdf', d).onclick = () => exportCobrancaPdf(docArgs());
  } });
}
