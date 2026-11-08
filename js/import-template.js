// Importa um documento (.docx, PDF ou foto) e transforma em um modelo de campos.
// Sem IA, usa uma leitura por regras (títulos, "Rótulo:", itens numerados, caixas
// de marcar). Com IA conectada, a IA refina o resultado e também lê fotos.
import * as ai from './ai.js';

const load = (src, test) => new Promise((resolve, reject) => {
  if (test()) return resolve();
  const s = document.createElement('script');
  s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Não consegui carregar o leitor de documentos. Verifique sua conexão.'));
  document.head.appendChild(s);
});

const MAMMOTH = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js';
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

/* ---------- extração de texto ---------- */
async function docxToText(file) {
  await load(MAMMOTH, () => window.mammoth);
  const buf = await file.arrayBuffer();
  const { value: html } = await window.mammoth.convertToHtml({ arrayBuffer: buf });
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  doc.body.childNodes.forEach((n) => {
    const tag = n.nodeName.toLowerCase();
    const text = (n.textContent || '').replace(/\s+/g, ' ').trim();
    if (tag === 'table') {
      n.querySelectorAll('tr').forEach((tr) => {
        const cells = [...tr.children].map((c) => c.textContent.replace(/\s+/g, ' ').trim());
        if (cells.length === 2 && cells[0] && !cells[1]) out.push(`${cells[0]}:`);
        else if (cells.length) out.push(cells.filter(Boolean).join(': '));
      });
    } else if (/^h[1-6]$/.test(tag) && text) out.push(`## ${text}`);
    else if (tag === 'p' && text && n.querySelector('strong') && n.querySelector('strong').textContent.trim() === text) out.push(`## ${text}`);
    else if (tag === 'ul' || tag === 'ol') n.querySelectorAll('li').forEach((li) => out.push(li.textContent.trim()));
    else if (text) out.push(text);
  });
  return out.join('\n');
}

async function pdfToText(file) {
  await load(PDFJS, () => window.pdfjsLib);
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 15); i++) {
    const page = await (await pdf.getPage(i)).getTextContent();
    let y = null, cur = '';
    page.items.forEach((it) => {
      const ny = Math.round(it.transform[5]);
      if (y !== null && Math.abs(ny - y) > 3) { if (cur.trim()) lines.push(cur.trim()); cur = ''; }
      cur += it.str; y = ny;
    });
    if (cur.trim()) lines.push(cur.trim());
  }
  return lines.join('\n');
}

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1]);
  r.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
  r.readAsDataURL(file);
});

/* ---------- leitura por regras (funciona sem IA) ---------- */
const BOX = /^[\s]*(?:\[\s?[xX]?\s?\]|☐|☑|□|\(\s?\))\s*/;

export function guessFields(text) {
  const raw = text.split('\n').map((l) => l.replace(/_{2,}|\.{4,}/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const fields = [];
  const push = (title, extra = {}) => {
    title = title.replace(/^(\d+[.)\-]|[•\-–—*]+)\s*/, '').replace(/[:：]\s*$/, '').trim();
    if (!title || title.length > 70 || /^(página|pag\.?)\s*\d+/i.test(title)) return;
    if (fields.some((f) => f.title.toLowerCase() === title.toLowerCase())) return;
    const lower = title.toLowerCase();
    let type = extra.type || 'longo';
    if (!extra.type) {
      if (/\b(data|nascimento|dt\.?)\b/.test(lower)) type = 'data';
      else if (/^(nome|idade|profiss|escolaridade|telefone|e-?mail|endere|cpf|rg|sexo|estado civil|naturalidade|responsável|cidade)/.test(lower)) type = 'curto';
    }
    fields.push({ title, hint: extra.hint || '', type, ...(extra.options ? { options: extra.options } : {}) });
  };

  const withBoxes = (opts) => {
    if (!opts.length) return {};
    const low = opts.map((o) => o.toLowerCase());
    if (opts.length === 2 && low.some((o) => o === 'sim') && low.some((o) => o === 'não' || o === 'nao')) return { type: 'marcar' };
    return { type: 'escolha', options: opts };
  };

  for (let i = 0; i < raw.length; i++) {
    const line = raw[i];
    if (BOX.test(line)) continue; // opções são tratadas junto do campo anterior
    const next = [];
    for (let j = i + 1; j < raw.length && BOX.test(raw[j]); j++) next.push(raw[j].replace(BOX, '').trim());
    const caps = line.length > 3 && line === line.toUpperCase() && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(line);
    // cabeçalho do documento (nome da clínica, título): linhas em maiúsculas no início
    if (fields.length === 0 && i < 3 && caps && !next.length && !/:\s*$/.test(line)) continue;
    if (line.startsWith('## ')) { push(line.slice(3), withBoxes(next)); continue; }
    const m = line.match(/^(.{2,60}?):\s*(.*)$/);
    if (m && !/^\d{1,2}:\d{2}/.test(line)) {
      const rest = m[2].trim();
      if (!rest || rest.length < 25) { push(m[1], withBoxes(next)); continue; }
    }
    // pergunta ou rótulo seguido de caixas de marcar
    if (next.length && line.length <= 70) { push(line, withBoxes(next)); continue; }
    // linha curta em MAIÚSCULAS ou numerada, sem ponto final: provável título
    const numbered = /^\d+[.)]\s+\S/.test(line);
    if ((numbered || caps) && line.length <= 60 && !/[.!?]$/.test(line)) push(line.replace(/^\d+[.)]\s*/, ''));
  }
  return fields;
}

/* ---------- ponto de entrada ---------- */
export async function importTemplate(file, { onStatus } = {}) {
  const say = (t) => onStatus && onStatus(t);
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  const isImg = /^image\//.test(file.type);
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isDocx = /\.docx$/i.test(file.name) || file.type.includes('wordprocessingml');
  if (/\.doc$/i.test(file.name) && !isDocx) throw new Error('Arquivos .doc antigos não são lidos. Abra no Word e salve como .docx ou PDF.');

  let result = null, text = '', usedAI = false;

  if (isImg) {
    if (!ai.hasVisionAI()) throw new Error('Para ler uma foto, conecte Gemini, Claude ou OpenAI em Configurações → Chaves de IA. Ou envie o documento em .docx ou PDF.');
    say('A IA está lendo a imagem…');
    const b64 = await fileToBase64(file);
    result = await ai.extractTemplateFromImage({ mime: file.type, b64 });
    usedAI = true;
  } else {
    say('Lendo o documento…');
    text = isDocx ? await docxToText(file) : isPdf ? await pdfToText(file) : '';
    if (!text && !isDocx && !isPdf) throw new Error('Formato não suportado. Envie .docx, PDF ou uma foto (JPG/PNG).');
    if (!text.trim()) throw new Error('Não encontrei texto neste arquivo (pode ser uma digitalização). Tente enviar como foto com IA conectada.');
    if (ai.hasTextAI()) {
      try { say('A IA está identificando os campos…'); result = await ai.extractTemplateFromText(text); usedAI = true; }
      catch { result = null; /* cai na leitura por regras */ }
    }
    if (!result) {
      const sections = guessFields(text);
      if (!sections.length) throw new Error('Não consegui identificar campos neste documento. Você pode montar o modelo manualmente.');
      result = { name: '', sections };
    }
  }
  return { name: result.name || name, sections: result.sections, usedAI, source: file.name };
}
