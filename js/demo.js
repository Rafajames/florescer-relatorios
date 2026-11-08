// Paciente de demonstração: dados fictícios para o profissional testar tudo. Pode ser removido a qualquer momento.
import * as api from './api.js';
import { todayISO, daysAgoISO } from './ui.js';

export const DEMO_TAG = '[TESTE]';
export const isDemo = (p) => String(p?.notes || '').startsWith(DEMO_TAG);

const sec = (title, text, extra = {}) => ({ title, text, patient_visible: true, ...extra });

export async function createDemo({ email = '' } = {}) {
  const p = await api.savePatient({
    name: 'Paciente Teste (demonstração)', email: email.trim() || null, phone: '(00) 00000-0000', birth_date: '1990-05-15',
    notes: `${DEMO_TAG} Dados fictícios para você testar o sistema. Pode editar à vontade e remover quando quiser.`,
  });
  await api.addConsent({ patient_id: p.id, consent_text: 'Consentimento de demonstração.', channel: 'presencial' });
  const tpls = await api.listTemplates().catch(() => []);
  const tid = (k) => (tpls.find((t) => t.kind === k) || {}).id || null;
  const base = { patient_id: p.id };
  const anam = await api.createReport({
    ...base, template_id: tid('anamnese'), kind: 'anamnese', title: 'Anamnese (demonstração)', session_date: daysAgoISO(21), status: 'revisado',
    sections: [
      sec('Queixa principal', 'Relata cansaço e dificuldade para dormir nas últimas semanas.', { html: '<p>Relata <b>cansaço</b> e dificuldade para dormir nas últimas semanas.</p>' }),
      sec('Histórico de saúde', 'Sem doenças crônicas informadas.'),
      sec('Rotina e hábitos', 'Trabalha em horário comercial; pratica caminhada duas vezes por semana.', { html: '<ul><li>Trabalha em horário comercial</li><li>Caminhada duas vezes por semana</li></ul>' }),
      sec('Observações internas', 'Exemplo de seção oculta ao paciente.', { patient_visible: false }),
    ],
  });
  const ev1 = await api.createReport({
    ...base, template_id: tid('sessao'), kind: 'sessao', title: 'Sessão 1 (demonstração)', session_date: daysAgoISO(14), status: 'revisado',
    transcript: 'Profissional: Como foi a semana? Paciente: Dormi melhor, mas ainda acordo cansado. (texto fictício)', notes: 'Paciente pontual. (anotação fictícia)',
    sections: [sec('Demanda da sessão', 'Melhora parcial do sono.'), sec('Conduta', 'Orientações de higiene do sono.'), sec('Plano', 'Reavaliar na próxima semana.')],
  });
  if (p.email) await api.updateReport(ev1.id, { released_to_patient: true, released_at: new Date().toISOString() });
  await api.createReport({
    ...base, template_id: tid('sessao'), kind: 'sessao', title: 'Sessão 2 (demonstração, rascunho)', session_date: todayISO(), status: 'rascunho',
    transcript: 'Texto fictício de transcrição para você testar a busca e a transcrição ao lado.', ai_generated: false,
    sections: [sec('Demanda da sessão', 'Edite este rascunho, use a barra de formatação e marque como revisado.'), sec('Conduta', ''), sec('Plano', '')],
  });
  void anam;
  return p;
}

export async function removeDemo() {
  const list = await api.listPatients(true);
  const demos = list.filter(isDemo);
  for (const d of demos) await api.deletePatient(d.id);
  return demos.length;
}
