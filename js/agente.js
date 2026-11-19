// Assistente da Potira: chat em que o profissional pede em português e a IA responde, consulta e faz ações.
// Usa a mesma chave de IA do navegador (js/ai.js) e só acessa o banco por js/api.js.
// Regras (docs/ASSISTENTE-IA.md): IA opcional; tudo que altera dados pede confirmação; nada é apagado;
// pacientes vão para a IA como código ([P1]) e iniciais — o nome volta só na tela.
import * as api from './api.js';
import * as ai from './ai.js';
import { state } from './state.js';
import { esc, fmtDate, icon } from './ui.js';
import { resolvedHelp } from './views-help.js';
import { cpfValido } from './cobranca.js';
import { soDigitos } from './cadastro.js';

const MAX_VOLTAS = 8;          // chamadas de ferramenta seguidas por pedido
const MAX_HIST = 24;           // mensagens guardadas (as mais antigas saem)
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const SIT = { agendado: 'agendada', realizado: 'realizada', falta: 'falta', falta_justificada: 'falta justificada', cancelado: 'cancelada' };

/* ---------- datas ---------- */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoje = () => iso(new Date());
const diaSemana = (s) => DIAS[new Date(s + 'T12:00:00').getDay()];
const somaDias = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const okData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/* ---------- pacientes como código ---------- */
let codigos = new Map();   // patient_id → 'P1'
let porCodigo = new Map(); // 'P1' → { id, name }
const codigo = (p) => {
  if (!p) return null;
  if (!codigos.has(p.id)) { const c = 'P' + (codigos.size + 1); codigos.set(p.id, c); porCodigo.set(c, { id: p.id, name: p.name }); }
  return `[${codigos.get(p.id)}]`;
};
const iniciais = (n) => String(n || '').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + '.').join(' ');
const idade = (b) => { if (!b) return null; const d = new Date(b), h = new Date(); let a = h.getFullYear() - d.getFullYear(); if (h < new Date(h.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
const pacienteDe = (cod) => {
  const k = String(cod || '').replace(/[[\]\s]/g, '').toUpperCase();
  const p = porCodigo.get(k);
  if (!p) throw new Error(`Paciente ${cod} não encontrado. Use buscar_pacientes antes.`);
  return p;
};
let pacientesCache = null;
const pacientes = async () => (pacientesCache ||= await api.listPatients(true));
let sessoesCache = new Map(); // id → sessão vista em listar_sessoes

/* ---------- ferramentas ---------- */
const S = (props, req = []) => ({ type: 'object', properties: props, ...(req.length ? { required: req } : {}) });
const str = (d) => ({ type: 'string', description: d });
const num = (d) => ({ type: 'number', description: d });

const TOOLS = [
  { name: 'consultar_ajuda', desc: 'Procura na central de ajuda da Potira como fazer algo na plataforma (cadastrar, importar, agenda, financeiro, chaves de IA, relatórios…). Use para toda dúvida de "como faço".',
    schema: S({ pergunta: str('O que a pessoa quer saber, em poucas palavras.') }, ['pergunta']), run: consultarAjuda },
  { name: 'buscar_pacientes', desc: 'Encontra pacientes pelo nome (ou parte dele). Devolve código [Pn], iniciais e idade. Se vier mais de um, pergunte qual é antes de agir.',
    schema: S({ nome: str('Nome ou parte do nome. Vazio lista todos.') }), run: buscarPacientes },
  { name: 'listar_sessoes', desc: 'Lista sessões da agenda num período, de todos ou de um paciente, com situação e pagamento.',
    schema: S({ de: str('Data inicial AAAA-MM-DD'), ate: str('Data final AAAA-MM-DD'), paciente: str('Código [Pn], opcional'), situacao: str('agendado, realizado, falta, falta_justificada ou cancelado (opcional)') }, ['de', 'ate']), run: listarSessoes },
  { name: 'resumo_financeiro', desc: 'Totais do período: recebido (pela data do pagamento), gastos e o que está em aberto hoje.',
    schema: S({ de: str('AAAA-MM-DD'), ate: str('AAAA-MM-DD') }, ['de', 'ate']), run: resumoFinanceiro },
  { name: 'listar_pendencias', desc: 'Quem está devendo (sessões e cobranças em aberto), sessões realizadas nos últimos 30 dias sem evolução, e rascunhos.',
    schema: S({}), run: listarPendencias },
  { name: 'ler_evolucoes', desc: 'Lê o texto das evoluções de um paciente num período, para você resumir. Use só quando pedirem resumo ou histórico clínico.',
    schema: S({ paciente: str('Código [Pn]'), de: str('AAAA-MM-DD'), ate: str('AAAA-MM-DD') }, ['paciente', 'de', 'ate']), run: lerEvolucoes },
  { name: 'agendar_sessao', mutacao: true, desc: 'Agenda uma sessão para um paciente. O profissional confirma antes.',
    schema: S({ paciente: str('Código [Pn]'), data: str('AAAA-MM-DD'), hora: str('HH:MM'), duracao_min: num('Duração em minutos (padrão 50)'), observacao: str('Opcional, sem informação clínica') }, ['paciente', 'data', 'hora']),
    resumo: (a) => `Agendar ${nomeP(a.paciente)} em ${fmtDate(a.data)} (${diaSemana(a.data)}) às ${a.hora}, ${a.duracao_min || 50} min.`, run: agendarSessao },
  { name: 'atualizar_situacao_sessao', mutacao: true, desc: 'Muda a situação de uma sessão que apareceu em listar_sessoes (realizada, falta, falta justificada, cancelada ou agendada de novo). O profissional confirma antes.',
    schema: S({ sessao_id: str('id da sessão, de listar_sessoes'), situacao: str('agendado, realizado, falta, falta_justificada ou cancelado') }, ['sessao_id', 'situacao']),
    resumo: (a) => { const s = sessoesCache.get(a.sessao_id); return s ? `Marcar a sessão de ${s.patients?.name || 'paciente'} em ${fmtDate(s.date)} ${hhmm(s.time)} como ${SIT[a.situacao] || a.situacao}.` : `Mudar a sessão para ${SIT[a.situacao] || a.situacao}.`; }, run: atualizarSituacao },
  { name: 'cadastrar_paciente', mutacao: true, desc: 'Cadastra um paciente novo com os dados básicos. O profissional confirma antes. O cadastro completo é feito depois na ficha.',
    schema: S({ nome: str('Nome completo'), telefone: str('Opcional'), email: str('Opcional'), nascimento: str('AAAA-MM-DD, opcional'), cpf: str('Opcional, só números') }, ['nome']),
    resumo: (a) => `Cadastrar paciente: ${a.nome}${a.telefone ? ', tel. ' + a.telefone : ''}${a.nascimento ? ', nascimento ' + fmtDate(a.nascimento) : ''}${a.cpf ? ', CPF informado' : ''}.`, run: cadastrarPaciente },
  { name: 'lancar_gasto', mutacao: true, desc: 'Lança um gasto (despesa) no Financeiro. O profissional confirma antes.',
    schema: S({ data: str('AAAA-MM-DD'), descricao: str('Descrição'), valor: num('Valor em reais'), categoria: str('Opcional'), pago: { type: 'boolean', description: 'Já foi pago? (padrão sim)' } }, ['data', 'descricao', 'valor']),
    resumo: (a) => `Lançar gasto: ${a.descricao}, ${brl(a.valor)} em ${fmtDate(a.data)}${a.pago === false ? ' (a pagar)' : ''}.`, run: lancarGasto },
  { name: 'abrir_tela', desc: 'Abre uma tela da Potira para o profissional.',
    schema: S({ tela: { type: 'string', enum: ['inicio', 'pacientes', 'ficha_paciente', 'agenda', 'financeiro', 'relatorios', 'nova_evolucao', 'configuracoes', 'chaves_ia', 'ajuda'], description: 'Tela' }, paciente: str('Código [Pn], para ficha_paciente ou nova_evolucao') }, ['tela']), run: abrirTela },
  { name: 'gerar_nota_fiscal', desc: 'Pedido de nota fiscal.', schema: S({}),
    run: async () => ({ disponivel: false, mensagem: 'A emissão de nota fiscal ainda não existe na Potira. Ofereça o recibo (Financeiro → Recibo) ou abrir o Financeiro.' }) },
];
const TOOL = Object.fromEntries(TOOLS.map((t) => [t.name, t]));
const nomeP = (cod) => { try { return pacienteDe(cod).name; } catch { return 'paciente'; } };

async function consultarAjuda({ pergunta }) {
  const H = resolvedHelp();
  const palavras = norm(pergunta).split(/\W+/).filter((w) => w.length > 2);
  const itens = H.TOPICS.flatMap((t) => t.items.map(([k, v]) => ({ topico: t.t, onde: t.where, titulo: k, texto: v })));
  const pontos = (it) => { const alvo = norm(`${it.topico} ${it.titulo} ${it.texto}`); return palavras.reduce((s, w) => s + (alvo.includes(w) ? (norm(it.titulo).includes(w) ? 3 : 1) : 0), 0); };
  const melhores = itens.map((it) => [pontos(it), it]).filter(([p]) => p > 0).sort((a, b) => b[0] - a[0]).slice(0, 8).map(([, it]) => it);
  return melhores.length ? { resultados: melhores } : { resultados: [], topicos_disponiveis: H.TOPICS.map((t) => t.t), aviso: 'Nada encontrado. Se a função não estiver na ajuda, diga que ainda não existe ou que não tem certeza.' };
}

async function buscarPacientes({ nome = '' }) {
  const q = norm(nome).split(/\s+/).filter(Boolean);
  const lista = (await pacientes()).filter((p) => q.every((w) => norm(p.name).includes(w)));
  return { total: lista.length, pacientes: lista.slice(0, 15).map((p) => ({ codigo: codigo(p), iniciais: iniciais(p.name), idade: idade(p.birth_date), arquivado: p.archived || undefined })) };
}

async function listarSessoes({ de, ate, paciente, situacao }) {
  if (!okData(de) || !okData(ate)) throw new Error('Datas no formato AAAA-MM-DD.');
  const pid = paciente ? pacienteDe(paciente).id : undefined;
  let rows = await api.listAppointments({ from: de, to: ate, patientId: pid });
  if (situacao) rows = rows.filter((r) => r.status === situacao);
  rows.forEach((r) => sessoesCache.set(r.id, r));
  const pats = await pacientes();
  const byId = Object.fromEntries(pats.map((p) => [p.id, p]));
  return { total: rows.length, sessoes: rows.slice(0, 120).map((r) => ({
    id: r.id, data: r.date, dia: diaSemana(r.date), hora: hhmm(r.time), paciente: codigo(byId[r.patient_id] || { id: r.patient_id, name: r.patients?.name || 'Paciente' }),
    situacao: r.status, confirmacao: r.confirm_status || undefined, valor: r.amount ?? undefined, pagamento: r.status === 'realizado' || r.status === 'falta' ? r.payment_status : undefined,
  })) };
}

async function emAberto() {
  const [sess, cobr] = await Promise.all([api.listOpenCharges(), api.listCharges({ open: true }).catch(() => [])]);
  const pats = await pacientes(), byId = Object.fromEntries(pats.map((p) => [p.id, p]));
  const por = new Map();
  const soma = (pid, v, tipo) => { const o = por.get(pid) || { paciente: codigo(byId[pid] || { id: pid, name: 'Paciente' }), sessoes: 0, cobrancas: 0, total: 0 }; o[tipo] += 1; o.total += Number(v || 0); por.set(pid, o); };
  sess.filter((s) => Number(s.amount) > 0).forEach((s) => soma(s.patient_id, s.amount, 'sessoes'));
  cobr.forEach((c) => soma(c.patient_id, c.amount, 'cobrancas'));
  return [...por.values()].sort((a, b) => b.total - a.total);
}

async function resumoFinanceiro({ de, ate }) {
  if (!okData(de) || !okData(ate)) throw new Error('Datas no formato AAAA-MM-DD.');
  const [pagos, cobrPagas, gastos, aberto] = await Promise.all([api.listPaidBetween(de, ate), api.listCharges({ paidFrom: de, paidTo: ate }).catch(() => []), api.listExpenses({ from: de, to: ate }), emAberto()]);
  const recSess = pagos.reduce((s, a) => s + Number(a.amount || 0), 0), recCobr = cobrPagas.reduce((s, c) => s + Number(c.amount || 0), 0);
  const gPagos = gastos.filter((g) => g.paid !== false).reduce((s, g) => s + Number(g.amount || 0), 0);
  const gAPagar = gastos.filter((g) => g.paid === false).reduce((s, g) => s + Number(g.amount || 0), 0);
  return { periodo: { de, ate }, recebido_sessoes: recSess, recebido_cobrancas: recCobr, recebido_total: recSess + recCobr, gastos_pagos: gPagos, gastos_a_pagar: gAPagar,
    saldo: recSess + recCobr - gPagos, em_aberto_hoje_total: aberto.reduce((s, x) => s + x.total, 0), gastos: gastos.slice(0, 30).map((g) => ({ data: g.date, descricao: g.description, valor: Number(g.amount), pago: g.paid !== false })) };
}

async function listarPendencias() {
  const de = somaDias(hoje(), -30);
  const [aberto, sess, reps] = await Promise.all([emAberto(), api.listAppointments({ from: de, to: hoje() }), api.listReports({ from: de, kind: 'sessao' }).catch(() => [])]);
  const comEvo = new Set(reps.map((r) => r.appointment_id).filter(Boolean));
  const evoDia = new Set(reps.map((r) => r.patient_id + '|' + r.session_date));
  const pats = await pacientes(), byId = Object.fromEntries(pats.map((p) => [p.id, p]));
  const semEvo = sess.filter((s) => s.status === 'realizado' && !comEvo.has(s.id) && !evoDia.has(s.patient_id + '|' + s.date))
    .map((s) => ({ paciente: codigo(byId[s.patient_id] || { id: s.patient_id, name: 'Paciente' }), data: s.date, hora: hhmm(s.time) }));
  const rasc = reps.filter((r) => r.status === 'rascunho').length;
  return { em_aberto: aberto, sessoes_sem_evolucao: semEvo, rascunhos_ultimos_30_dias: rasc };
}

async function lerEvolucoes({ paciente, de, ate }) {
  const p = pacienteDe(paciente);
  const reps = await api.listReports({ patientId: p.id, from: de, to: ate, withSections: true });
  let total = 0;
  const out = [];
  for (const r of reps.sort((a, b) => (a.session_date || '').localeCompare(b.session_date || ''))) {
    const txt = (r.sections || []).map((s) => `${s.title}: ${String(s.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`).join(' | ').replaceAll(p.name, 'o paciente');
    if (total + txt.length > 14000) break;
    total += txt.length;
    out.push({ data: r.session_date, tipo: r.kind, situacao: r.status, texto: txt });
  }
  return { paciente: codigo(p), registros: out.length, evolucoes: out, aviso: out.length ? undefined : 'Nenhuma evolução no período. Não invente conteúdo.' };
}

async function agendarSessao(a) {
  const p = pacienteDe(a.paciente);
  if (!okData(a.data) || !/^\d{1,2}:\d{2}$/.test(a.hora || '')) throw new Error('Data AAAA-MM-DD e hora HH:MM.');
  const dur = Math.min(600, Math.max(5, Number(a.duracao_min) || 50));
  const min = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  const ini = min(a.hora), fim = ini + dur;
  const outras = (await api.listAppointments({ from: a.data, to: a.data })).filter((o) => o.time && o.status !== 'cancelado' && min(o.time) < fim && ini < min(o.time) + (o.duration_min || 50));
  const [s] = await api.saveAppointments([{ patient_id: p.id, date: a.data, time: a.hora, duration_min: dur, status: 'agendado', notes: a.observacao || null, encaixe: false }]);
  return { ok: true, sessao_id: s?.id, data: a.data, hora: a.hora, aviso_conflito: outras.length ? `Atenção: já havia ${outras.length} sessão(ões) nesse horário.` : undefined };
}

async function atualizarSituacao({ sessao_id, situacao }) {
  if (!SIT[situacao]) throw new Error('Situação inválida.');
  const s = sessoesCache.get(sessao_id);
  if (!s) throw new Error('Sessão não encontrada. Use listar_sessoes antes.');
  await api.setAppointmentStatus(s, situacao);
  sessoesCache.set(sessao_id, { ...s, status: situacao });
  return { ok: true, situacao };
}

async function cadastrarPaciente(a) {
  const cpf = soDigitos(a.cpf);
  if (cpf && !cpfValido(cpf)) throw new Error('CPF inválido; peça para conferir.');
  const p = await api.savePatient({ name: String(a.nome).trim().slice(0, 200), phone: a.telefone || null, email: a.email ? String(a.email).toLowerCase() : null,
    birth_date: okData(a.nascimento) ? a.nascimento : null, cpf: cpf || null, origin: 'assistente' });
  pacientesCache = null;
  return { ok: true, paciente: codigo(p), lembrete: 'Falta registrar o consentimento e completar o cadastro na ficha.' };
}

async function lancarGasto(a) {
  if (!okData(a.data) || !(Number(a.valor) >= 0)) throw new Error('Data AAAA-MM-DD e valor numérico.');
  await api.saveExpense({ date: a.data, description: String(a.descricao).slice(0, 200), amount: Number(a.valor), category: a.categoria || null, paid: a.pago !== false });
  return { ok: true };
}

async function abrirTela({ tela, paciente }) {
  const pid = paciente ? pacienteDe(paciente).id : null;
  const rotas = { inicio: '#/painel', pacientes: '#/pacientes', ficha_paciente: pid ? `#/pacientes/${pid}` : '#/pacientes', agenda: '#/administrativo', financeiro: '#/financeiro',
    relatorios: '#/relatorios', nova_evolucao: pid ? `#/nova?paciente=${pid}` : '#/nova', configuracoes: '#/config', chaves_ia: '#/config?aba=chaves', ajuda: '#/ajuda' };
  location.hash = rotas[tela] || '#/painel';
  return { ok: true };
}

/* ---------- conversa com cada provedor ---------- */
function sistema() {
  const h = hoje(), p = state.profile || {};
  return `Você é o Assistente da Potira, plataforma de registro clínico, agenda e cobrança para profissionais de saúde no Brasil.
Hoje é ${diaSemana(h)}, ${fmtDate(h)} (${h}). O profissional é da área: ${p.specialty || 'saúde'}.
Regras:
- Responda em português do Brasil, curto e claro (até 6 linhas ou uma lista curta). Datas sempre dd/mm/aaaa; valores em R$. Diga "sessão", nunca "atendimento".
- Use só as ferramentas para obter dados. Nunca invente pacientes, sessões, valores ou conteúdo clínico. Se não souber, diga.
- Pacientes aparecem como códigos [P1], [P2]. Escreva sempre o código entre colchetes ao citar um paciente: a tela troca pelo nome. Não tente adivinhar nomes.
- Para agir sobre um paciente, primeiro use buscar_pacientes. Se houver mais de um resultado, pergunte qual antes de agir.
- Ações (agendar, mudar situação, cadastrar, lançar gasto) já pedem confirmação na tela; chame a ferramenta direto, sem perguntar "posso?". Se o profissional cancelar, não insista.
- Não apague nada, não mexa em chaves de IA e não dê diagnóstico ou conduta clínica.
- Dúvidas de "como faço" na plataforma: use consultar_ajuda e responda com base nela, indicando onde fica. Se não estiver na ajuda, diga que talvez ainda não exista.
- Converta datas relativas (amanhã, sexta, mês passado) a partir de hoje e use AAAA-MM-DD nas ferramentas.`;
}

const httpErro = (prov, st, corpo) => {
  const nome = ai.PROVIDERS[prov]?.label || prov;
  if (st === 401 || st === 403) return new Error(`Chave de ${nome} inválida ou sem permissão.`);
  if (st === 429) return new Error(`Limite de uso de ${nome} atingido. Tente em instantes.`);
  if (st === 400 && /tool|function/i.test(corpo || '')) return new Error(`O modelo escolhido em ${nome} não aceita ferramentas. Troque o modelo ou o provedor em Configurações → Chaves de IA.`);
  return new Error(`Falha na IA ${nome} (${st}).`);
};

/** Um passo: manda o histórico nativo e devolve { texto, chamadas:[{id,name,args}], bruto } */
async function passo(prov, hist) {
  const key = ai.getKeys()[prov], model = ai.modelOf(prov), sys = sistema();
  if (prov === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model, max_tokens: 1500, system: sys, messages: hist, tools: TOOLS.map((t) => ({ name: t.name, description: t.desc, input_schema: t.schema })) }),
    });
    if (!r.ok) throw httpErro(prov, r.status, await r.text());
    const d = await r.json();
    return { texto: (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(''), chamadas: (d.content || []).filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, args: b.input || {} })), bruto: { role: 'assistant', content: d.content } };
  }
  if (prov === 'gemini') {
    const body = JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: hist, tools: [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.desc, ...(Object.keys(t.schema.properties).length ? { parameters: t.schema } : {}) })) }],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.2 } });
    let r;
    for (const u of ai.geminiUrls(key, model)) {
      r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body }).catch(() => null);
      if (r && (r.ok || ![404, 429, 503].includes(r.status))) break;
    }
    if (!r) throw new Error('Sem resposta do Gemini. Tente de novo.');
    if (!r.ok) throw httpErro(prov, r.status, await r.text());
    const c = (await r.json()).candidates?.[0]?.content || { role: 'model', parts: [] };
    const parts = c.parts || [];
    return { texto: parts.filter((x) => x.text && !x.thought).map((x) => x.text).join(''), chamadas: parts.filter((x) => x.functionCall).map((x, i) => ({ id: 'g' + i, name: x.functionCall.name, args: x.functionCall.args || {} })), bruto: { role: 'model', parts } };
  }
  const p = ai.PROVIDERS[prov];
  const url = p.custom ? p.base.replace(/\/+$/, '') + '/chat/completions' : prov === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
  const r = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, max_tokens: 1500, temperature: 0.2, messages: [{ role: 'system', content: sys }, ...hist], tools: TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.desc, parameters: t.schema } })) }),
  });
  if (!r.ok) throw httpErro(prov, r.status, await r.text());
  const m = (await r.json()).choices?.[0]?.message || {};
  return { texto: m.content || '', chamadas: (m.tool_calls || []).map((c) => { let args = {}; try { args = JSON.parse(c.function.arguments || '{}'); } catch { /* vazio */ } return { id: c.id, name: c.function.name, args }; }),
    bruto: { role: 'assistant', content: m.content || null, ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}) } };
}

const msgUsuario = (prov, texto) => (prov === 'gemini' ? { role: 'user', parts: [{ text: texto }] } : { role: 'user', content: texto });
function msgResultados(prov, res) {
  if (prov === 'anthropic') return [{ role: 'user', content: res.map((x) => ({ type: 'tool_result', tool_use_id: x.id, content: JSON.stringify(x.out) })) }];
  if (prov === 'gemini') return [{ role: 'user', parts: res.map((x) => ({ functionResponse: { name: x.name, response: x.out } })) }];
  return res.map((x) => ({ role: 'tool', tool_call_id: x.id, content: JSON.stringify(x.out) }));
}
/** Corta o histórico sem separar chamada de ferramenta da sua resposta: só começa numa mensagem de texto do usuário. */
function aparar(prov, hist) {
  if (hist.length <= MAX_HIST) return hist;
  const ehTextoUsuario = (m) => m.role === 'user' && (prov === 'gemini' ? m.parts?.some((x) => x.text) : typeof m.content === 'string');
  let i = hist.length - MAX_HIST;
  while (i < hist.length && !ehTextoUsuario(hist[i])) i++;
  return hist.slice(i);
}

/* ---------- painel ---------- */
let hist = [], provHist = '', ocupado = false, painel = null;

const comNomes = (t) => esc(t).replace(/\[(P\d+)\]/g, (m, c) => (porCodigo.has(c) ? `<b>${esc(porCodigo.get(c).name)}</b>` : m))
  .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

function addBolha(quem, html) {
  const box = painel.querySelector('[data-msgs]');
  box.insertAdjacentHTML('beforeend', `<div class="ag-msg ${quem}">${html}</div>`);
  box.scrollTop = box.scrollHeight;
  return box.lastElementChild;
}

function confirmar(texto) {
  return new Promise((resolve) => {
    const el = addBolha('confirma', `<p>${esc(texto)}</p><div class="row"><button type="button" class="btn sm quiet" data-n>Cancelar</button><button type="button" class="btn sm" data-s>Confirmar</button></div>`);
    const fim = (v) => { el.querySelector('.row').outerHTML = `<p class="muted small">${v ? 'Confirmado.' : 'Cancelado.'}</p>`; resolve(v); };
    el.querySelector('[data-s]').onclick = () => fim(true);
    el.querySelector('[data-n]').onclick = () => fim(false);
    el.querySelector('[data-s]').focus();
  });
}

async function enviar(texto) {
  const prov = ai.textProvider();
  if (!prov) return addBolha('ia', esc(ai.noAIMessage));
  if (ocupado) return;
  if (prov !== provHist) { hist = []; provHist = prov; }
  ocupado = true;
  const st = painel.querySelector('[data-estado]'), btn = painel.querySelector('[data-enviar]');
  btn.disabled = true;
  addBolha('eu', esc(texto));
  hist.push(msgUsuario(prov, texto));
  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      st.textContent = 'Pensando…';
      const r = await passo(prov, aparar(prov, hist));
      hist = aparar(prov, hist);
      hist.push(r.bruto);
      if (r.texto.trim()) addBolha('ia', comNomes(r.texto.trim()));
      if (!r.chamadas.length) break;
      const res = [];
      for (const c of r.chamadas) {
        const t = TOOL[c.name];
        let out;
        try {
          if (!t) throw new Error('Ferramenta desconhecida.');
          if (t.mutacao && !(await confirmar(t.resumo(c.args)))) out = { cancelado: true, mensagem: 'O profissional cancelou. Não repita a ação.' };
          else { st.textContent = 'Executando…'; out = await t.run(c.args || {}); }
        } catch (e) { out = { erro: e.message || String(e) }; }
        res.push({ id: c.id, name: c.name, out });
      }
      hist.push(...msgResultados(prov, res));
      if (volta === MAX_VOLTAS - 1) addBolha('ia', 'Parei aqui para não gastar sua cota. Pode reformular o pedido?');
    }
  } catch (e) {
    addBolha('ia erro', esc(e.message || String(e)));
    hist = []; // recomeça limpo para não mandar um histórico quebrado
  } finally { ocupado = false; st.textContent = ''; btn.disabled = false; painel.querySelector('textarea').focus(); }
}

const EXEMPLOS = ['Quem eu atendo hoje?', 'Quem está devendo?', 'Quais evoluções estão pendentes?', 'Como importo meus pacientes?'];

function abrir() {
  if (!painel) {
    painel = document.createElement('aside');
    painel.className = 'ag-painel';
    painel.setAttribute('aria-label', 'Assistente');
    painel.innerHTML = `
      <header class="ag-topo"><b>Assistente</b><span class="muted small" data-prov></span><span class="grow"></span>
        <button type="button" class="btn sm quiet" data-limpar title="Começar conversa nova">Limpar</button>
        <button type="button" class="modal-x" data-fechar aria-label="Fechar">${icon('x')}</button></header>
      <div class="ag-msgs" data-msgs aria-live="polite"></div>
      <form class="ag-form" data-form>
        <textarea rows="2" placeholder="Peça para agendar, consultar a agenda, o financeiro, ou pergunte como fazer algo…" aria-label="Mensagem"></textarea>
        <div class="row"><span class="muted small" data-estado></span><span class="grow"></span><button class="btn sm" data-enviar>Enviar</button></div>
      </form>`;
    document.body.appendChild(painel);
    const ta = painel.querySelector('textarea');
    painel.querySelector('[data-form]').onsubmit = (e) => { e.preventDefault(); const t = ta.value.trim(); if (t) { ta.value = ''; enviar(t); } };
    ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); painel.querySelector('[data-form]').requestSubmit(); } };
    painel.querySelector('[data-fechar]').onclick = fechar;
    painel.querySelector('[data-limpar]').onclick = () => { if (!ocupado) { limpar(); boasVindas(); } };
    painel.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
    painel.addEventListener('click', (e) => { const b = e.target.closest('[data-ex]'); if (b && !ocupado) enviar(b.dataset.ex); });
    boasVindas();
  }
  painel.querySelector('[data-prov]').textContent = ai.PROVIDERS[ai.textProvider()]?.label || '';
  painel.classList.add('on');
  document.body.classList.add('ag-aberto');
  painel.querySelector('textarea').focus();
}
function boasVindas() {
  addBolha('ia', `Olá! Posso tirar dúvidas de como usar a Potira, consultar sua agenda e o financeiro, e fazer ações como agendar ou marcar falta — sempre pedindo sua confirmação antes.
    <div class="ag-ex">${EXEMPLOS.map((x) => `<button type="button" class="pilula" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>`);
}
function fechar() { if (painel) painel.classList.remove('on'); document.body.classList.remove('ag-aberto'); }
function limpar() {
  hist = []; codigos = new Map(); porCodigo = new Map(); sessoesCache = new Map(); pacientesCache = null;
  if (painel) painel.querySelector('[data-msgs]').innerHTML = '';
}

/** Mostra ou esconde o botão do Assistente conforme quem está logado e se há IA. Chamado a cada troca de tela. */
export function atualizarAssistente() {
  const p = state.profile;
  const pode = Boolean(p && p.role === 'professional' && !api.isStaff() && ai.hasTextAI() && !location.hash.startsWith('#/nova'));
  let fab = document.getElementById('ag-fab');
  if (!pode) { if (fab) fab.remove(); fechar(); return; }
  pacientesCache = null; // dados podem ter mudado em outra tela
  if (!fab) {
    fab = document.createElement('button');
    fab.id = 'ag-fab'; fab.type = 'button'; fab.className = 'ag-fab';
    fab.title = 'Assistente'; fab.setAttribute('aria-label', 'Abrir o Assistente');
    fab.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>`;
    fab.onclick = () => (painel?.classList.contains('on') ? fechar() : abrir());
    document.body.appendChild(fab);
  }
}
/** Ao sair da conta: some com tudo e esquece a conversa. */
export function encerrarAssistente() { limpar(); document.getElementById('ag-fab')?.remove(); painel?.remove(); painel = null; document.body.classList.remove('ag-aberto'); }
