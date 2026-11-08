// IA opcional, com a chave de cada profissional. As chaves ficam apenas no
// navegador (localStorage) deste computador e nunca são enviadas ao banco.
// Sem nenhuma chave, o sistema continua funcionando em modo manual.
const KEY = 'florescer.keys.v1';

export const PROVIDERS = {
  gemini: {
    label: 'Google Gemini', free: true, text: true, vision: true, stt: false,
    model: 'gemini-3.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    steps: 'Entre com sua conta Google, toque em “Create API key” e copie a chave.',
    privacy: 'No plano gratuito, o Google pode usar o conteúdo enviado para melhorar seus produtos. Para dados de pacientes, prefira um plano pago ou outro provedor.',
  },
  groq: {
    label: 'Groq (Llama + Whisper)', free: true, text: true, vision: false, stt: true,
    model: 'llama-3.3-70b-versatile', sttModel: 'whisper-large-v3-turbo',
    keyUrl: 'https://console.groq.com/keys',
    steps: 'Crie uma conta, abra “API Keys”, toque em “Create API Key” e copie a chave. Serve também para transcrever áudio.',
    privacy: 'Plano gratuito com limites diários. Confira os termos de uso de dados do provedor antes de enviar conteúdo de pacientes.',
  },
  anthropic: {
    label: 'Anthropic (Claude)', free: false, text: true, vision: true, stt: false,
    model: 'claude-sonnet-5-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    steps: 'Crie uma chave em Settings → API Keys. O uso é cobrado por consumo.',
    privacy: 'API paga. Por padrão, o conteúdo enviado pela API não é usado para treinar modelos.',
  },
  openai: {
    label: 'OpenAI (GPT + Whisper)', free: false, text: true, vision: true, stt: true,
    model: 'gpt-4o-mini', sttModel: 'whisper-1',
    keyUrl: 'https://platform.openai.com/api-keys',
    steps: 'Crie uma chave em API keys. O uso é cobrado por consumo. Serve também para transcrever áudio.',
    privacy: 'API paga. Confira a política de retenção de dados da conta.',
  },
};

export const modelOf = (id) => (getKeys().models || {})[id] || PROVIDERS[id]?.model;
export const getKeys = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
export const setKeys = (k) => localStorage.setItem(KEY, JSON.stringify(k));
export const clearKeys = () => localStorage.removeItem(KEY);

/** Provedor de texto em uso: o escolhido ou, se faltar, o primeiro com chave. */
export function textProvider() {
  const k = getKeys();
  if (k.textProvider && k[k.textProvider]) return k.textProvider;
  return Object.keys(PROVIDERS).find((p) => k[p]) || '';
}
export function sttProvider() {
  const k = getKeys();
  if (k.sttProvider && k[k.sttProvider] && PROVIDERS[k.sttProvider]?.stt) return k.sttProvider;
  return ['groq', 'openai'].find((p) => k[p]) || '';
}
export const hasTextAI = () => Boolean(textProvider());
export const hasTranscribeAI = () => Boolean(sttProvider());
export const hasVisionAI = () => {
  const k = getKeys();
  return ['gemini', 'anthropic', 'openai'].find((p) => k[p]) || '';
};
// nomes antigos, usados em outras telas
export const hasClaudeKey = hasTextAI;
export const hasWhisperKey = hasTranscribeAI;
export const noAIMessage = 'Conecte uma IA em Configurações → Chaves de IA para usar este recurso. Há opções gratuitas.';

const httpError = (name, status) => {
  if (status === 401 || status === 403) return new Error(`Chave de ${name} inválida ou sem permissão.`);
  if (status === 429) return new Error(`Limite de uso de ${name} atingido (cota gratuita ou crédito). Tente em instantes.`);
  return new Error(`Falha na IA ${name} (${status}).`);
};

/* ---------- texto ---------- */
async function callText(provider, key, system, user, { maxTokens = 4000, json = false, image = null, model: pick } = {}) {
  const p = PROVIDERS[provider];
  const model = pick || modelOf(provider);
  if (provider === 'anthropic') {
    const content = image
      ? [{ type: 'image', source: { type: 'base64', media_type: image.mime, data: image.b64 } }, { type: 'text', text: user }]
      : user;
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
    });
    if (!r.ok) throw httpError(p.label, r.status);
    return ((await r.json()).content || []).map((b) => b.text || '').join('');
  }
  if (provider === 'gemini') {
    const parts = [{ text: user }];
    if (image) parts.unshift({ inline_data: { mime_type: image.mime, data: image.b64 } });
    const r = await fetchFirst(geminiUrls(key, model), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2, ...(json ? { responseMimeType: 'application/json' } : {}), thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!r.ok) throw httpError(p.label, r.status);
    const d = await r.json();
    return (d.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('');
  }
  // groq e openai: formato compatível com o da OpenAI
  const url = p.custom ? p.base.replace(/\/+$/, '') + '/chat/completions' : provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
  const userContent = image
    ? [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.b64}` } }]
    : user;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, max_tokens: maxTokens, temperature: 0.2,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages: [{ role: 'system', content: system }, { role: 'user', content: userContent }],
    }),
  });
  if (!r.ok) throw httpError(p.label, r.status);
  return (await r.json()).choices?.[0]?.message?.content || '';
}

async function ask(system, user, opts = {}) {
  const provider = opts.image ? hasVisionAI() : textProvider();
  if (!provider) throw new Error(opts.image ? 'Para ler imagens, conecte Gemini, Claude ou OpenAI em Configurações → Chaves de IA.' : noAIMessage);
  return callText(provider, getKeys()[provider], system, user, opts);
}

async function fetchFirst(urls, init) {
  let r;
  for (const u of urls) {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), 25000);
    try { r = await fetch(u, { ...init, signal: c.signal }); }
    catch (e) { r = null; continue; } // demora demais ou sem rede: tenta o próximo modelo
    finally { clearTimeout(t); }
    if (r.ok || ![401, 403, 404, 429, 503].includes(r.status)) return r;
  }
  if (!r) throw new Error('O Gemini demorou demais para responder. Tente de novo em instantes.');
  return r;
}

/** AI Studio hoje emite chaves "AIza…" e "AQ.…", ambas na API Gemini. Chaves "AQ." do Vertex usam o 2º endereço. */
export const geminiUrls = (key, model) => [
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent`,
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`,
  ...(String(key).startsWith('AQ.') ? [`https://aiplatform.googleapis.com/v1/publishers/google/models/${model}:generateContent`] : []),
];

/** Testa uma chave com uma chamada mínima. Lança erro se falhar. */
export async function testKey(provider, key, model) {
  key = String(key || '').trim();
  const out = await callText(provider, key, 'Responda apenas com a palavra: ok', 'Teste de conexão.', { maxTokens: 20, model });
  if (!out.trim()) throw new Error('A IA respondeu vazio.');
  return true;
}

/* ---------- transcrição ---------- */
export async function transcribeAudio(blob) {
  const provider = sttProvider();
  if (!provider) throw new Error('Para transcrever áudio, conecte Groq (grátis) ou OpenAI em Configurações → Chaves de IA.');
  if (blob.size > 25 * 1024 * 1024) throw new Error('O áudio passa de 25 MB (limite do serviço). Divida o arquivo em partes menores.');
  const type = blob.type || 'audio/webm';
  const ext = type.includes('mp4') || type.includes('m4a') ? 'm4a' : type.includes('mpeg') ? 'mp3' : type.includes('wav') ? 'wav' : type.includes('ogg') ? 'ogg' : 'webm';
  const fd = new FormData();
  fd.append('file', blob, `sessao.${ext}`);
  fd.append('model', PROVIDERS[provider].sttModel);
  fd.append('language', 'pt');
  fd.append('response_format', 'json');
  const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/audio/transcriptions' : 'https://api.openai.com/v1/audio/transcriptions';
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${getKeys()[provider]}` }, body: fd });
  if (!r.ok) throw httpError(PROVIDERS[provider].label, r.status);
  return ((await r.json()).text || '').trim();
}

/* ---------- relatórios ---------- */
function parseJson(raw) {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('A IA devolveu um formato inesperado. Tente novamente.');
  try { return JSON.parse(raw.slice(s, e + 1)); } catch { throw new Error('A IA devolveu um formato inesperado. Tente novamente.'); }
}

function parseSections(raw, template) {
  const obj = parseJson(raw);
  const got = Array.isArray(obj.sections) ? obj.sections : [];
  const norm = (t) => String(t || '').trim().toLowerCase();
  // mantém a ordem, os títulos e o tipo dos campos do modelo
  return template.map((t, i) => {
    const hit = got.find((g) => norm(g.title) === norm(t.title)) || got[i] || {};
    return { title: t.title, text: String(hit.text || '').trim(), ...(t.type ? { type: t.type } : {}), ...(t.options ? { options: t.options } : {}) };
  });
}

const DETAIL = {
  resumido: 'Seja conciso: no máximo 2 ou 3 frases por seção.',
  padrao: 'Seja objetivo: de 2 a 5 frases por seção.',
  detalhado: 'Seja detalhado: até um parágrafo completo por seção, preservando as informações relevantes.',
};

function rules(o = {}) {
  const flag = o.flagUncertain === false ? '' :
    '\n- O material pode conter erros de reconhecimento de fala; quando um trecho for duvidoso, mantenha-o e marque com [verificar].';
  const own = (o.instructions || '').trim()
    ? `\n\nInstruções fixas do profissional (siga-as, desde que não contrariem as regras obrigatórias acima):\n"""${o.instructions.trim()}"""` : '';
  const extra = (o.extra || '').trim()
    ? `\n\nInstruções específicas desta sessão (mesma condição):\n"""${o.extra.trim()}"""` : '';
  return `Regras obrigatórias:
- Use SOMENTE informações presentes no material fornecido. Não invente diagnósticos, medicamentos, doses, escalas, datas ou fatos.
- Se uma seção não tiver conteúdo no material, escreva exatamente: "Não abordado."
- Linguagem técnica, objetiva e neutra, em português do Brasil, referindo-se a "o(a) paciente". Não inclua nomes próprios de pessoas.
- ${DETAIL[o.detail] || DETAIL.padrao}${flag}
- Campos de tipo "marcar" respondem apenas "Sim", "Não" ou "Não abordado."; campos "escolha" respondem com uma das opções listadas ou "Não abordado."; campos "curto" cabem em uma linha; campos "data" usam DD/MM/AAAA.
- Responda APENAS com JSON válido, sem texto antes ou depois, no formato:
{"sections":[{"title":"<título exato da seção>","text":"<texto da seção>"}]}${own}${extra}`;
}

const outlineOf = (template) => template.map((s, i) =>
  `${i + 1}. ${s.title}${s.type && s.type !== 'longo' ? ` [campo ${s.type}${s.options?.length ? ': ' + s.options.join(' / ') : ''}]` : ''}${s.hint ? ` — ${s.hint}` : ''}`).join('\n');

export async function generateSessionSections({ template, transcript, notes, kind, options }) {
  const what = kind === 'anamnese'
    ? 'registro de ANAMNESE (entrevista inicial) a partir da transcrição'
    : 'registro de EVOLUÇÃO (atendimento) a partir da transcrição de uma sessão';
  const system = `Você auxilia profissionais de saúde a redigir RASCUNHOS de ${what}. O profissional revisará tudo.\n${rules(options)}`;
  const user = `Seções do relatório (use exatamente estes títulos, nesta ordem):\n${outlineOf(template)}\n\nTranscrição:\n"""\n${transcript || '(sem transcrição)'}\n"""${(notes || '').trim() ? `\n\nAnotações do profissional durante a sessão:\n"""\n${notes.trim()}\n"""` : ''}`;
  return parseSections(await ask(system, user, { json: true }), template);
}

export async function generatePeriodSections({ template, sessions, periodLabel, options }) {
  const system = `Você auxilia profissionais de saúde a redigir RASCUNHOS de relatório de acompanhamento a partir dos registros das sessões de um período. O profissional revisará tudo.\n${rules(options)}`;
  const body = sessions.map((r) =>
    `### ${r.kindLabel || 'Sessão'} de ${r.date} — ${r.title}\n` + r.sections.map((s) => `${s.title}: ${s.text}`).join('\n')).join('\n\n');
  const user = `Período: ${periodLabel}\nNúmero de registros: ${sessions.length}\n\nSeções do relatório (use exatamente estes títulos, nesta ordem):\n${outlineOf(template)}\n\nRegistros:\n"""\n${body}\n"""`;
  return parseSections(await ask(system, user, { maxTokens: 5000, json: true }), template);
}

/** Reescreve uma única seção, seguindo uma instrução do profissional. */
export async function rewriteSection({ title, hint, transcript, current, instruction, options }) {
  const system = `Você auxilia profissionais de saúde a redigir UMA seção de um registro de atendimento. O profissional revisará o texto.
Regras obrigatórias:
- Use SOMENTE informações presentes na transcrição ou no texto atual. Não invente fatos, diagnósticos, doses ou datas.
- Se não houver conteúdo, escreva exatamente: "Não abordado."
- Português do Brasil, linguagem técnica e neutra, "o(a) paciente", sem nomes próprios.
- ${DETAIL[(options || {}).detail] || DETAIL.padrao}
- Responda APENAS com JSON válido: {"text":"<texto da seção>"}${(options?.instructions || '').trim() ? `\n\nInstruções fixas do profissional (se não contrariarem as regras):\n"""${options.instructions.trim()}"""` : ''}`;
  const user = `Seção: ${title}${hint ? ` — ${hint}` : ''}\n\nTexto atual:\n"""\n${current || '(vazio)'}\n"""\n\nTranscrição:\n"""\n${transcript || '(não disponível)'}\n"""\n\nInstrução do profissional: ${instruction || 'Reescreva a seção com clareza.'}`;
  return String(parseJson(await ask(system, user, { maxTokens: 1500, json: true })).text || '').trim();
}

/* ---------- modelos a partir de documentos ---------- */
const TEMPLATE_SYSTEM = `Você analisa o MODELO de um documento clínico (ficha, anamnese, relatório, laudo, declaração) e extrai a lista de campos a preencher.
Regras:
- Devolva os campos na ordem em que aparecem. Ignore cabeçalho institucional, logotipo, rodapé e linhas de assinatura.
- Não copie dados de pessoas reais que estejam preenchidos no exemplo.
- Para cada campo: "title" (rótulo curto), "hint" (instrução curta do que escrever, pode ser vazia), "type" (um de: curto, longo, data, marcar, escolha) e, só para "escolha", "options" (lista de opções).
- "curto" = uma linha (nome, idade, profissão); "longo" = texto livre; "data" = data; "marcar" = sim/não; "escolha" = opções fixas.
Responda APENAS com JSON válido: {"name":"<nome sugerido do modelo>","sections":[{"title":"","hint":"","type":"","options":[]}]}`;

export async function extractTemplateFromText(text) {
  const out = parseJson(await ask(TEMPLATE_SYSTEM, `Texto do documento-modelo:\n"""\n${text.slice(0, 24000)}\n"""`, { maxTokens: 3000, json: true }));
  return cleanTemplate(out);
}
export async function extractTemplateFromImage(image) {
  const out = parseJson(await ask(TEMPLATE_SYSTEM, 'Esta é uma imagem (foto ou digitalização) do documento-modelo. Extraia os campos.', { maxTokens: 3000, json: true, image }));
  return cleanTemplate(out);
}
function cleanTemplate(o) {
  const types = ['curto', 'longo', 'data', 'marcar', 'escolha'];
  const sections = (Array.isArray(o.sections) ? o.sections : []).map((s) => {
    const type = types.includes(s.type) ? s.type : 'longo';
    return {
      title: String(s.title || '').trim(), hint: String(s.hint || '').trim(), type,
      ...(type === 'escolha' ? { options: (Array.isArray(s.options) ? s.options : []).map((x) => String(x).trim()).filter(Boolean) } : {}),
    };
  }).filter((s) => s.title);
  if (!sections.length) throw new Error('Não encontrei campos neste documento. Tente outro arquivo ou monte o modelo manualmente.');
  return { name: String(o.name || '').trim(), sections };
}
