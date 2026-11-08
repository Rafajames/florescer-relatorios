// Cobrança e lembretes: código PIX copia-e-cola (BR Code), links do WhatsApp,
// textos das mensagens e valor por extenso para o recibo.

// CRC16-CCITT (poly 0x1021, início 0xFFFF), exigido pelo código PIX.
export function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const tlv = (id, v) => id + String(v.length).padStart(2, '0') + v;
const ascii = (s, max) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9 .\-]/g, '').toUpperCase().trim().slice(0, max);

/** Código PIX copia-e-cola. key = chave PIX (CPF/CNPJ aceitam pontuação); amount opcional. */
export function pixCode({ key, name, city, amount }) {
  let k = String(key || '').trim().replace(/\s+/g, '');
  if (/^[\d.\/\-]+$/.test(k)) k = k.replace(/\D/g, '');
  let p = tlv('00', '01') + tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', k)) + tlv('52', '0000') + tlv('53', '986');
  if (Number(amount) > 0) p += tlv('54', Number(amount).toFixed(2));
  p += tlv('58', 'BR') + tlv('59', ascii(name, 25) || 'RECEBEDOR') + tlv('60', ascii(city, 15) || 'BRASIL') + tlv('62', tlv('05', '***'));
  p += '6304';
  return p + crc16(p);
}

/** Link para abrir o WhatsApp com a mensagem pronta. Aceita telefone com ou sem DDI 55. */
export function waLink(phone, text) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dmy = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '');
const hm = (t) => String(t || '').slice(0, 5);

/** Lembrete de sessão. */
export function lembreteTexto({ patient, professional, date, time, specialty }) {
  const esp = specialty ? ` de ${specialty}` : '';
  return `Olá, ${patient}! Tudo bem?\n\nLembrete da sua sessão${esp} com ${professional}:\n📅 ${dmy(date)}${time ? ' às ' + hm(time) : ''}\n\nQualquer imprevisto, me avise com antecedência. Até lá!`;
}

/** Cobrança das sessões realizadas e não pagas, com o PIX copia-e-cola. */
/** Chaves PIX do profissional: a principal (payment.pix) e as extras cadastradas (payment.pix_extra). */
export function chavesPix(pay = {}) {
  const extras = (pay.pix_extra || []).filter((e) => e && e.key).map((e) => ({ label: e.label || e.key, key: e.key }));
  return [...(pay.pix ? [{ label: 'Principal', key: pay.pix }] : []), ...extras];
}

export function cobrancaTexto({ patient, professional, items, pix, pixKey }) {
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  const linhas = items.map((i) => `• ${dmy(i.date)}${i.time ? ' (' + hm(i.time) + ')' : ''}: ${brl(i.amount)}`).join('\n');
  const pag = pix
    ? `Chave PIX: ${pixKey || ''}\n\nPagamento por PIX (copia e cola):\n${pix}\n\nDepois do pagamento, pode me enviar o comprovante.`
    : 'Me avise a forma de pagamento de sua preferência e envio os dados.';
  return `Olá, ${patient}! Tudo bem?\n\nSegue o resumo das sessões pendentes de pagamento:\n${linhas}\n\nTotal: ${brl(total)}\n\n${pag}\n\nObrigada(o)!\n${professional}`;
}

/** Valor por extenso em reais (ex.: "cento e cinquenta reais e vinte centavos"). */
const UN = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CT = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
const ate999 = (n) => {
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100), r = n % 100, parts = [];
  if (c) parts.push(CT[c]);
  if (r) parts.push(r < 20 ? UN[r] : DZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + UN[r % 10] : ''));
  return parts.join(' e ');
};
export function extenso(v) {
  const cents = Math.round(Number(v || 0) * 100);
  const reais = Math.floor(cents / 100), centavos = cents % 100;
  const parts = [];
  const mi = Math.floor(reais / 1000000), mil = Math.floor((reais % 1000000) / 1000), resto = reais % 1000;
  if (mi) parts.push(`${ate999(mi)} ${mi === 1 ? 'milhão' : 'milhões'}`);
  if (mil) parts.push(mil === 1 ? 'mil' : `${ate999(mil)} mil`);
  if (resto) parts.push(ate999(resto));
  let txt = reais === 0 ? '' : parts.join(' e ') + (reais === 1 ? ' real' : ' reais');
  if (centavos) txt += (txt ? ' e ' : '') + `${ate999(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`;
  return txt || 'zero real';
}

/** Token aleatório gerado no navegador (48 caracteres hex). */
export const newToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 em hex, usado na senha dos relatórios (a senha nunca sai do navegador). */
export async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
