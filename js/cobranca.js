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

const cpfValido = (d) => {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
};
/**
 * Deixa a chave no formato que o PIX exige: CPF/CNPJ só com números, telefone como +55DDDNÚMERO,
 * e-mail em minúsculas. Um número de 11 dígitos é CPF quando os dígitos verificadores conferem;
 * senão (ou se foi digitado com parênteses ou +), é telefone.
 */
export function normalizaChavePix(key) {
  const k = String(key || '').trim();
  if (!k) return '';
  if (k.includes('@')) return k.replace(/\s+/g, '').toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return k.toLowerCase(); // chave aleatória
  if (!/^[\d\s.()\/+\-]+$/.test(k)) return k.replace(/\s+/g, '');
  const d = k.replace(/\D/g, '');
  const tel = /[()+]/.test(k);
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(k)) return d; // escrito como CPF
  if (k.startsWith('+')) return '+' + d;
  if (d.length === 14) return d; // CNPJ
  if (d.length === 11 && !tel && cpfValido(d)) return d;
  if (d.length === 10 || d.length === 11) return '+55' + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return '+' + d;
  return d;
}

/** Sessão que gera cobrança: realizada, ou falta sem justificativa quando o profissional cobra faltas. */
export const cobravel = (a, profile) => a.status === 'realizado' || (a.status === 'falta' && Boolean(profile?.branding?.charge_absence));

/**
 * Cobrança agendada vencida para o paciente? admin: { billing_day, next_charge_on, last_charged_on }.
 * Dia fixo: vale a partir do dia do mês, uma vez por mês. Data avulsa: vale a partir da data.
 */
export function cobrancaVencida(admin, hojeISO) {
  if (!admin) return false;
  if (admin.next_charge_on && admin.next_charge_on <= hojeISO) return true;
  if (!admin.billing_day) return false;
  const marco = `${hojeISO.slice(0, 8)}${String(admin.billing_day).padStart(2, '0')}`;
  return hojeISO >= marco && !(admin.last_charged_on && admin.last_charged_on >= marco);
}

/** Código PIX copia-e-cola. key = chave PIX (aceita pontuação; telefone vira +55...); amount opcional. */
export function pixCode({ key, name, city, amount }) {
  const k = normalizaChavePix(key);
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
  const pag = pix
    ? `Chave PIX: ${pixKey || ''}\n\nPagamento por PIX (copia e cola):\n${pix}\n\nDepois do pagamento, pode me enviar o comprovante.`
    : 'Me avise a forma de pagamento de sua preferência e envio os dados.';
  return `Olá, ${patient}! Tudo bem?\n\nSegue o resumo das sessões pendentes de pagamento:\nQuantidade de sessões: ${items.length}\nTotal: ${brl(total)}\n\n${pag}\n\nObrigada(o)!\n${professional}`;
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
