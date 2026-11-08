// Paciente de demonstração: dados fictícios para o profissional testar tudo. Pode ser removido a qualquer momento.
import * as api from './api.js';
import { todayISO, daysAgoISO } from './ui.js';

export const DEMO_TAG = '[TESTE]';
export const isDemo = (p) => String(p?.notes || '').startsWith(DEMO_TAG);

const sec = (title, text, extra = {}) => ({ title, text, patient_visible: true, ...extra });

// Conteúdo fictício por área, para o teste mostrar o que o sistema faz em cada profissão.
const DEFAULT = {
  anam: ['Queixa principal descrita pelo paciente em suas palavras.', 'Histórico de saúde relevante informado.', 'Rotina e hábitos do dia a dia.', 'Expectativas com o acompanhamento.', 'Observações gerais.'],
  ev: ['Demanda e relato da sessão.', 'Condutas e orientações realizadas.', 'Resposta do paciente.', 'Plano para a próxima sessão.', 'Observações.'],
  tr: 'Profissional: Como foi a semana? Paciente: Tive uma melhora, mas ainda sinto dificuldade. (texto fictício)', notes: 'Paciente pontual. (anotação fictícia)', draft: 'Edite este rascunho, use a barra de formatação e marque como revisado.',
};
const BY = {
  'Psicologia': {
    anam: ['Relata ansiedade e dificuldade para dormir nas últimas semanas.', 'Sem diagnósticos prévios; nunca fez acompanhamento psicológico.', 'Trabalha em horário comercial; caminha duas vezes por semana.', 'Quer aprender a lidar com a preocupação excessiva.', 'Rede de apoio: mãe e uma amiga próxima.'],
    ev: ['Trouxe a preocupação com o trabalho e o sono ainda irregular.', 'Temas: cobrança no trabalho, relação com a mãe.', 'Técnica de respiração e registro de pensamentos.', 'Mais tranquilo ao final da sessão.', 'Praticar a respiração diariamente; retomar o registro.'],
    tr: 'Profissional: Como foi a semana? Paciente: Dormi melhor, mas ainda acordo cansado e preocupado com o trabalho. (texto fictício)', notes: 'Paciente pontual, colaborativo. (anotação fictícia)', draft: 'Descreva aqui a demanda da sessão. Use a barra de formatação e marque como revisado.' },
  'Fonoaudiologia': {
    anam: ['Família relata troca de sons na fala e pouca clareza para desconhecidos.', 'Sem perdas auditivas informadas; desenvolvimento motor dentro do esperado.', 'Brinca bem, pouca interação em grupo.', 'Melhorar a inteligibilidade da fala.', 'Frequenta a escola em período integral.'],
    ev: ['Relato da mãe: usou palavras novas em casa.', 'Praxias orofaciais e jogos de consciência fonológica.', 'Boa atenção, cansou nos últimos minutos.', 'Treino dos sons /r/ e /l/ em palavras.', 'Atividades de leitura em voz alta, 10 minutos por dia.'],
    tr: 'Fonoaudióloga: Vamos repetir "rato". Criança: lato. Vamos de novo, com a língua para cima. (texto fictício)', notes: 'Criança cooperativa; mãe presente. (anotação fictícia)', draft: 'Registre os objetivos terapêuticos e as atividades da sessão.' },
  'Fisioterapia': {
    anam: ['Dor lombar há três meses, piora ao ficar sentado.', 'Hipertensão controlada; sem cirurgias prévias.', 'Trabalha em escritório; sedentário.', 'Voltar a caminhar sem dor.', 'Sem uso de analgésicos de rotina.'],
    ev: ['Dor lombar de intensidade moderada, melhor que na semana anterior.', 'Mobilidade lombar com leve limitação na flexão.', 'Mobilização, alongamentos e exercícios de estabilização.', 'Boa resposta, sem dor ao final.', 'Exercícios domiciliares em dias alternados; reavaliar em 1 semana.'],
    tr: 'Fisioterapeuta: Onde dói hoje? Paciente: Na parte baixa das costas, menos que semana passada. (texto fictício)', notes: 'Realizou todos os exercícios propostos. (anotação fictícia)', draft: 'Descreva queixa, achados e condutas da sessão.' },
  'Nutrição': {
    anam: ['Quer reduzir peso e melhorar a disposição.', 'Sem doenças diagnosticadas; sem alergias alimentares informadas.', 'Pula o café da manhã; almoça fora; janta tarde.', 'Perder peso de forma gradual.', 'Bebe pouca água ao longo do dia.'],
    ev: ['Seguiu parte do plano; dificuldade nos fins de semana.', 'Recordatório: café com pão, almoço no restaurante, lanche à tarde.', 'Ajuste de porções e inclusão de frutas no lanche.', 'Motivado, relata mais energia.', 'Aumentar a água e planejar as refeições do fim de semana.'],
    tr: 'Nutricionista: Como foram as refeições? Paciente: Consegui tomar café da manhã quase todos os dias. (texto fictício)', notes: 'Trouxe diário alimentar. (anotação fictícia)', draft: 'Registre o relato alimentar, a conduta e as orientações.' },
};
BY['Terapia Ocupacional'] = { ...DEFAULT, anam: ['Dificuldade nas atividades de vida diária após lesão na mão.', 'Sem outras doenças informadas.', 'Destro; trabalha com digitação.', 'Voltar a escrever e usar o teclado sem dor.', 'Apoio da família em casa.'], ev: ['Relata menos dor ao escrever.', 'Treino de preensão e coordenação fina.', 'Boa adesão às atividades.', 'Progresso na força de pinça.', 'Atividades funcionais em casa.'] };
BY['Psiquiatria / Medicina'] = { ...DEFAULT, anam: ['Insônia e irritabilidade há dois meses.', 'Sem comorbidades; nega uso de medicações.', 'Trabalho com muita pressão; consumo moderado de café.', 'Melhorar o sono e o humor.', 'Antecedentes familiares: não informados.'], ev: ['Sono ainda irregular; humor melhor.', 'Exame sem alterações relevantes.', 'Orientações de higiene do sono.', 'Boa evolução.', 'Retorno em 30 dias.'] };

const pick = (spec) => ({ ...DEFAULT, ...(BY[spec] || {}) });
const fill = (tpl, texts, fallbackTitles) => {
  const secs = (tpl && tpl.sections && tpl.sections.length ? tpl.sections.map((x) => x.title) : fallbackTitles);
  return secs.map((title, i) => ({ title, text: texts[i] || 'Exemplo de preenchimento (dados fictícios).', patient_visible: true }));
};

export async function createDemo({ email = '' } = {}) {
  const me = (await import('./state.js')).state.profile || {};
  const spec = me.specialty || 'Geral', c = pick(spec);
  const p = await api.savePatient({
    name: 'Paciente Teste (demonstração)', email: email.trim() || null, phone: '(00) 00000-0000', birth_date: '1990-05-15',
    notes: `${DEMO_TAG} Dados fictícios (${spec}) para você testar o sistema. Pode editar à vontade e remover quando quiser.`,
  });
  await api.addConsent({ patient_id: p.id, consent_text: 'Consentimento de demonstração.', channel: 'presencial' });
  const tpls = await api.listTemplates().catch(() => []);
  const tplFor = (k) => tpls.find((t) => t.kind === k && t.professional_id && t.specialty === spec) || tpls.find((t) => t.kind === k && t.specialty === spec) || tpls.find((t) => t.kind === k);
  const base = { patient_id: p.id };
  const ta = tplFor('anamnese'), ts = tplFor('sessao');
  const anamSecs = fill(ta, c.anam, ['Queixa principal', 'Histórico de saúde', 'Rotina e hábitos', 'Expectativas', 'Observações']);
  anamSecs.push({ title: 'Observações internas', text: 'Exemplo de seção oculta ao paciente.', patient_visible: false });
  if (anamSecs[0]) anamSecs[0].html = `<p><b>${anamSecs[0].text}</b></p>`;
  await api.createReport({ ...base, template_id: ta?.id || null, kind: 'anamnese', title: 'Anamnese (demonstração)', session_date: daysAgoISO(21), status: 'revisado', sections: anamSecs });
  const ev1 = await api.createReport({
    ...base, template_id: ts?.id || null, kind: 'sessao', title: 'Sessão 1 (demonstração)', session_date: daysAgoISO(14), status: 'revisado',
    transcript: c.tr, notes: c.notes, sections: fill(ts, c.ev, ['Demanda', 'Conduta', 'Plano']),
  });
  if (p.email) await api.updateReport(ev1.id, { released_to_patient: true, released_at: new Date().toISOString() });
  const draftSecs = fill(ts, [], ['Demanda', 'Conduta', 'Plano']).map((x, i) => ({ ...x, text: i === 0 ? c.draft : '' }));
  await api.createReport({
    ...base, template_id: ts?.id || null, kind: 'sessao', title: 'Sessão 2 (demonstração, rascunho)', session_date: todayISO(), status: 'rascunho',
    transcript: 'Texto fictício de transcrição para você testar a busca e a transcrição ao lado.', ai_generated: false, sections: draftSecs,
  });
  return p;
}

export async function removeDemo() {
  const list = await api.listPatients(true);
  const demos = list.filter(isDemo);
  for (const d of demos) await api.deletePatient(d.id);
  return demos.length;
}
