export const state = { user: null, profile: null };

export const SPECIALTIES = [
  'Psicologia', 'Fonoaudiologia', 'Fisioterapia', 'Nutrição',
  'Terapia Ocupacional', 'Psiquiatria / Medicina', 'Enfermagem', 'Serviço Social', 'Outra'
];

export const DEFAULT_CONSENT =
`Declaro estar ciente de que, com a minha autorização, o áudio das sessões poderá ser gravado apenas para fins de transcrição e elaboração do registro clínico. O áudio é descartado após a transcrição e não é armazenado.

A transcrição e os relatórios são dados pessoais sensíveis de saúde, tratados com sigilo profissional, conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e as normas do conselho profissional do(a) profissional responsável. Esses dados podem ser processados por serviços de inteligência artificial contratados pelo(a) profissional para auxiliar na redação, sempre com revisão e responsabilidade do(a) profissional.

Estou ciente de que posso revogar este consentimento a qualquer momento.`;
