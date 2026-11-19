// Dados reais do Início: entradas financeiras (mesma regra do Resumo do Financeiro) e a lista de atividades recentes.
import * as api from './api.js';
import { brl } from './export.js';

const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** Entradas dos últimos 180 dias e valor em aberto. Qualquer falha devolve null e o cartão simplesmente não aparece. */
export async function loadFin(profile, cobravel) {
  try {
    const hoje = new Date();
    const de = iso(addDays(hoje, -180)), ate = iso(hoje);
    const [sess, avul, abertas, admins] = await Promise.all([
      api.listPaidBetween(de, ate), api.listCharges({ paidFrom: de, paidTo: ate }).catch(() => []),
      api.listOpenCharges().catch(() => []), api.listPatientAdmins().catch(() => []),
    ]);
    const preco = Object.fromEntries(admins.map((a) => [a.patient_id, Number(a.session_price) || 0]));
    const valor = (a) => (a.amount != null ? Number(a.amount) : preco[a.patient_id] || 0);
    const entradas = [
      ...sess.map((a) => ({ d: a.paid_on, v: valor(a), nome: a.patients?.name || '', h: `#/pacientes/${a.patient_id}` })),
      ...avul.map((c) => ({ d: c.paid_on, v: Number(c.amount || 0), nome: c.patients?.name || c.description || 'Cobrança avulsa', h: '#/financeiro?aba=cobrancas' })),
    ].filter((e) => e.d && e.v > 0);
    const emAberto = abertas.filter((a) => cobravel(a, profile));
    return { entradas, aberto: emAberto.reduce((s, a) => s + valor(a), 0), nAberto: emAberto.length };
  } catch { return null; }
}

/** Soma por intervalo. 7 dias: um valor por dia; 30 dias: por dia; 90 dias: por semana. */
export function serie(entradas, dias) {
  const hoje = new Date();
  const passo = dias > 30 ? 7 : 1;
  const n = Math.ceil(dias / passo);
  const ini = addDays(hoje, -(n * passo - 1));
  const baldes = [...Array(n)].map((_, i) => { const a = addDays(ini, i * passo), b = addDays(a, passo - 1); return { de: iso(a), ate: iso(b), v: 0, rot: a }; });
  for (const e of entradas) { const b = baldes.find((x) => e.d >= x.de && e.d <= x.ate); if (b) b.v += e.v; }
  const total = baldes.reduce((s, b) => s + b.v, 0);
  const ant = entradas.filter((e) => e.d >= iso(addDays(ini, -n * passo)) && e.d < iso(ini)).reduce((s, e) => s + e.v, 0);
  return { baldes, total, ant, passo };
}

export function chartHtml(fin, dias) {
  const { baldes, total, ant, passo } = serie(fin.entradas, dias);
  const max = Math.max(1, ...baldes.map((b) => b.v));
  const dif = ant ? Math.round(((total - ant) / ant) * 100) : null;
  const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const rot = (b, i) => (baldes.length <= 7 ? b.rot.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') : (i % Math.ceil(baldes.length / 6) === 0 ? fmt(b.rot) : ''));
  const resumo = `Recebido nos últimos ${dias} dias: ${brl(total)}`;
  return `<div class="fin-top"><div><div class="midnum fin-tot">${brl(total)}</div>
      <div class="trend ${dif != null && dif < 0 ? 'down' : ''}">${dif == null ? `recebido nos últimos ${dias} dias` : `${dif >= 0 ? '↗' : '↘'} ${Math.abs(dif)}% vs. período anterior`}</div></div></div>
    <div class="fin-chart" role="img" aria-label="${resumo}">${baldes.map((b, i) => `<div class="fc" title="${passo > 1 ? `${fmt(b.rot)} a ${fmt(new Date(b.ate + 'T12:00:00'))}` : fmt(b.rot)}: ${brl(b.v)}"><i style="height:${Math.max(b.v ? 3 : 0, Math.round((b.v / max) * 100))}%"></i><span>${rot(b, i)}</span></div>`).join('')}</div>`;
}

/** Últimas atividades: relatórios registrados e pagamentos recebidos, do mais novo para o mais antigo. */
export function atividades(reports, entradas, limite = 6) {
  const rel = reports.slice(0, 12).map((r) => ({ q: (r.created_at || r.session_date || '').slice(0, 10), ic: 'file', t: r.patients?.name || r.title, s: `${r.title}${r.status === 'rascunho' ? ' · rascunho' : ''}`, h: `#/relatorio/${r.id}` }));
  const pag = entradas.slice().sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 12).map((e) => ({ q: e.d, ic: 'wallet', t: e.nome || 'Pagamento', s: `Pagamento de ${brl(e.v)} recebido`, h: e.h }));
  return [...rel, ...pag].filter((x) => x.q).sort((a, b) => (a.q < b.q ? 1 : -1)).slice(0, limite);
}
