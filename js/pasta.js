// Pasta dos documentos no computador do profissional (File System Access API).
// Funciona no Chrome e no Edge do computador. A plataforma não guarda cópia: os arquivos ficam só nessa pasta.
// A pasta escolhida é lembrada neste navegador (IndexedDB); o navegador pode pedir a permissão de novo.

const DB = 'potira-pasta', STORE = 'handles', KEY = 'raiz';
export const TIPOS = ['Relatórios', 'Recibos', 'Cobranças', 'Laudos e exames', 'Outros'];

export const suportada = () => typeof window.showDirectoryPicker === 'function';

const idb = (modo, fn) => new Promise((ok, no) => {
  const req = indexedDB.open(DB, 1);
  req.onupgradeneeded = () => req.result.createObjectStore(STORE);
  req.onerror = () => no(req.error);
  req.onsuccess = () => {
    const tx = req.result.transaction(STORE, modo); const r = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { req.result.close(); ok(r && r.result); };
    tx.onerror = () => { req.result.close(); no(tx.error); };
  };
});

/** Nome seguro para pasta ou arquivo no Windows, macOS e Linux. */
export const nomeSeguro = (s) => String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 100) || 'Sem nome';

/** Pasta lembrada (ou null). Não pede permissão. */
export async function raiz() {
  if (!suportada()) return null;
  try { return (await idb('readonly', (s) => s.get(KEY))) || null; } catch { return null; }
}
/** 'ok' | 'pedir' (precisa de um clique do usuário) | 'sem' (nenhuma pasta escolhida ou navegador sem suporte). */
export async function estado() {
  const h = await raiz(); if (!h) return 'sem';
  try { return (await h.queryPermission({ mode: 'readwrite' })) === 'granted' ? 'ok' : 'pedir'; } catch { return 'pedir'; }
}
/** Pede a permissão de novo. Só funciona dentro de um clique. */
export async function liberar() {
  const h = await raiz(); if (!h) return false;
  try { return (await h.requestPermission({ mode: 'readwrite' })) === 'granted'; } catch { return false; }
}
/** Abre o seletor de pastas do sistema. Devolve o nome da pasta, ou null se a pessoa cancelou. */
export async function escolher() {
  let h;
  try { h = await window.showDirectoryPicker({ id: 'potira-docs', mode: 'readwrite', startIn: 'documents' }); }
  catch (e) { if (e && e.name === 'AbortError') return null; throw e; }
  await idb('readwrite', (s) => s.put(h, KEY));
  return h.name;
}
export const esquecer = () => idb('readwrite', (s) => s.delete(KEY));

async function pastaDo(paciente, tipo, criar) {
  const h = await raiz(); if (!h) return null;
  const p = await h.getDirectoryHandle(nomeSeguro(paciente), { create: criar });
  return tipo ? p.getDirectoryHandle(nomeSeguro(tipo), { create: criar }) : p;
}

/** Cria a pasta do paciente com as subpastas (para o "Salvar como PDF" já encontrar o lugar). */
export async function prepararPaciente(paciente) {
  if ((await estado()) !== 'ok') return false;
  for (const t of TIPOS.slice(0, 4)) await pastaDo(paciente, t, true);
  return true;
}

/** Grava o arquivo em Pasta/Paciente/Tipo. Se já existir um com o mesmo nome, acrescenta (2), (3)... Devolve o caminho, ou null se não há pasta liberada. */
export async function salvar(paciente, tipo, nome, blob) {
  if ((await estado()) !== 'ok') return null;
  const dir = await pastaDo(paciente, tipo, true);
  const limpo = nomeSeguro(nome); const ponto = limpo.lastIndexOf('.');
  const base = ponto > 0 ? limpo.slice(0, ponto) : limpo, ext = ponto > 0 ? limpo.slice(ponto) : '';
  let final = limpo;
  for (let n = 2; n < 200; n++) {
    try { await dir.getFileHandle(final); final = `${base} (${n})${ext}`; } catch { break; }
  }
  const fh = await dir.getFileHandle(final, { create: true });
  const w = await fh.createWritable(); await w.write(blob); await w.close();
  return `${(await raiz()).name}/${nomeSeguro(paciente)}/${nomeSeguro(tipo)}/${final}`;
}

/** Arquivos da pasta do paciente: [{ tipo, nome, tamanho, data, handle, dir }], do mais novo para o mais antigo. */
export async function listar(paciente) {
  if ((await estado()) !== 'ok') return [];
  let p; try { p = await pastaDo(paciente, null, false); } catch { return []; }
  const out = [];
  const ler = async (dir, tipo) => {
    for await (const [nome, h] of dir.entries()) {
      if (h.kind === 'directory') { if (!tipo) await ler(h, nome); continue; }
      const f = await h.getFile(); out.push({ tipo: tipo || 'Outros', nome, tamanho: f.size, data: f.lastModified, handle: h, dir });
    }
  };
  await ler(p, '');
  return out.sort((a, b) => b.data - a.data);
}
export async function abrir(item) {
  const f = await item.handle.getFile(); const url = URL.createObjectURL(f);
  window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const apagar = (item) => item.dir.removeEntry(item.nome);
