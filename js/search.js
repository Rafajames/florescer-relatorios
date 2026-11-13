import * as api from './api.js';
import { $, $$, esc, fmtDate, icon } from './ui.js';

const PAGES = [
  ['Início', '#/painel', 'home'], ['Pacientes', '#/pacientes', 'users'], ['Nova sessão', '#/nova', 'mic'],
  ['Relatórios', '#/relatorios', 'file'], ['Relatórios por período', '#/periodo', 'calendar'],
  ['Modelos de relatório', '#/modelos', 'layout'], ['Configurações', '#/config', 'sliders'],
  ['Preferências de IA e editor', '#/config?aba=preferencias', 'sparkle'],
  ['Backup e privacidade', '#/config?aba=dados', 'shield'],
  ['Agenda', '#/administrativo', 'calendar'], ['Financeiro', '#/financeiro', 'wallet'],
  ['Cobranças', '#/financeiro?aba=cobrancas', 'wallet'], ['Gastos', '#/financeiro?aba=gastos', 'wallet'],
  ['Valores das sessões', '#/financeiro?aba=valores', 'wallet'], ['Dados de pagamento (PIX)', '#/financeiro?aba=pagamento', 'wallet'],
];
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ST = { agendado: 'agendada', realizado: 'realizada', falta: 'falta', falta_justificada: 'falta justificada', cancelado: 'cancelada' };

export async function openSearch() {
  if ($('dialog.cmd')) return;
  const d = document.createElement('dialog');
  d.className = 'cmd';
  d.innerHTML = `<div class="cmd-in">${icon('search')}<input id="cmd-q" placeholder="Buscar paciente, relatório, sessão, cobrança ou página" autocomplete="off" aria-label="Buscar"></div><div class="cmd-list" id="cmd-list"></div>`;
  document.body.appendChild(d);
  d.showModal();
  const close = () => { d.close(); d.remove(); };
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  d.addEventListener('click', (e) => { if (e.target === d) close(); });

  let patients = [], reports = [], sessoes = [], abertas = [], items = [], cur = 0;
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const build = () => {
    const q = norm($('#cmd-q', d).value.trim());
    const hit = (s) => !q || norm(s).includes(q);
    const groups = [
      ['Ir para', PAGES.filter(([l]) => hit(l)).slice(0, q ? 5 : 4).map(([l, h, ic]) => ({ label: l, href: h, ic }))],
      ['Pacientes', patients.filter((p) => hit(p.name) || hit(p.email)).slice(0, q ? 6 : 4).map((p) => ({ label: p.name, hint: p.email || '', href: `#/pacientes/${p.id}`, ic: 'users' }))],
      ['Relatórios', q ? reports.filter((r) => hit(r.title) || hit(r.patients?.name)).slice(0, 6).map((r) => ({ label: r.title, hint: `${r.patients?.name || ''} ${fmtDate(r.session_date)}`, href: `#/relatorio/${r.id}`, ic: 'file' })) : []],
      ['Sessões', q ? sessoes.filter((a) => hit(a.patients?.name) || hit(fmtDate(a.date)) || hit(a.date)).slice(0, 6).map((a) => ({ label: `${a.patients?.name || 'Sessão'} · ${fmtDate(a.date)}${a.time ? ' ' + a.time.slice(0, 5) : ''}`, hint: ST[a.status] || '', href: `#/administrativo?semana=${a.date}`, ic: 'calendar' })) : []],
      ['Cobranças em aberto', q ? abertas.filter((c) => hit(c.nome) || hit('cobrança') || hit('cobranca')).slice(0, 5).map((c) => ({ label: `${c.nome} · ${c.n} ${c.n === 1 ? 'sessão' : 'sessões'}`, hint: brl(c.total), href: `#/pacientes/${c.id}`, ic: 'wallet' })) : []],
    ].filter(([, list]) => list.length);
    items = groups.flatMap(([, l]) => l);
    cur = Math.min(cur, Math.max(items.length - 1, 0));
    let n = 0;
    $('#cmd-list', d).innerHTML = groups.length ? groups.map(([g, list]) => `
      <div class="cmd-group">${g}</div>
      ${list.map((it) => `<div class="cmd-item ${n++ === cur ? 'on' : ''}" data-i="${n - 1}" role="option">${icon(it.ic)}<span>${esc(it.label)}</span><span class="k">${esc(it.hint || '')}</span></div>`).join('')}`).join('')
      : '<div class="empty">Nada encontrado para essa busca.</div>';
    $$('.cmd-item', d).forEach((el) => {
      el.onmousemove = () => { cur = +el.dataset.i; $$('.cmd-item', d).forEach((x) => x.classList.toggle('on', x === el)); };
      el.onclick = () => go(+el.dataset.i);
    });
  };
  const go = (i) => { const it = items[i]; if (!it) return; close(); location.hash = it.href; };

  $('#cmd-q', d).addEventListener('input', () => { cur = 0; build(); });
  $('#cmd-q', d).addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(cur + 1, items.length - 1); build(); $('.cmd-item.on', d)?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(cur - 1, 0); build(); $('.cmd-item.on', d)?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); go(cur); }
  });
  build();
  try { [patients, reports] = await Promise.all([api.listPatients(true), api.listReports({ limit: 300 })]); build(); } catch { /* segue só com as páginas */ }
  // sessões de 60 dias para trás até 60 dias para frente, e cobranças em aberto por paciente
  try {
    const dia = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    const [aps, abr] = await Promise.all([api.listAppointments({ from: dia(-60), to: dia(60) }).catch(() => []), api.listOpenCharges().catch(() => [])]);
    sessoes = aps.sort((a, b) => Math.abs(new Date(a.date) - Date.now()) - Math.abs(new Date(b.date) - Date.now()));
    const por = {}; abr.forEach((a) => { const k = a.patient_id; por[k] = por[k] || { id: k, nome: a.patients?.name || 'Paciente', n: 0, total: 0 }; por[k].n++; por[k].total += Number(a.amount || 0); });
    abertas = Object.values(por);
    if ($('#cmd-q', d)) build();
  } catch { /* segue sem sessões e cobranças */ }
}
