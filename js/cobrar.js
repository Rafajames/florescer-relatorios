// Cobrança de um paciente: escolha da chave PIX, mensagem editável, copiar, baixar (.txt/PDF) e WhatsApp.
// Também: registrar pagamento a partir do comprovante e agendar a cobrança.
import * as api from './api.js';
import { $, $$, esc, fmtDate, todayISO, toast, openModal, callout } from './ui.js';
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
 * patient: { id, name, phone }. items: [{ date, time, amount }] (sessões realizadas e não pagas).
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
      <span>${i.label ? esc(i.label) : fmtDate(i.date) + (i.time ? ' · ' + esc(String(i.time).slice(0, 5)) : '')}</span><b>${brl(i.amount)}</b></div>`).join('')}
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

    // Ao enviar/baixar/copiar, registra a data da cobrança (encerra a cobrança agendada do período).
    let marcada = false;
    const marcarEnviada = () => {
      if (marcada || !patient.id) return; marcada = true;
      api.savePatientAdmin({ patient_id: patient.id, last_charged_on: todayISO(), next_charge_on: null }).catch(() => { marcada = false; });
    };
    if (wa) wa.addEventListener('click', marcarEnviada);
    ['#cb-copy', '#cb-txt', '#cb-pdf'].forEach((sel) => $(sel, d).addEventListener('click', marcarEnviada));
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

/* ---------- Registrar pagamento (com leitura do comprovante) ---------- */
const brNum = (t) => Number(String(t).replace(/\./g, '').replace(',', '.'));
/** Procura valor e data no texto de um comprovante. Devolve { amount, date } (o que achar). */
export function lerTextoComprovante(text) {
  const t = String(text || '');
  const perto = t.match(/valor[^\d\n]{0,25}(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  const todos = [...t.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/g)].map((m) => brNum(m[1]));
  const amount = perto ? brNum(perto[1]) : (todos.length ? Math.max(...todos) : null);
  const dm = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return { amount: amount > 0 ? amount : null, date: dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : null };
}

async function lerComprovante(file) {
  const ehPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const ai = await import('./ai.js');
  const imp = await import('./import-template.js');
  if (ehPdf) {
    const text = await imp.pdfToText(file);
    const achado = lerTextoComprovante(text);
    if (achado.amount) return achado;
    if (text.trim() && ai.hasTextAI()) return ai.readReceipt({ text });
    throw new Error('Não encontrei o valor neste PDF. Digite o valor e a data.');
  }
  if (!/^image\//.test(file.type)) throw new Error('Envie o comprovante em PDF ou imagem (JPG/PNG).');
  if (!ai.hasVisionAI()) throw new Error('Para ler foto ou print, conecte uma IA em Configurações → Chaves de IA. Sem IA, digite o valor e a data (PDF é lido sem IA).');
  return ai.readReceipt({ image: { mime: file.type, b64: await imp.fileToBase64(file) } });
}

/**
 * patient: { id, name }. items: [{ id, date, time, amount, label? }] em aberto. Itens com id "c:<id>" são cobranças
 * que não são sessão (mensalidade, pacote, avulsa); os demais são sessões.
 * O sistema lê o comprovante e propõe valor e data; nada é salvo antes de o profissional confirmar.
 * Resolve true se salvou.
 */
export function registrarPagamento({ patient, items }) {
  const ordenados = [...items].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const total = ordenados.reduce((s, i) => s + Number(i.amount || 0), 0);
  return openModal(`Registrar pagamento de ${patient.name}`, `
    <label class="field">Comprovante (opcional)<input type="file" id="rp-file" accept="application/pdf,image/*">
      <small>O sistema lê o valor, a data e quem pagou. O arquivo não é guardado, só essas informações. Confira antes de confirmar.</small></label>
    <p id="rp-lido" class="small" role="status"></p>
    <div class="grid2">
      <label class="field">Valor recebido (R$)<input type="number" step="0.01" min="0" id="rp-valor" value="${total ? total.toFixed(2) : ''}"></label>
      <label class="field">Data do pagamento<input type="date" id="rp-data" value="${todayISO()}"></label>
      <label class="field">Quem pagou (opcional)<input id="rp-pagador" maxlength="120" placeholder="Nome que aparece no comprovante"></label>
      <label class="field">Forma<select id="rp-forma"><option value="pix">PIX</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="convenio">Convênio</option></select></label>
    </div>
    <div class="field">O que este pagamento quita
      <div class="table" id="rp-list">${ordenados.map((i) => `<label class="tr check" style="display:flex;gap:10px;align-items:center">
        <input type="checkbox" class="rp-it" value="${i.id}" data-v="${Number(i.amount || 0)}" checked>
        <span class="grow">${i.label ? esc(i.label) : fmtDate(i.date) + (i.time ? ' · ' + esc(String(i.time).slice(0, 5)) : '')}</span><b>${brl(i.amount)}</b></label>`).join('')}</div></div>
    <p id="rp-conf" class="small" role="status"></p>
    <label class="check"><input type="checkbox" id="rp-ok"> Conferi o valor e confirmo o pagamento</label>`,
  { okText: 'Marcar como pago',
    onOpen: (d) => {
      const valor = $('#rp-valor', d), conf = $('#rp-conf', d);
      const marcadas = () => $$('.rp-it:checked', d);
      const soma = () => marcadas().reduce((s, c) => s + Number(c.dataset.v), 0);
      const conferir = () => {
        const v = Number(valor.value) || 0, s = soma(), dif = Math.round((v - s) * 100) / 100;
        conf.innerHTML = !marcadas().length ? 'Marque ao menos um item.'
          : dif === 0 ? `<b>Valor confere</b> com ${marcadas().length} item(ns): ${brl(s)}.`
            : `Os itens marcados somam ${brl(s)}. ${dif > 0 ? `Sobram ${brl(dif)} do valor recebido.` : `Faltam ${brl(-dif)} para quitar as marcadas.`}`;
      };
      // Marca as sessões mais antigas que cabem no valor recebido.
      const distribuir = () => {
        let resto = Math.round((Number(valor.value) || 0) * 100);
        $$('.rp-it', d).forEach((c) => { const v = Math.round(Number(c.dataset.v) * 100); c.checked = v > 0 && v <= resto; if (c.checked) resto -= v; });
        conferir();
      };
      valor.addEventListener('input', distribuir);
      $$('.rp-it', d).forEach((c) => c.addEventListener('change', conferir));
      conferir();
      $('#rp-file', d).onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const lido = $('#rp-lido', d); lido.textContent = 'Lendo o comprovante…';
        try {
          const r = await lerComprovante(file);
          if (r.amount) { valor.value = r.amount.toFixed(2); }
          if (r.date) $('#rp-data', d).value = r.date;
          if (r.payer) $('#rp-pagador', d).value = r.payer;
          lido.innerHTML = `Lido do comprovante: <b>${r.amount ? brl(r.amount) : 'valor não encontrado'}</b>${r.date ? ' em ' + fmtDate(r.date) : ''}${r.payer ? ' · pagador: ' + esc(r.payer) : ''}. Confira com o arquivo.`;
          distribuir();
        } catch (err) { lido.textContent = err.message || String(err); }
      };
    },
    onOk: async (d) => {
      const ids = $$('.rp-it:checked', d).map((c) => c.value);
      if (!ids.length) { toast('Marque ao menos um item.', 'err'); return false; }
      if (!$('#rp-ok', d).checked) { toast('Marque a caixa de conferência para confirmar.', 'err'); return false; }
      const paid_on = $('#rp-data', d).value || todayISO(), payment_method = $('#rp-forma', d).value;
      const porId = Object.fromEntries(ordenados.map((i) => [i.id, i]));
      const pagador = $('#rp-pagador', d).value.trim();
      const payment_note = pagador ? `Pagador: ${pagador}` : null;
      for (const id of ids) {
        if (id.startsWith('c:')) await api.saveCharge({ id: id.slice(2), payment_status: 'pago', paid_on, payment_method, payment_note });
        else await api.updateAppointment(id, { payment_status: 'pago', paid_on, payment_method, payment_note, amount: Number(porId[id].amount || 0) });
      }
      toast(`${ids.length} item(ns) marcado(s) como pago(s).`);
      return true;
    } });
}

/* ---------- Agendar cobrança ---------- */
/** admin: registro patient_admin atual (ou null). Resolve true se salvou. */
export function agendarCobranca({ patient, admin }) {
  return openModal(`Agendar cobrança de ${patient.name}`, `
    <p>No dia escolhido, a cobrança aparece pronta em Financeiro e no Início, com a mensagem e o PIX. Você confere e envia com um toque.</p>
    <label class="field">Todo mês, no dia<select id="ag-dia"><option value="">Sem dia fixo</option>${[...Array(28)].map((_, i) => `<option value="${i + 1}" ${admin?.billing_day === i + 1 ? 'selected' : ''}>Dia ${i + 1}</option>`).join('')}</select>
      <small>Cobra as sessões em aberto uma vez por mês, a partir desse dia.</small></label>
    <label class="field">Ou uma cobrança avulsa em<input type="date" id="ag-data" value="${admin?.next_charge_on || ''}" min="${todayISO()}"></label>`,
  { okText: 'Salvar agendamento',
    onOk: async (d) => {
      const dia = $('#ag-dia', d).value, data = $('#ag-data', d).value;
      await api.savePatientAdmin({ patient_id: patient.id, billing_day: dia ? Number(dia) : null, next_charge_on: data || null });
      toast(dia || data ? 'Cobrança agendada.' : 'Agendamento removido.');
      return true;
    } });
}
