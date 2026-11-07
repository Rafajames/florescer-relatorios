// IA com a chave de cada profissional. As chaves ficam apenas no navegador
// (localStorage) deste computador e nunca são enviadas ao banco de dados.
const KEY = 'florescer.keys.v1';
export const MODEL = 'claude-sonnet-5-5';

export const getKeys = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
export const setKeys = (k) => localStorage.setItem(KEY, JSON.stringify(k));
export const clearKeys = () => localStorage.removeItem(KEY);
export const hasClaudeKey = () => Boolean(getKeys().anthropic);
export const hasWhisperKey = () => Boolean(getKeys().openai);

/* ---------- transcrição (Whisper) ---------- */
export async function transcribeAudio(blob) {
  const { openai } = getKeys();
  if (!openai) throw new Error('Cadastre sua chave da OpenAI (Whisper) em Configurações para transcrever áudio.');
  if (blob.size > 25 * 1024 * 1024) throw new Error('O áudio passa de 25 MB (limite do Whisper). Divida o arquivo em partes menores.');
  const type = blob.type || 'audio/webm';
  const ext = type.includes('mp4') || type.includes('m4a') ? 'm4a' : type.includes('mpeg') ? 'mp3' : type.includes('wav') ? 'wav' : type.includes('ogg') ? 'ogg' : 'webm';
  const fd = new FormData();
  fd.append('file', blob, `sessao.${ext}`);
  fd.append('model', 'whisper-1');
  fd.append('language', 'pt');
  fd.append('response_format', 'json');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${openai}` }, body: fd,
  });
  if (!r.ok) {
    if (r.status === 401) throw new Error('Chave da OpenAI inválida.');
    if (r.status === 429) throw new Error('Limite ou crédito da conta OpenAI esgotado.');
    throw new Error(`Falha na transcrição (${r.status}).`);
  }
  return ((await r.json()).text || '').trim();
}

/* ---------- Claude ---------- */
async function claude(system, user, maxTokens = 4000) {
  const { anthropic } = getKeys();
  if (!anthropic) throw new Error('Cadastre sua chave da Anthropic (Claude) em Configurações para gerar esboços.');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropic,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!r.ok) {
    if (r.status === 401) throw new Error('Chave da Anthropic inválida.');
    if (r.status === 429) throw new Error('Limite de uso da conta Anthropic atingido. Tente em instantes.');
    throw new Error(`Falha na IA (${r.status}).`);
  }
  const d = await r.json();
  return (d.content || []).map((b) => b.text || '').join('');
}

function parseSections(raw, template) {
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('A IA devolveu um formato inesperado. Tente novamente.');
  let obj;
  try { obj = JSON.parse(raw.slice(s, e + 1)); } catch { throw new Error('A IA devolveu um formato inesperado. Tente novamente.'); }
  const got = Array.isArray(obj.sections) ? obj.sections : [];
  const norm = (t) => String(t || '').trim().toLowerCase();
  // mantém a ordem e os títulos do modelo
  return template.map((t, i) => {
    const hit = got.find((g) => norm(g.title) === norm(t.title)) || got[i] || {};
    return { title: t.title, text: String(hit.text || '').trim() };
  });
}

const RULES = `Regras obrigatórias:
- Use SOMENTE informações presentes no material fornecido. Não invente diagnósticos, medicamentos, doses, escalas, datas ou fatos.
- Se uma seção não tiver conteúdo no material, escreva exatamente: "Não abordado."
- Linguagem técnica, objetiva e neutra, em português do Brasil, referindo-se a "o(a) paciente". Não inclua nomes próprios de pessoas.
- O material pode conter erros de reconhecimento de fala; quando um trecho for duvidoso, mantenha-o e marque com [verificar].
- Responda APENAS com JSON válido, sem texto antes ou depois, no formato:
{"sections":[{"title":"<título exato da seção>","text":"<texto da seção>"}]}`;

export async function generateSessionSections({ template, transcript }) {
  const system = `Você auxilia profissionais de saúde a redigir RASCUNHOS de registro de atendimento a partir da transcrição de uma sessão. O profissional revisará tudo.\n${RULES}`;
  const outline = template.map((s, i) => `${i + 1}. ${s.title}${s.hint ? ` — ${s.hint}` : ''}`).join('\n');
  const user = `Seções do relatório (use exatamente estes títulos, nesta ordem):\n${outline}\n\nTranscrição da sessão:\n"""\n${transcript}\n"""`;
  return parseSections(await claude(system, user), template);
}

export async function generatePeriodSections({ template, sessions, periodLabel }) {
  const system = `Você auxilia profissionais de saúde a redigir RASCUNHOS de relatório de acompanhamento a partir dos registros das sessões de um período. O profissional revisará tudo.\n${RULES}`;
  const outline = template.map((s, i) => `${i + 1}. ${s.title}${s.hint ? ` — ${s.hint}` : ''}`).join('\n');
  const body = sessions.map((r) =>
    `### Sessão de ${r.date} — ${r.title}\n` + r.sections.map((s) => `${s.title}: ${s.text}`).join('\n')).join('\n\n');
  const user = `Período: ${periodLabel}\nNúmero de sessões: ${sessions.length}\n\nSeções do relatório (use exatamente estes títulos, nesta ordem):\n${outline}\n\nRegistros das sessões:\n"""\n${body}\n"""`;
  return parseSections(await claude(system, user, 5000), template);
}
