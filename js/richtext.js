// Texto com formatação simples (negrito, itálico, sublinhado, listas, títulos, alinhamento).
// Guardado em section.html (já limpo); section.text continua com o texto puro para IA e busca.
const ALLOW = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'P', 'BR', 'UL', 'OL', 'LI', 'H3', 'DIV', 'TABLE', 'TBODY', 'TR', 'TD', 'TH']);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export const textToHtml = (t) => esc(t).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

/** Mantém só as tags permitidas e o alinhamento; remove todo o resto (scripts, atributos, links). */
export function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  const walk = (node) => {
    let out = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { out += esc(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      const inner = walk(n);
      if (!ALLOW.has(n.tagName)) { out += inner; return; }
      if (n.tagName === 'BR') { out += '<br>'; return; }
      const al = (n.style && n.style.textAlign) || '';
      const attr = /^(center|right|justify)$/.test(al) ? ` style="text-align:${al}"` : '';
      const t = n.tagName.toLowerCase();
      out += `<${t}${attr}>${inner}</${t}>`;
    });
    return out;
  };
  return walk(doc.body);
}

/** HTML pronto para exibir/exportar: usa o formatado se houver, senão o texto puro. */
export const bodyHtml = (s) => (s.html ? sanitize(s.html) : textToHtml(s.text));

export const TOOLS = [
  ['bold', 'N', 'Negrito (Ctrl+B)'], ['italic', 'I', 'Itálico (Ctrl+I)'], ['underline', 'S', 'Sublinhado (Ctrl+U)'],
  ['insertUnorderedList', '•', 'Lista com marcadores'], ['insertOrderedList', '1.', 'Lista numerada'],
  ['formatBlock:h3', 'T', 'Título'], ['formatBlock:p', '¶', 'Parágrafo'],
  ['table', '▦', 'Inserir tabela'], ['justifyLeft', '⇤', 'Alinhar à esquerda'], ['justifyCenter', '↔', 'Centralizar'], ['justifyFull', '☰', 'Justificar'],
];
export const toolbarHtml = () => `<div class="rt-bar" role="toolbar" aria-label="Formatação">${TOOLS.map(([c, l, t]) => `<button type="button" class="rt-b" data-cmd="${c}" title="${t}" aria-label="${t}">${l}</button>`).join('')}</div>`;
export function runCmd(cmd) {
  if (cmd === 'table') { document.execCommand('insertHTML', false, '<table><tbody>' + '<tr><td><br></td><td><br></td><td><br></td></tr>'.repeat(3) + '</tbody></table><p><br></p>'); return; }
  const [c, v] = cmd.split(':');
  document.execCommand(c, false, v ? `<${v}>` : null);
}
