// Registro profissional e redes: informado pelo próprio profissional, sem verificação automática.
export const COUNCILS = ['CRM', 'CREFITO', 'CRP', 'CRN', 'CRFa', 'COREN', 'CRO', 'CREF', 'CRESS', 'CRBM', 'Outro'];
export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

/** Texto único do registro, usado em timbres e exportações. Ex.: "CRM/RR 1234". */
export const registryText = (c) => {
  if (!c || !c.number) return '';
  return `${c.council && c.council !== 'Outro' ? c.council : 'Registro'}${c.uf ? '/' + c.uf : ''} ${c.number}`.trim();
};

/** Aceita só endereços http(s); devolve '' se não servir. */
export const cleanUrl = (v) => {
  v = String(v || '').trim(); if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v.replace(/^@/, '');
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : ''; } catch { return ''; }
};
