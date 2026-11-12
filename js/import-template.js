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

export async function pdfToText(file) {
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

/* ---------- timbre do .docx: logo, marca d'água, cabeçalho e rodapé ---------- */
const JSZIP = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
const IMG_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };

/** Reduz a imagem para caber no modelo (lado maior até `max`, e no máximo ~300 KB). */
async function shrink(dataUrl, max) {
  const img = new Image();
  await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('imagem')); img.src = dataUrl; });
  let k = Math.min(1, max / Math.max(img.width, img.height)), out = dataUrl;
  for (let t = 0; t < 4; t++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    out = c.toDataURL('image/png');
    if (out.length < 400000) break;
    k *= 0.65;
  }
  return out;
}

const all = (root) => [...root.getElementsByTagName('*')];
const inside = (el, name) => { for (let n = el.parentNode; n && n.localName; n = n.parentNode) if (n.localName === name) return n; return null; };

/** Texto de um cabeçalho/rodapé, uma linha por parágrafo, sem numeração de página. */
function partLines(doc) {
  const byP = new Map();
  all(doc).forEach((el) => {
    if (!['t', 'tab', 'br'].includes(el.localName) || inside(el, 'Fallback')) return;
    const par = inside(el, 'p'); if (!par) return;
    byP.set(par, (byP.get(par) || '') + (el.localName === 't' ? el.textContent : ' '));
  });
  return [...byP.values()].map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && !/^(p[áa]g(ina|\.)?\s*)?\d*(\s*(de|\/)\s*\d*)?$/i.test(l));
}

/** Imagens de uma parte: { rid, kind: 'logo' | 'marca', opacity } e marca d'água em texto. */
function partImages(doc) {
  const imgs = []; let text = '';
  all(doc).forEach((el) => {
    if (el.localName === 'blip' && !inside(el, 'Fallback')) {
      const rid = el.getAttribute('r:embed'); if (!rid) return;
      const anchor = inside(el, 'anchor');
      const atras = anchor && anchor.getAttribute('behindDoc') === '1';
      imgs.push({ rid, kind: atras ? 'marca' : 'logo', opacity: 1 });
    } else if (el.localName === 'imagedata') {
      const rid = el.getAttribute('r:id'); if (!rid) return;
      const shape = inside(el, 'shape');
      const marca = /watermark/i.test((shape && shape.getAttribute('id')) || '');
      if (inside(el, 'Fallback') && !marca) return;
      const lavada = el.hasAttribute('gain') || el.hasAttribute('blacklevel');
      imgs.push({ rid, kind: marca ? 'marca' : 'logo', opacity: marca && lavada ? 0.15 : 1 });
    } else if (el.localName === 'textpath' && el.getAttribute('string')) {
      const shape = inside(el, 'shape');
      if (/watermark/i.test((shape && shape.getAttribute('id')) || '')) text = el.getAttribute('string');
    }
  });
  return { imgs, text };
}

async function docxLayout(file) {
  await load(JSZIP, () => window.JSZip);
  const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
  const xmlOf = async (path) => { const f = zip.file(path); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
  const imageOf = async (part, rid, max) => {
    const rels = await xmlOf(`word/_rels/${part}.rels`); if (!rels) return null;
    const rel = all(rels).find((r) => r.getAttribute('Id') === rid); if (!rel) return null;
    const target = rel.getAttribute('Target').replace(/^\/?(word\/)?/, '').replace(/^\.\.\//, '');
    const ext = (target.split('.').pop() || '').toLowerCase();
    const f = zip.file(`word/${target}`);
    if (!f || !IMG_MIME[ext]) return null; // EMF/WMF não abrem no navegador
    try { return await shrink(`data:${IMG_MIME[ext]};base64,${await f.async('base64')}`, max); } catch { return null; }
  };
  const names = (re) => Object.keys(zip.files).filter((n) => re.test(n)).sort();
  const out = { header: '', footer: '', logo: null, watermark: null };

  for (const path of names(/^word\/header\d*\.xml$/)) {
    const doc = await xmlOf(path); if (!doc) continue;
    const part = path.split('/').pop();
    const text = partLines(doc).join('\n');
    if (text.length > out.header.length) out.header = text;
    const { imgs, text: wmText } = partImages(doc);
    for (const im of imgs) {
      if (im.kind === 'logo' && !out.logo) out.logo = await imageOf(part, im.rid, 360);
      if (im.kind === 'marca' && !(out.watermark && out.watermark.image)) {
        const image = await imageOf(part, im.rid, 760);
        if (image) out.watermark = { image, opacity: im.opacity };
      }
    }
    if (wmText && !out.watermark) out.watermark = { text: wmText };
  }
  for (const path of names(/^word\/footer\d*\.xml$/)) {
    const doc = await xmlOf(path); if (!doc) continue;
    const text = partLines(doc).join('\n');
    if (text.length > out.footer.length) out.footer = text;
  }
  // logo no começo do corpo do documento (documentos sem cabeçalho do Word)
  if (!out.logo) {
    const doc = await xmlOf('word/document.xml');
    if (doc) {
      const pars = all(doc).filter((e) => e.localName === 'p' && !inside(e, 'p')).slice(0, 6);
      for (const par of pars) {
        const blip = all(par).find((e) => e.localName === 'blip' && e.getAttribute('r:embed'));
        if (blip) { out.logo = await imageOf('document.xml', blip.getAttribute('r:embed'), 360); break; }
      }
    }
  }
  return out.header || out.footer || out.logo || out.watermark ? out : null;
}

export const fileToBase64 = (file) => new Promise((resolve, reject) => {
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
  // Timbre do documento (só em .docx): se a leitura falhar, o modelo segue sem ele.
  let layout = null;
  if (isDocx) { try { say('Lendo logo, cabeçalho e rodapé…'); layout = await docxLayout(file); } catch { layout = null; } }
  return { name: result.name || name, sections: result.sections, usedAI, source: file.name, layout, isDocx };
}
