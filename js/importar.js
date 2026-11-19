// Importação de pacientes por planilha (Excel .xlsx/.xls ou CSV), vinda de outro sistema.
// O arquivo é lido aqui no navegador e não é enviado nem guardado; só os pacientes vão para o banco.
// Fluxo: escolher arquivo → ligar colunas aos campos → prévia com avisos e repetidos → importar → desfazer, se precisar.
import * as api from './api.js';
import { esc, openModal, confirmBox, toast, fmtDate } from './ui.js';
import { cpfValido } from './cobranca.js';
import { soDigitos, fmtCpf } from './cadastro.js';

const SHEETJS = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
const MAX_LINHAS = 5000;
const ULTIMA = 'potira.ultima-importacao';

// Campos do cadastro e os nomes de coluna que costumam aparecer em outros sistemas (já sem acento e em minúsculas).
// A ordem importa: os mais específicos (responsável, nome social, telefone 2) vêm antes dos gerais.
export const CAMPOS = [
  ['r_cpf', 'CPF do responsável', /cpf.*(resp|mae|pai|tutor)|(resp|mae|pai|tutor).*cpf/],
  ['r_telefone', 'Telefone do responsável', /(tel|fone|cel|whats|contato).*(resp|mae|pai|tutor)|(resp|mae|pai|tutor).*(tel|fone|cel|whats|contato)/],
  ['r_email', 'E-mail do responsável', /e ?mail.*(resp|mae|pai|tutor)|(resp|mae|pai|tutor).*e ?mail/],
  ['r_parentesco', 'Parentesco do responsável', /parentesco|vinculo|grau de/],
  ['r_nome', 'Nome do responsável', /responsavel|nome da mae|nome do pai|^mae$|^pai$|filiacao|cuidador|tutor/],
  ['social_name', 'Nome social', /nome social/],
  ['name', 'Nome do paciente', /^(nome|paciente|cliente|nome completo|nome do paciente|nome paciente)$|^nome/],
  ['cpf', 'CPF', /cpf/],
  ['birth_date', 'Data de nascimento', /nasc|aniversario/],
  ['sex', 'Sexo', /^sexo|genero/],
  ['rg_issuer', 'Órgão emissor do RG', /orgao|emissor|expedidor/],
  ['rg', 'RG', /^rg\b|identidade/],
  ['email', 'E-mail', /e ?mail/],
  ['whatsapp', 'WhatsApp', /whats|zap/],
  ['phone_alt', 'Telefone alternativo', /(tel|fone|cel).*(2|alt|recado|outro|comercial)/],
  ['phone', 'Telefone', /tel|fone|cel|contato/],
  ['cep', 'CEP', /cep/],
  ['street_number', 'Número', /^(n|no|num|numero|nro|n numero)$/],
  ['complement', 'Complemento', /compl/],
  ['district', 'Bairro', /bairro/],
  ['city', 'Cidade', /cidade|municipio/],
  ['uf', 'UF', /^(uf|estado)$/],
  ['street', 'Endereço / rua', /endereco|logradouro|^rua|^end$/],
  ['insurance_card', 'Nº da carteirinha', /carteir|matricula|(n|numero|num) (do )?(convenio|plano)/],
  ['insurer', 'Convênio', /convenio|plano|operadora/],
  ['entry_date', 'Data de entrada', /entrada|data de cadastro|data cadastro|inicio|admissao/],
  ['notes', 'Observações', /obs|anotac|diagnost|comentario|queixa/],
];
const ROTULO = Object.fromEntries(CAMPOS.map(([k, l]) => [k, l]));

export const normCab = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normNome = (s) => normCab(s).replace(/\s+/g, ' ');

/** Sugere o campo de cada coluna, sem repetir campo. */
export function ligarColunas(cabecalhos) {
  const usados = new Set();
  return cabecalhos.map((h) => {
    const n = normCab(h);
    if (!n) return '';
    const achado = CAMPOS.find(([k, , re]) => !usados.has(k) && re.test(n));
    if (achado) { usados.add(achado[0]); return achado[0]; }
    return '';
  });
}

/* ---------- leitura do arquivo ---------- */
export function lerCsv(texto) {
  texto = texto.replace(/^﻿/, '');
  const prim = texto.split(/\r?\n/).find((l) => l.trim()) || '';
  const sep = [';', '\t', ','].map((c) => [c, prim.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas;
}

async function lerArquivo(file) {
  if (/\.(csv|txt)$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    let t = new TextDecoder('utf-8').decode(buf);
    if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf); // CSV salvo pelo Excel em português
    return lerCsv(t);
  }
  if (!/\.(xlsx|xls|ods)$/i.test(file.name)) throw new Error('Use um arquivo do Excel (.xlsx ou .xls) ou CSV.');
  let XLSX;
  try { XLSX = await import(SHEETJS); } catch { throw new Error('Não foi possível carregar o leitor de Excel (sem internet?). Salve a planilha como CSV e tente de novo.'); }
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'dd/mm/yyyy', defval: '' });
}

/* ---------- conversão de cada valor ---------- */
export function data(v) {
  v = String(v || '').trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (m) { let a = +m[3]; if (a < 100) a += a > 30 ? 1900 : 2000; return ok(a, +m[2], +m[1]); }
  if (/^\d{4,5}$/.test(v)) { const d = new Date(Date.UTC(1899, 11, 30) + Number(v) * 864e5); return ok(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  return undefined; // não reconhecida
  function ok(a, me, di) {
    const d = new Date(Date.UTC(a, me - 1, di));
    if (d.getUTCMonth() !== me - 1 || a < 1900 || a > 2100) return undefined;
    return `${a}-${String(me).padStart(2, '0')}-${String(di).padStart(2, '0')}`;
  }
}
const sexo = (v) => { const n = normCab(v); if (!n) return null; if (/^f/.test(n)) return 'feminino'; if (/^m/.test(n)) return 'masculino'; return 'outro'; };
const telefone = (v) => {
  const d = soDigitos(v).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(v || '').trim() || null;
};
const cpfLimpo = (v) => { let d = soDigitos(v); if (d && d.length < 11 && d.length >= 9) d = d.padStart(11, '0'); return d; }; // Excel tira o zero da frente

/** Transforma uma linha da planilha em paciente. Retorna { p, admin, avisos, erro }. */
export function montar(linha, mapa) {
  const v = {};
  mapa.forEach((k, i) => { if (k) v[k] = String(linha[i] ?? '').trim(); });
  const avisos = [];
  if (!v.name) return { erro: 'sem nome' };
  const p = { name: v.name.replace(/\s+/g, ' ').slice(0, 200), origin: 'importado' };
  const texto = (k, max = 200) => { if (v[k]) p[k] = v[k].slice(0, max); };
  ['social_name', 'rg', 'rg_issuer', 'street', 'street_number', 'complement', 'district', 'city', 'insurance_card'].forEach((k) => texto(k));
  if (v.notes) p.notes = v.notes.slice(0, 4000);
  if (v.cpf) { const c = cpfLimpo(v.cpf); if (cpfValido(c)) p.cpf = c; else avisos.push('CPF inválido (não importado)'); }
  if (v.birth_date) { const d = data(v.birth_date); if (d) p.birth_date = d; else avisos.push('nascimento não reconhecido'); }
  if (v.entry_date) { const d = data(v.entry_date); if (d) p.entry_date = d; else avisos.push('data de entrada não reconhecida'); }
  if (v.sex) p.sex = sexo(v.sex);
  if (v.email) { const e = v.email.toLowerCase(); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) p.email = e; else avisos.push('e-mail inválido'); }
  ['phone', 'whatsapp', 'phone_alt'].forEach((k) => { if (v[k]) p[k] = telefone(v[k]); });
  if (v.cep) { const c = soDigitos(v.cep).padStart(8, '0'); if (c.length === 8 && Number(c)) p.cep = c; else avisos.push('CEP inválido'); }
  if (v.uf) { const u = normCab(v.uf).toUpperCase(); if (/^[A-Z]{2}$/.test(u)) p.uf = u; }
  if (v.r_nome || v.r_cpf || v.r_telefone) {
    let rc = cpfLimpo(v.r_cpf);
    if (rc && !cpfValido(rc)) { avisos.push('CPF do responsável inválido'); rc = ''; }
    p.guardians = [{ nome: (v.r_nome || 'Responsável').slice(0, 200), parentesco: v.r_parentesco || '', cpf: rc || '', telefone: v.r_telefone ? telefone(v.r_telefone) : '', email: (v.r_email || '').toLowerCase(), legal: true, financeiro: true }];
  }
  const admin = {};
  if (v.insurer) admin.insurer = v.insurer.slice(0, 200);
  if (p.guardians) admin.guardian = (p.guardians[0].nome + (p.guardians[0].parentesco ? ` (${p.guardians[0].parentesco})` : '')).slice(0, 200);
  return { p, admin, avisos };
}

/** Marca repetidos: com quem já está cadastrado e dentro da própria planilha (mesmo CPF, ou mesmo nome e nascimento). */
export function marcarRepetidos(itens, existentes) {
  const chaves = (x) => [x.cpf ? 'c' + x.cpf : '', x.birth_date ? 'n' + normNome(x.name) + '|' + x.birth_date : '', !x.birth_date && !x.cpf ? 's' + normNome(x.name) : ''].filter(Boolean);
  const ja = new Map();
  existentes.forEach((e) => chaves(e).forEach((k) => ja.set(k, e.name)));
  existentes.forEach((e) => ja.set('s' + normNome(e.name), e.name)); // nome igual sem outros dados
  const vistos = new Set();
  itens.forEach((it) => {
    if (!it.p) return;
    const ks = chaves(it.p);
    const k = ks.find((x) => ja.has(x));
    if (k) it.repetido = `já cadastrado (${ja.get(k)})`;
    else if (ks.some((x) => vistos.has(x))) it.repetido = 'repetido na planilha';
    ks.forEach((x) => vistos.add(x));
  });
  return itens;
}

/* ---------- planilha modelo ---------- */
export function baixarModelo() {
  const cab = ['Nome', 'Nome social', 'CPF', 'Data de nascimento', 'Sexo', 'RG', 'Órgão emissor', 'E-mail', 'Telefone', 'WhatsApp',
    'CEP', 'Endereço', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF',
    'Responsável', 'Parentesco', 'CPF do responsável', 'Telefone do responsável', 'Convênio', 'Carteirinha', 'Data de entrada', 'Observações'];
  const ex = ['Maria Exemplo da Silva', '', '529.982.247-25', '15/03/2015', 'Feminino', '', '', 'maria@exemplo.com', '(95) 99999-0000', '',
    '69301-000', 'Rua Exemplo', '100', 'Casa', 'Centro', 'Boa Vista', 'RR', 'Ana Exemplo', 'Mãe', '', '(95) 98888-0000', '', '', '01/02/2026', 'Apague esta linha de exemplo'];
  const cel = (x) => `"${String(x).replace(/"/g, '""')}"`;
  const csv = '﻿' + [cab, ex].map((r) => r.map(cel).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'potira-modelo-importar-pacientes.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- telas ---------- */
const ultima = () => { try { return JSON.parse(localStorage.getItem(ULTIMA)); } catch { return null; } };

/** Abre a importação. Chama onFim() quando importar ou desfazer. */
export async function abrirImportacao(onFim) {
  const u = ultima();
  let linhas = null, nome = '';
  const ok = await openModal('Importar pacientes', `
    <p>Traga seus pacientes de outro sistema ou de uma planilha sua. Aceita <b>Excel (.xlsx, .xls)</b> e <b>CSV</b>. A primeira linha deve ter os nomes das colunas.</p>
    <p class="muted small">Só dados de cadastro (nome, CPF, contato, endereço, responsável, convênio). Relatórios e evoluções não entram. O arquivo é lido aqui no seu navegador e não fica guardado.</p>
    <label class="field">Arquivo<input type="file" name="arq" accept=".xlsx,.xls,.ods,.csv,.txt" required></label>
    <p class="small" data-msg></p>
    <div class="row"><button type="button" class="btn sm quiet" data-modelo>Baixar planilha modelo</button>
    ${u ? `<button type="button" class="btn sm quiet" data-desfazer>Desfazer a última importação (${u.n} paciente${u.n === 1 ? '' : 's'}, ${fmtDate(u.at.slice(0, 10))})</button>` : ''}</div>`, {
    okText: 'Continuar',
    onOpen: (d) => {
      d.querySelector('[data-modelo]').onclick = baixarModelo;
      const des = d.querySelector('[data-desfazer]');
      if (des) des.onclick = async () => { d.querySelector('[data-cancel]').click(); await desfazer(u, onFim); };
      d.querySelector('[name=arq]').onchange = async (e) => {
        const f = e.target.files[0], msg = d.querySelector('[data-msg]');
        linhas = null; if (!f) return;
        msg.textContent = 'Lendo o arquivo…';
        try {
          const todas = (await lerArquivo(f)).filter((l) => l.some((c) => String(c ?? '').trim()));
          if (todas.length < 2) throw new Error('A planilha precisa ter a linha de títulos e pelo menos um paciente.');
          if (todas.length - 1 > MAX_LINHAS) throw new Error(`Máximo de ${MAX_LINHAS} pacientes por vez. Divida a planilha.`);
          linhas = todas; nome = f.name;
          msg.textContent = `${todas.length - 1} linha${todas.length === 2 ? '' : 's'} encontrada${todas.length === 2 ? '' : 's'}.`;
        } catch (err) { msg.textContent = err.message; }
      };
    },
    onOk: () => { if (!linhas) throw new Error('Escolha um arquivo válido.'); return true; },
  });
  if (ok && linhas) await previa(linhas, nome, onFim);
}

async function previa(linhas, nomeArquivo, onFim) {
  const cab = linhas[0].map((c) => String(c ?? '').trim());
  const dados = linhas.slice(1);
  let mapa = ligarColunas(cab);
  const existentes = await api.listPatients(true).catch(() => []);
  let itens = [];
  const calcular = () => { itens = marcarRepetidos(dados.map((l) => montar(l, mapa)), existentes); };
  const opcoes = (sel) => `<option value="">— não importar —</option>${CAMPOS.map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${l}</option>`).join('')}`;
  const resumo = () => {
    const entra = itens.filter((i) => i.p && !i.repetido).length, rep = itens.filter((i) => i.repetido).length, sem = itens.filter((i) => i.erro).length;
    const av = itens.filter((i) => i.p && !i.repetido && i.avisos.length).length;
    return { entra, rep, sem, av };
  };
  const tabela = () => {
    const { entra, rep, sem, av } = resumo();
    const linhasHtml = itens.slice(0, 100).map((it, i) => {
      const sit = it.erro ? `<span class="chip warn">ignorada: ${it.erro}</span>` : it.repetido ? `<span class="chip warn">${esc(it.repetido)}</span>` : it.avisos.length ? `<span class="chip">${esc(it.avisos.join('; '))}</span>` : '<span class="chip ok">ok</span>';
      const p = it.p || {};
      return `<tr><td>${i + 2}</td><td>${esc(p.name || '')}</td><td>${p.cpf ? fmtCpf(p.cpf) : ''}</td><td>${p.birth_date ? fmtDate(p.birth_date) : ''}</td><td>${esc(p.phone || p.whatsapp || '')}</td><td>${esc(p.guardians?.[0]?.nome || '')}</td><td>${sit}</td></tr>`;
    }).join('');
    return `<p><b>${entra}</b> paciente${entra === 1 ? '' : 's'} para importar${av ? ` (${av} com aviso)` : ''}${rep ? ` · <b>${rep}</b> repetido${rep === 1 ? '' : 's'} (não entra${rep === 1 ? '' : 'm'})` : ''}${sem ? ` · ${sem} sem nome (ignorada${sem === 1 ? '' : 's'})` : ''}.</p>
      <div class="imp-tab"><table><thead><tr><th>Linha</th><th>Nome</th><th>CPF</th><th>Nascimento</th><th>Telefone</th><th>Responsável</th><th>Situação</th></tr></thead><tbody>${linhasHtml}</tbody></table></div>
      ${itens.length > 100 ? `<p class="muted small">Mostrando as 100 primeiras de ${itens.length} linhas.</p>` : ''}`;
  };
  calcular();
  const r = await openModal(`Conferir importação — ${nomeArquivo}`, `
    <h4 class="cad-sec">1. Colunas da planilha</h4>
    <p class="muted small">Já liguei as colunas que reconheci. Confira e ajuste o que estiver errado; o que ficar "não importar" é ignorado.</p>
    <div class="imp-mapa">${cab.map((h, i) => `<label class="field"><span class="ellip">${esc(h || `Coluna ${i + 1}`)}</span><select data-col="${i}">${opcoes(mapa[i])}</select><small class="muted ellip">${esc(String(dados[0]?.[i] ?? ''))}</small></label>`).join('')}</div>
    <h4 class="cad-sec">2. Prévia</h4>
    <div data-prev>${tabela()}</div>`, {
    wide: true, okText: 'Importar',
    onOpen: (d) => {
      d.querySelectorAll('[data-col]').forEach((s) => (s.onchange = () => {
        const i = Number(s.dataset.col), k = s.value;
        if (k) mapa = mapa.map((x, j) => (x === k && j !== i ? '' : x)); // cada campo em uma coluna só
        mapa[i] = k;
        d.querySelectorAll('[data-col]').forEach((o) => { o.value = mapa[Number(o.dataset.col)]; });
        calcular(); d.querySelector('[data-prev]').innerHTML = tabela();
      }));
    },
    onOk: async (d) => {
      if (!mapa.includes('name')) throw new Error(`Escolha qual coluna é o "${ROTULO.name}".`);
      const entra = itens.filter((i) => i.p && !i.repetido);
      if (!entra.length) throw new Error('Nenhum paciente novo para importar.');
      const btn = d.querySelector('[data-ok]'); btn.textContent = 'Importando…';
      const res = await api.importPatients(entra.map((i) => i.p), entra.map((i) => i.admin), (feitos) => { btn.textContent = `Importando… ${feitos}/${entra.length}`; });
      try { localStorage.setItem(ULTIMA, JSON.stringify({ batch: res.batch, n: res.n, at: new Date().toISOString() })); } catch { /* sem armazenamento */ }
      return res;
    },
  });
  if (r && r.n) {
    const { rep, sem } = resumo();
    toast(`${r.n} paciente${r.n === 1 ? '' : 's'} importado${r.n === 1 ? '' : 's'}${rep + sem ? `; ${rep + sem} não entra${rep + sem === 1 ? '' : 'ram'}` : ''}.`);
    if (onFim) onFim();
  }
}

async function desfazer(u, onFim) {
  const n = await api.countImportBatch(u.batch).catch(() => null);
  if (!n) { localStorage.removeItem(ULTIMA); return toast('Esses pacientes já não existem mais.'); }
  if (!(await confirmBox(`Apagar os ${n} pacientes desta importação? Tudo que foi registrado neles depois (sessões, evoluções, cobranças) também será apagado. Não dá para desfazer.`, 'Apagar importação'))) return;
  await api.undoImportBatch(u.batch);
  localStorage.removeItem(ULTIMA);
  toast(`Importação desfeita: ${n} paciente${n === 1 ? '' : 's'} removido${n === 1 ? '' : 's'}.`);
  if (onFim) onFim();
}
