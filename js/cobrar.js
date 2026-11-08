// Cobrança de um paciente: mensagem editável, código PIX, copiar, baixar (.txt/PDF/Word) e WhatsApp.
import { $, esc, fmtDate, toast, openModal, callout } from './ui.js';
import { pixCode, cobrancaTexto, waLink } from './cobranca.js';
import { brl, exportCobrancaPdf, exportCobrancaWord } from './export.js';

const slug = (s) => String(s || 'paciente').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'paciente';

function baixarTexto(name, text) {
  const blob = new Blob(['\ufeff', text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * patient: { name, phone }. items: [{ date, time, amount }] (sessões realizadas e não pagas).
 */
export function abrirCobranca({ profile, patient, items }) {
  const pay = profile?.branding?.payment || {};
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const semValor = items.filter((i) => !(Number(i.amount) > 0)).length;
  const pix = pay.pix
    ? pixCode({ key: pay.pix, name: profile.branding?.org_name || profile.full_name, city: pay.city, amount: total })
    : '';
  const mensagem = cobrancaTexto({ patient: patient.name, professional: profile.full_name, items, pix });
  const waUrl = (texto) => (patient.phone ? waLink(patient.phone, texto) : null);

  return openModal(`Cobrar ${patient.name}`, `
    ${semValor ? callout(`<p>${semValor} sessão(ões) estão sem valor. Ajuste o valor antes de enviar.</p>`, 'warn') : ''}
    ${!pix ? callout('<p>Sem chave PIX cadastrada. Em <b>Financeiro > Dados de pagamento</b> você inclui o código PIX na mensagem.</p>', '') : ''}
    <div class="table">${items.map((i) => `<div class="tr" style="display:flex;justify-content:space-between;gap:10px">
      <span>${fmtDate(i.date)}${i.time ? ' · ' + esc(String(i.time).slice(0, 5)) : ''}</span><b>${brl(i.amount)}</b></div>`).join('')}
      <div class="tr" style="display:flex;justify-content:space-between"><b>Total</b><b>${brl(total)}</b></div></div>
    <label class="field">Mensagem (você pode editar antes de enviar)<textarea id="cb-msg" rows="10">${esc(mensagem)}</textarea></label>
    ${pix ? `<label class="field">Código PIX copia-e-cola<textarea readonly rows="3" id="cb-pix">${esc(pix)}</textarea></label>` : ''}
    <div class="row" style="flex-wrap:wrap;gap:8px">
      <button type="button" class="btn quiet" id="cb-copy">Copiar mensagem</button>
      ${pix ? '<button type="button" class="btn quiet" id="cb-pixcopy">Copiar PIX</button>' : ''}
      <button type="button" class="btn quiet" id="cb-txt">Baixar mensagem (.txt)</button>
      <button type="button" class="btn quiet" id="cb-pdf">Baixar cobrança (PDF)</button>
      <button type="button" class="btn quiet" id="cb-doc">Cobrança em Word</button>
    </div>
    <div class="row" style="margin-top:12px">${waUrl(mensagem)
      ? '<a class="btn" id="cb-wa" target="_blank" rel="noopener" href="#">Enviar pelo WhatsApp</a>'
      : '<span class="small muted">Cadastre o telefone do paciente para enviar pelo WhatsApp.</span>'}</div>`,
  { cancelText: 'Fechar', onOpen: (d) => {
    const msg = () => $('#cb-msg', d).value;
    const wa = $('#cb-wa', d);
    const syncWa = () => { if (wa) wa.href = waUrl(msg()) || '#'; };
    syncWa();
    $('#cb-msg', d).addEventListener('input', syncWa);
    const copiar = async (texto, ok) => {
      try { await navigator.clipboard.writeText(texto); toast(ok); }
      catch { toast('Não foi possível copiar. Selecione o texto e copie.', 'err'); }
    };
    $('#cb-copy', d).onclick = () => copiar(msg(), 'Mensagem copiada.');
    if (pix) $('#cb-pixcopy', d).onclick = () => copiar(pix, 'Código PIX copiado.');
    $('#cb-txt', d).onclick = () => { baixarTexto(`cobranca_${slug(patient.name)}.txt`, msg()); toast('Mensagem baixada.'); };
    const docArgs = () => ({ professional: profile, patientName: patient.name, items, payment: pay, pixCode: pix });
    $('#cb-pdf', d).onclick = () => exportCobrancaPdf(docArgs());
    $('#cb-doc', d).onclick = () => exportCobrancaWord(docArgs());
  } });
}
