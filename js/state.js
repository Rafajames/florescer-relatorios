export const state = { user: null, profile: null };

export const SPECIALTIES = [
  'Psicologia', 'Fonoaudiologia', 'Fisioterapia', 'Nutrição',
  'Terapia Ocupacional', 'Psiquiatria / Medicina', 'Enfermagem', 'Serviço Social', 'Outra'
];

export let DEFAULT_CONSENT =
`Declaro estar ciente de que, com a minha autorização, o áudio das sessões poderá ser gravado apenas para fins de transcrição e elaboração do registro clínico. O áudio é descartado após a transcrição e não é armazenado.

A transcrição e os relatórios são dados pessoais sensíveis de saúde, tratados com sigilo profissional, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e as normas do conselho profissional do(a) profissional responsável. Esses dados podem ser processados por serviços de inteligência artificial contratados pelo(a) profissional para auxiliar na redação, sempre com revisão e responsabilidade do(a) profissional.

Estou ciente de que posso revogar este consentimento a qualquer momento.`;

// Configurações globais definidas pelo administrador (tabela app_settings). Sem elas, valem os padrões acima.
export const settings = {};
const BASE_CONSENT = DEFAULT_CONSENT;
export function applySettings(rows, providers) {
  for (const k of Object.keys(settings)) delete settings[k];
  for (const r of rows || []) settings[r.key] = r.value;
  if (Array.isArray(settings.specialties) && settings.specialties.length) SPECIALTIES.splice(0, SPECIALTIES.length, ...settings.specialties);
  DEFAULT_CONSENT = (typeof settings.consent_text === 'string' && settings.consent_text.trim()) || BASE_CONSENT;
  if (providers && settings.models) for (const [k, m] of Object.entries(settings.models)) if (m && providers[k]) providers[k].model = m;
}
