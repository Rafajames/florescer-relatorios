// Dados reais do Início: receitas e despesas (mesma regra do Resumo do Financeiro), atividades recentes e minigráficos.
import * as api from './api.js';
import { brl } from './export.js';

export const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Receitas e despesas dos últimos 200 dias e valor em aberto. Qualquer falha devolve null e os cartões de dinheiro não aparecem. */
export async function loadFin(profile, cobravel) {
  try {
    const hoje = new Date();
    const de = iso(addDays(hoje, -200)), ate = iso(hoje);
    const [sess, avul, abertas, admins, exps] = await Promise.all([
      api.listPaidBetween(de, ate), api.listCharges({ paidFrom: de, paidTo: ate }).catch(() => []),
      api.listOpenCharges().catch(() => []), api.listPatientAdmins().catch(() => []), api.listExpenses({ from: de, to: ate }).catch(() => []),
    ]);
    const preco = Object.fromEntries(admins.map((a) => [a.patient_id, Number(a.session_price) || 0]));
    const valor = (a) => (a.amount != null ? Number(a.amount) : preco[a.patient_id] || 0);
    const entradas = [
      ...sess.map((a) => ({ d: a.paid_on, v: valor(a), nome: a.patients?.name || '', forma: a.payment_method, h: `#/pacientes/${a.patient_id}` })),
      ...avul.map((c) => ({ d: c.paid_on, v: Number(c.amount || 0), nome: c.patients?.name || c.description || 'Cobrança avulsa', forma: c.payment_method, h: '#/financeiro?aba=cobrancas' })),
    ].filter((e) => e.d && e.v > 0);
    const saidas = exps.filter((e) => e.paid !== false && e.date).map((e) => ({ d: e.date, v: Number(e.amount || 0) })).filter((e) => e.v > 0);
    const emAberto = abertas.filter((a) => cobravel(a, profile));
    return { entradas, saidas, aberto: emAberto.reduce((s, a) => s + valor(a), 0), nAberto: emAberto.length };
  } catch { return null; }
}

/** Soma por intervalo. 7 e 30 dias: por dia; 90 dias: por semana. */
function baldes(lista, dias) {
  const hoje = new Date(), passo = dias > 30 ? 7 : 1, n = Math.ceil(dias / passo);
  const ini = addDays(hoje, -(n * passo - 1));
  const b = [...Array(n)].map((_, i) => { const a = addDays(ini, i * passo); return { de: iso(a), ate: iso(addDays(a, passo - 1)), v: 0, rot: a }; });
  for (const e of lista) { const x = b.find((y) => e.d >= y.de && e.d <= y.ate); if (x) x.v += e.v; }
  return b;
}
/** Valores por dia dos últimos n dias (para minigráficos). */
export const porDia = (lista, n = 30, campo = 'd', peso = (e) => e.v ?? 1) => {
  const hoje = new Date(), out = Array(n).fill(0), ini = iso(addDays(hoje, -(n - 1)));
  for (const e of lista) { const d = e[campo]; if (!d || d < ini) continue; const i = Math.round((new Date(d + 'T12:00:00') - new Date(ini + 'T12:00:00')) / 864e5); if (i >= 0 && i < n) out[i] += peso(e); }
  return out;
};

const curto = (v) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : `R$ ${Math.round(v)}`);
const passoBonito = (x) => { const p = Math.pow(10, Math.floor(Math.log10(x || 1))); const n = x / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; };

/** Linhas de receitas (turquesa) e despesas (rosa), com área e eixo em reais. */
export function chartHtml(fin, dias) {
  const R = baldes(fin.entradas, dias), D = baldes(fin.saidas, dias);
  const tr = R.reduce((s, b) => s + b.v, 0), td = D.reduce((s, b) => s + b.v, 0);
  const st = passoBonito(Math.max(1, ...R.map((b) => b.v), ...D.map((b) => b.v)) / 4);
  const top = st * Math.max(1, Math.ceil(Math.max(1, ...R.map((b) => b.v), ...D.map((b) => b.v)) / st));
  const W = 640, H = 220, L = 58, T = 10, B = 28, PW = W - L - 10, PH = H - T - B, n = R.length;
  const x = (i) => L + (n === 1 ? PW / 2 : (i * PW) / (n - 1)), y = (v) => T + PH - (v / top) * PH;
  // curva suave (Catmull-Rom), sem passar abaixo de zero
  const linha = (b) => { const P = b.map((p, i) => [x(i), y(p.v)]); return P.map((q, i) => { if (!i) return `M${q[0].toFixed(1)} ${q[1].toFixed(1)}`; const a = P[i - 2] || P[i - 1], b0 = P[i - 1], c = P[i + 1] || q;
    const c1 = [b0[0] + (q[0] - a[0]) / 6, Math.min(T + PH, b0[1] + (q[1] - a[1]) / 6)], c2 = [q[0] - (c[0] - b0[0]) / 6, Math.min(T + PH, q[1] - (c[1] - b0[1]) / 6)];
    return `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }).join(''); };
  const area = (b) => `${linha(b)}L${x(n - 1).toFixed(1)} ${T + PH}L${x(0).toFixed(1)} ${T + PH}Z`;
  const ticks = [...Array(Math.round(top / st) + 1)].map((_, i) => i * st);
  const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const cada = Math.max(1, Math.ceil(n / 6));
  const pontos = (b, cls) => (n <= 31 ? b.map((p, i) => (i % Math.max(1, Math.ceil(n / 10)) === 0 || i === n - 1 ? `<circle class="${cls}" cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.6"><title>${fmt(p.rot)}: ${brl(p.v)}</title></circle>` : '')).join('') : '');
  return `<div class="fin-leg"><span><i class="lg-r"></i>Receitas <b>${brl(tr)}</b></span><span><i class="lg-d"></i>Despesas <b>${brl(td)}</b></span></div>
    <svg class="fin-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Últimos ${dias} dias: receitas ${brl(tr)}, despesas ${brl(td)}">
      <defs><linearGradient id="fg-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--turq)" stop-opacity=".28"/><stop offset="1" stop-color="var(--turq)" stop-opacity="0"/></linearGradient>
      <linearGradient id="fg-d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--bloom)" stop-opacity=".2"/><stop offset="1" stop-color="var(--bloom)" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map((t) => `<line class="gl" x1="${L}" x2="${W - 10}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text class="ax" x="${L - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${curto(t)}</text>`).join('')}
      ${R.map((p, i) => (i % cada === 0 || i === n - 1 ? `<text class="ax" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${n <= 7 ? p.rot.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : fmt(p.rot)}</text>` : '')).join('')}
      <path d="${area(R)}" fill="url(#fg-r)"/><path d="${area(D)}" fill="url(#fg-d)"/>
      <path class="ln-r" d="${linha(R)}"/><path class="ln-d" d="${linha(D)}"/>${pontos(R, 'pt-r')}${pontos(D, 'pt-d')}
    </svg>`;
}

/** Minigráfico de área (para os indicadores). */
export function spark(vals, cls) {
  const W = 170, H = 54, max = Math.max(...vals), min = Math.min(...vals), n = vals.length;
  const yv = (v) => (max === min ? H * 0.6 : H - 4 - ((v - min) / (max - min)) * (H - 10));
  const p = vals.map((v, i) => `${i ? 'L' : 'M'}${((i * W) / (n - 1)).toFixed(1)} ${yv(v).toFixed(1)}`).join('');
  return `<svg class="spark ${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="sa" d="${p}L${W} ${H}L0 ${H}Z"/><path class="sl" d="${p}"/></svg>`;
}

const FORMA = { pix: 'via PIX', dinheiro: 'em dinheiro', cartao: 'no cartão', transferencia: 'por transferência', convenio: 'pelo convênio' };
/** Últimas atividades: pacientes cadastrados, relatórios e pagamentos, do mais novo para o mais antigo. */
export function atividades(reports, entradas, patients, limite = 7) {
  const rel = reports.slice(0, 12).map((r) => ({ q: r.created_at || r.session_date || '', ic: r.status === 'rascunho' ? 'edit' : 'check', c: r.status === 'rascunho' ? 'a-lil' : 'a-ok', t: `${r.status === 'rascunho' ? 'Rascunho salvo' : 'Registro revisado'}: ${r.patients?.name || r.title}`, h: `#/relatorio/${r.id}` }));
  const pag = entradas.slice().sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 12).map((e) => ({ q: e.d, ic: 'wallet', c: 'a-tur', t: `Pagamento de ${brl(e.v)} recebido ${FORMA[e.forma] || ''}${e.nome ? ` · ${e.nome}` : ''}`, h: e.h }));
  const pac = patients.filter((p) => p.created_at).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 6).map((p) => ({ q: p.created_at, ic: 'users', c: 'a-blo', t: `Novo paciente cadastrado: ${p.name}`, h: `#/pacientes/${p.id}` }));
  return [...rel, ...pag, ...pac].filter((x) => x.q).sort((a, b) => (a.q < b.q ? 1 : -1)).slice(0, limite);
}
