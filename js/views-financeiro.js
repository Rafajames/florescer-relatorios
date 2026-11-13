// Financeiro: cobranças das sessões realizadas, valores por paciente, despesas,
// orçamento, recibo e dados de pagamento. Cada profissional vê só os próprios dados.
import * as api from './api.js';
import { state } from './state.js';
import { abrirCobranca, registrarPagamento, agendarCobranca } from './cobrar.js';
import { cobravel, cobrancaVencida } from './cobranca.js';
import {
  buildOrcamento, exportOrcamentoPdf, exportOrcamentoWord, exportReciboPdf, exportReciboWord, brl,
} from './export.js';
import {
  $, $$, esc, fmtDate, todayISO, toast, confirmBox, busy, shell, loading, pageHeader, icon, chip, emptyState, callout, openModal,
  sumir,
} from './ui.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const METHODS = [['', 'Forma de pagamento'], ['pix', 'PIX'], ['dinheiro', 'Dinheiro'], ['cartao', 'Cartão'], ['transferencia', 'Transferência'], ['convenio', 'Convênio']];
const CATS = ['Aluguel', 'Materiais', 'Software e internet', 'Transporte', 'Impostos e taxas', 'Formação', 'Outros'];
const ALL_TABS = [['cobrancas', 'Cobranças'], ['despesas', 'Gastos'], ['resumo', 'Resumo'], ['valores', 'Valores'], ['documentos', 'Documentos'], ['pagamento', 'Dados de pagamento']];

const monthRange = (m) => {
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(y, mo, 0, 12);
  return [`${m}-01`, `${m}-${String(last.getDate()).padStart(2, '0')}`];
};
const monthLabel = (m) => { const [y, mo] = m.split('-').map(Number); return `${MONTHS[mo - 1]} de ${y}`; };
const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
// Repinta a aba atual (definir o mesmo hash não dispara nova renderização).
const refresh = () => renderFinanceiro(new URLSearchParams(location.hash.split('?')[1] || ''));

export async function renderFinanceiro(params) {
  const main = shell('financeiro'); loading(main);
  // secretária(o) não altera os dados de pagamento do profissional
  const TABS = state.profile?.role === 'secretary' ? ALL_TABS.filter(([k]) => k !== 'pagamento') : ALL_TABS;
  const aba = TABS.some(([k]) => k === params.get('aba')) ? params.get('aba') : 'cobrancas';
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') || '') ? params.get('mes') : todayISO().slice(0, 7);
  const [from, to] = monthRange(mes);

  main.innerHTML = pageHeader('Financeiro', 'Entradas, gastos, resumo e documentos. Só você vê estes dados.',
    `<input type="month" id="fin-mes" value="${mes}" aria-label="Mês" style="width:auto;margin:0">`) + `
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<a class="tab ${k === aba ? 'on' : ''}" href="#/financeiro?aba=${k}&mes=${mes}" style="text-decoration:none">${l}</a>`).join('')}</div>
    <div id="pane"></div>`;
  $('#fin-mes').onchange = (e) => { if (e.target.value) location.hash = `#/financeiro?aba=${aba}&mes=${e.target.value}`; };

  const pane = $('#pane');
  try {
    if (aba === 'pagamento') return paymentTab(pane);
    if (aba === 'valores') return pricesTab(pane, mes);
    if (aba === 'resumo') return resumoTab(pane, mes);
    if (aba === 'despesas') return expensesTab(pane, mes, from, to);
    if (aba === 'documentos') return documentsTab(pane, mes, from, to);
    return chargesTab(pane, mes, from, to);
  } catch (err) { pane.innerHTML = callout(`<p>${esc(err.message || String(err))}</p>`, 'warn'); }
}

/* ---------- dados comuns ---------- */
async function loadBase(from, to) {
  const [patients, admins, aps] = await Promise.all([
    api.listPatients(), api.listPatientAdmins(), api.listAppointments({ from, to }),
  ]);
  const adm = Object.fromEntries(admins.map((a) => [a.patient_id, a]));
  const priceOf = (pid) => Number(adm[pid]?.session_price) || 0;
  const amountOf = (a) => (a.amount != null ? Number(a.amount) : priceOf(a.patient_id));
  return { patients, adm, aps, priceOf, amountOf };
}

/* ---------- Cobranças ---------- */
async function chargesTab(pane, mes, from, to) {
  const mesAtual = mes === todayISO().slice(0, 7);
  // mensalidades do mês corrente nascem sozinhas (uma por paciente e mês)
  if (mesAtual) { try { await api.ensureMonthlyCharges(mes, monthLabel(mes)); } catch { /* banco sem a tabela: segue */ } }
  const [{ patients, adm, aps, priceOf, amountOf }, abertas, pagasNoMes, expenses, avulsasAbertas, avulsasPagas] = await Promise.all([
    loadBase(from, to), api.listOpenCharges(), api.listPaidBetween(from, to), api.listExpenses({ from, to }),
    api.listCharges({ open: true }).catch(() => []), api.listCharges({ paidFrom: from, paidTo: to }).catch(() => []),
  ]);
  const prof = state.profile;
  const hoje = todayISO();
  const doMes = aps.filter((a) => cobravel(a, prof));
  const sum = (list) => list.reduce((s, a) => s + amountOf(a), 0);
  const total = (list) => list.reduce((s, c) => s + Number(c.amount || 0), 0);
  // Recebido: pela data do pagamento. A receber: tudo em aberto, de qualquer mês.
  const recebido = sum(pagasNoMes) + total(avulsasPagas);
  const emAberto = abertas.filter((a) => cobravel(a, prof));
  const aReceber = sum(emAberto) + total(avulsasAbertas);
  const despesas = expenses.filter((e) => e.paid !== false).reduce((s, e) => s + Number(e.amount || 0), 0);

  // Em aberto: sessões e cobranças avulsas. Quem tem convênio pagando entra no grupo do convênio.
  const ehConv = (pid) => Boolean(adm[pid]?.insurer_pays && adm[pid]?.insurer);
  const grupos = new Map();
  const add = (key, base, item) => { if (!grupos.has(key)) grupos.set(key, { ...base, items: [] }); grupos.get(key).items.push(item); };
  emAberto.forEach((a) => {
    const item = { id: a.id, date: a.date, time: a.time, amount: amountOf(a), who: a.patients?.name || 'Paciente' };
    if (ehConv(a.patient_id)) add('conv:' + adm[a.patient_id].insurer, { key: 'conv:' + adm[a.patient_id].insurer, conv: true, name: adm[a.patient_id].insurer }, item);
    else add(a.patient_id, { key: a.patient_id, id: a.patient_id, name: a.patients?.name || 'Paciente' }, item);
  });
  avulsasAbertas.forEach((c) => add(c.patient_id, { key: c.patient_id, id: c.patient_id, name: c.patients?.name || 'Paciente' },
    { id: 'c:' + c.id, date: c.due_date, amount: Number(c.amount || 0), label: c.description }));
  const devedores = [...grupos.values()].map((d) => ({ ...d, items: d.items.sort((x, y) => x.date.localeCompare(y.date)), vencida: !d.conv && cobrancaVencida(adm[d.id], hoje) }))
    .sort((x, y) => (y.vencida - x.vencida) || (x.conv - y.conv) || x.items[0].date.localeCompare(y.items[0].date));
  const diasEmAberto = (d) => Math.max(0, Math.round((new Date(hoje) - new Date(d)) / 864e5));
  const agendaTxt = (d) => {
    if (d.conv) return chip('Convênio', 'petrol');
    const a = adm[d.id] || {};
    if (d.vencida) return chip('Cobrar hoje', 'bloom');
    if (a.next_charge_on) return chip(`Agendada para ${fmtDate(a.next_charge_on)}`, 'petrol');
    if (a.billing_day) return chip(`Todo dia ${a.billing_day}`, 'petrol');
    return '';
  };
  const vencidas = devedores.filter((d) => d.vencida).length;
  const devedoresHtml = `<section class="panel" style="margin-bottom:16px">
      <div class="panel-head"><h3>Em aberto</h3><button class="btn quiet sm" id="nova-avulsa">${icon('plus')}Nova cobrança avulsa</button></div>
      <p class="muted small">Sessões e cobranças ainda não pagas, de qualquer mês.${vencidas ? ` <b>${vencidas} cobrança(s) agendada(s) para hoje.</b>` : ''}</p>
      ${devedores.length ? `<div class="table">${devedores.map((d) => {
        const tot = d.items.reduce((s, i) => s + i.amount, 0);
        const dias = diasEmAberto(d.items[0].date);
        const nS = d.items.filter((i) => !i.label).length, nC = d.items.length - nS;
        const resumo = [nS ? `${nS} ${nS === 1 ? 'sessão' : 'sessões'}` : '', nC ? `${nC} cobrança${nC === 1 ? '' : 's'}` : ''].filter(Boolean).join(' e ');
        return `<div class="tr fin-dev">
          <span class="grow t">${esc(d.name)}<small class="muted"> · ${resumo} · mais antiga em ${fmtDate(d.items[0].date)}</small></span>
          <span class="fin-dev-chips">${agendaTxt(d)}${chip(dias ? `${dias} dia(s) em aberto` : 'hoje', dias > 30 ? 'warn' : '')}<b>${brl(tot)}</b></span>
          <span class="fin-dev-act">${d.conv ? '' : `<button class="btn sm" data-cobrar="${esc(d.key)}">Cobrar</button>`}
          <button class="btn quiet sm" data-pago="${esc(d.key)}">Registrar pagamento</button>
          ${d.conv ? '' : `<button class="btn quiet sm" data-agendar="${esc(d.key)}">Agendar</button>`}</span></div>`;
      }).join('')}</div>` : '<p class="muted small">Nada em aberto.</p>'}</section>`;
  const devByKey = Object.fromEntries(devedores.map((d) => [d.key, d]));

  pane.innerHTML = `
    <div class="stats">
      <div class="stat ok"><b>${brl(recebido)}</b><span>Recebido em ${esc(monthLabel(mes))}</span></div>
      <div class="stat warn"><b>${brl(aReceber)}</b><span>A receber (total em aberto)</span></div>
      <div class="stat"><b>${brl(despesas)}</b><span>Gastos pagos no mês</span></div>
      <div class="stat"><b>${brl(recebido - despesas)}</b><span>Saldo do mês</span></div>
    </div>
    ${devedoresHtml}
    <h3 style="margin:18px 0 10px">Sessões de ${esc(monthLabel(mes))}</h3>
    ${doMes.length ? `<div class="table cols-cob" id="cob">
      <div class="tr th cols-cob"><span>Sessão</span><span>Paciente</span><span>Valor</span><span>Situação</span><span>Forma</span></div>
      ${doMes.map((a) => {
        const porPlano = ['pacote', 'mensalidade'].includes(a.payment_method);
        const sem = !porPlano && a.amount == null && !priceOf(a.patient_id);
        if (porPlano) return `<div class="tr cols-cob"><span>${fmtDate(a.date)} <small class="muted">${esc(hhmm(a.time))}</small></span><span class="ellip">${esc(a.patients?.name || '')}</span>
          <span class="muted">—</span><span>${chip(a.payment_method === 'pacote' ? 'Do pacote' : 'Da mensalidade', 'ok')}</span><span></span></div>`;
        return `<div class="tr cols-cob" data-id="${a.id}">
          <span>${fmtDate(a.date)} <small class="muted">${esc(hhmm(a.time))}</small>${a.status === 'falta' ? ' ' + chip('Falta', 'warn') : ''}</span>
          <span class="ellip">${esc(a.patients?.name || '')}${ehConv(a.patient_id) ? ' ' + chip(adm[a.patient_id].insurer, 'petrol') : ''}</span>
          <span><input type="number" step="0.01" min="0" class="cob-val" value="${amountOf(a) || ''}" aria-label="Valor" style="width:110px;margin:0;min-height:0;padding:5px 8px">${sem ? chip('sem valor', 'warn') : ''}</span>
          <span><select class="cob-st" aria-label="Situação" style="width:auto;margin:0;min-height:0;padding:5px 8px">
            <option value="pendente" ${a.payment_status !== 'pago' ? 'selected' : ''}>Pendente</option>
            <option value="pago" ${a.payment_status === 'pago' ? 'selected' : ''}>Pago</option></select>
            <input type="date" class="cob-dt" value="${a.paid_on || ''}" aria-label="Data do pagamento" style="width:auto;margin:0;min-height:0;padding:5px 6px;${a.payment_status === 'pago' ? '' : 'display:none'}"></span>
          <span><select class="cob-m" aria-label="Forma de pagamento" style="width:auto;margin:0;min-height:0;padding:5px 8px">${METHODS.map(([v, l]) => `<option value="${v}" ${(a.payment_method || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${a.payment_note ? `<br><small class="muted">${esc(a.payment_note)}</small>` : ''}</span>
        </div>`;
      }).join('')}
    </div>
    <p class="muted small" style="margin-top:10px">Cada sessão marcada como <b>realizada</b> vira uma cobrança${prof?.branding?.charge_absence ? ' (faltas sem justificativa também)' : ''}. Sessões de quem paga mensalidade ou tem pacote com saldo já entram quitadas.</p>`
      : emptyState('Nenhuma sessão para cobrar neste mês', 'Marque as sessões como realizadas na agenda do Administrativo. Elas aparecem aqui como cobranças.', '<a class="btn quiet" href="#/administrativo">Ir para a agenda</a>')}`;

  const saveRow = async (row) => {
    const id = row.dataset.id;
    const st = $('.cob-st', row).value;
    const dt = $('.cob-dt', row);
    const patch = {
      amount: $('.cob-val', row).value === '' ? null : Number($('.cob-val', row).value),
      payment_status: st,
      paid_on: st === 'pago' ? (dt.value || todayISO()) : null,
      payment_method: $('.cob-m', row).value || null,
    };
    try { await api.updateAppointment(id, patch); toast('Cobrança atualizada.'); refresh(); }
    catch (err) { toast(err.message, 'err'); }
  };
  const pat = (id) => patients.find((x) => x.id === id);
  $$('[data-cobrar]').forEach((b) => (b.onclick = () => cobrar(devByKey[b.dataset.cobrar], pat(b.dataset.cobrar))));
  $$('[data-pago]').forEach((b) => (b.onclick = async () => {
    const d = devByKey[b.dataset.pago];
    const items = d.conv ? d.items.map((i) => ({ ...i, label: `${i.who} · ${fmtDate(i.date)}` })) : d.items;
    if (await registrarPagamento({ patient: { id: d.id, name: d.name }, items })) refresh();
  }));
  $$('[data-agendar]').forEach((b) => (b.onclick = async () => {
    const d = devByKey[b.dataset.agendar];
    if (await agendarCobranca({ patient: { id: d.id, name: d.name }, admin: adm[d.id] })) refresh();
  }));
  $('#nova-avulsa').onclick = async () => {
    const ativos = patients.filter((p) => !p.archived);
    if (!ativos.length) return toast('Cadastre um paciente primeiro.', 'err');
    const r = await openModal('Nova cobrança avulsa', `
      <p class="muted small">Para o que não é sessão: avaliação, relatório, material, taxa.</p>
      <label class="field">Paciente<select name="p">${ativos.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <label class="field">Descrição<input name="d" required maxlength="120" placeholder="Ex.: Avaliação inicial"></label>
      <div class="grid2"><label class="field">Valor (R$)<input type="number" step="0.01" min="0" name="v" required></label>
      <label class="field">Vencimento<input type="date" name="dt" value="${hoje}" required></label></div>`,
    { okText: 'Criar cobrança', onOk: async (d) => {
      const f = (n) => d.querySelector(`[name=${n}]`).value;
      if (!f('d').trim() || f('v') === '') { toast('Preencha a descrição e o valor.', 'err'); return false; }
      await api.saveCharge({ patient_id: f('p'), kind: 'avulsa', description: f('d').trim(), amount: Number(f('v')), due_date: f('dt') || hoje });
      return true;
    } });
    if (r) { toast('Cobrança criada.'); refresh(); }
  };
  $$('#cob .tr[data-id]').forEach((row) => {
    $$('input,select', row).forEach((el) => (el.onchange = () => saveRow(row)));
  });
}

/* ---------- Valores por paciente ---------- */
const MODOS = [['sessao', 'Por sessão'], ['mensal', 'Mensalidade'], ['pacote', 'Pacote de sessões']];
async function pricesTab(pane, mes) {
  const { patients, adm } = await loadBase(...monthRange(mes));
  const list = patients.filter((p) => !p.archived);
  const dias = (cur) => `<option value="">Sem dia fixo</option>${[...Array(28)].map((_, i) => `<option value="${i + 1}" ${cur === i + 1 ? 'selected' : ''}>Dia ${i + 1}</option>`).join('')}`;
  const resumo = (a = {}) => (a.billing_mode === 'mensal' ? `Mensalidade de ${a.monthly_fee != null ? brl(a.monthly_fee) : 'valor não definido'}`
    : a.billing_mode === 'pacote' ? `Pacote de ${a.package_size || '?'} sessões por ${a.package_price != null ? brl(a.package_price) : '?'} · saldo: ${a.package_balance || 0}`
      : a.session_price != null ? `${brl(a.session_price)} por sessão` : 'Valor não definido');
  pane.innerHTML = `<section class="panel"><h2>Como cada paciente paga</h2>
    <p class="muted">Por sessão, mensalidade fixa ou pacote pago adiantado. Mudar o valor não altera sessões já realizadas. No dia de cobrança, a cobrança aparece pronta para enviar.</p>
    <label class="check" style="margin-bottom:12px"><input type="checkbox" id="pr-faltas" ${state.profile?.branding?.charge_absence ? 'checked' : ''} ${state.profile?.role === 'secretary' ? 'disabled title="Só o(a) profissional altera"' : ''}> Cobrar também as faltas sem justificativa (só na cobrança por sessão)</label>
    ${list.length ? `<div class="table">${list.map((p) => `<div class="tr val-row" data-pid="${p.id}">
        <span class="grow t">${esc(p.name)}<small class="muted"> · ${esc(adm[p.id]?.insurer || 'Particular')}${adm[p.id]?.insurer_pays ? ' (convênio paga)' : ''}</small><br><small>${resumo(adm[p.id])}</small></span>
        <span class="row" style="gap:6px;flex-wrap:wrap">${adm[p.id]?.billing_mode === 'pacote' ? '<button class="btn sm" data-vender>Vender pacote</button>' : ''}
        <button class="btn quiet sm" data-edit>${icon('edit')}Alterar</button></span></div>`).join('')}</div>` : '<p class="muted">Nenhum paciente ativo.</p>'}
  </section>`;
  $('#pr-faltas').onchange = async (e) => {
    try { await saveBranding({ charge_absence: e.target.checked }); toast(e.target.checked ? 'Faltas sem justificativa passam a ser cobradas.' : 'Faltas não são cobradas.'); }
    catch (err) { toast(err.message, 'err'); e.target.checked = !e.target.checked; }
  };
  $$('[data-pid]').forEach((row) => {
    const pid = row.dataset.pid; const p = list.find((x) => x.id === pid); const a = adm[pid] || {};
    $('[data-edit]', row).onclick = async () => {
      const r = await openModal(`Como ${p.name} paga`, `
        <label class="field">Forma de cobrança<select name="modo">${MODOS.map(([k, l]) => `<option value="${k}" ${k === (a.billing_mode || 'sessao') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div data-m="sessao"><label class="field">Valor da sessão (R$)<input type="number" step="0.01" min="0" name="preco" value="${a.session_price ?? ''}"></label></div>
        <div data-m="mensal"><label class="field">Valor da mensalidade (R$)<input type="number" step="0.01" min="0" name="mensal" value="${a.monthly_fee ?? ''}"><small>A cobrança do mês nasce sozinha. As sessões realizadas entram quitadas.</small></label></div>
        <div data-m="pacote"><div class="grid2"><label class="field">Sessões por pacote<input type="number" min="1" max="99" name="psize" value="${a.package_size ?? ''}"></label>
          <label class="field">Valor do pacote (R$)<input type="number" step="0.01" min="0" name="pprice" value="${a.package_price ?? ''}"></label></div>
          <label class="field">Valor da sessão quando o pacote acabar (R$)<input type="number" step="0.01" min="0" name="preco2" value="${a.session_price ?? ''}"></label>
          <p class="muted small">Saldo atual: ${a.package_balance || 0} sessão(ões). Use “Vender pacote” para somar sessões e gerar a cobrança.</p></div>
        <label class="field">Dia de cobrança<select name="dia">${dias(a.billing_day)}</select></label>
        ${a.insurer ? `<label class="check"><input type="checkbox" name="conv" ${a.insurer_pays ? 'checked' : ''}> Quem paga é o convênio (${esc(a.insurer)}), não o paciente</label>` : '<p class="muted small">Para marcar que o convênio paga, informe o convênio do paciente na folha de frequência.</p>'}`,
      { okText: 'Salvar',
        onOpen: (d) => { const sync = () => d.querySelectorAll('[data-m]').forEach((el) => { el.style.display = el.dataset.m === d.querySelector('[name=modo]').value ? '' : 'none'; }); d.querySelector('[name=modo]').onchange = sync; sync(); },
        onOk: async (d) => {
          const f = (n) => d.querySelector(`[name=${n}]`)?.value ?? ''; const num = (v) => (v === '' ? null : Number(v));
          const modo = f('modo');
          if (modo === 'mensal' && f('mensal') === '') { toast('Informe o valor da mensalidade.', 'err'); return false; }
          if (modo === 'pacote' && (f('psize') === '' || f('pprice') === '')) { toast('Informe as sessões e o valor do pacote.', 'err'); return false; }
          await api.savePatientAdmin({ patient_id: pid, billing_mode: modo, session_price: num(modo === 'pacote' ? f('preco2') : f('preco')),
            monthly_fee: num(f('mensal')), package_size: num(f('psize')), package_price: num(f('pprice')),
            billing_day: f('dia') ? Number(f('dia')) : null, insurer_pays: Boolean(d.querySelector('[name=conv]')?.checked) });
          return true;
        } });
      if (r) { toast('Forma de cobrança salva.'); refresh(); }
    };
    if ($('[data-vender]', row)) $('[data-vender]', row).onclick = async () => {
      if (!a.package_size || a.package_price == null) return toast('Defina as sessões e o valor do pacote em Alterar.', 'err');
      if (!(await confirmBox(`Vender um pacote de ${a.package_size} sessões por ${brl(a.package_price)} para ${p.name}? O saldo passa de ${a.package_balance || 0} para ${(a.package_balance || 0) + a.package_size} e a cobrança entra em aberto.`, 'Vender pacote'))) return;
      await api.saveCharge({ patient_id: pid, kind: 'pacote', description: `Pacote de ${a.package_size} sessões`, amount: a.package_price, due_date: todayISO() });
      await api.savePatientAdmin({ patient_id: pid, package_balance: (a.package_balance || 0) + a.package_size });
      toast('Pacote vendido. A cobrança está em Cobranças.'); refresh();
    };
  });
}

/* ---------- Gastos ---------- */
async function expensesTab(pane, mes, from, to) {
  let trazidas = 0;
  if (mes === todayISO().slice(0, 7)) { try { trazidas = await api.ensureFixedExpenses(mes); } catch { trazidas = 0; } }
  const list = await api.listExpenses({ from, to });
  const pagos = list.filter((e) => e.paid !== false), aPagar = list.filter((e) => e.paid === false);
  const soma = (l) => l.reduce((s, e) => s + Number(e.amount || 0), 0);
  const porCat = {}; list.forEach((e) => { porCat[e.category || 'Outros'] = (porCat[e.category || 'Outros'] || 0) + Number(e.amount || 0); });
  const maior = Math.max(1, ...Object.values(porCat));
  const form = (e) => openModal(e ? 'Editar gasto' : 'Novo gasto', `
    <div class="grid2">
      <label class="field">Data${e ? '' : ' (ou vencimento)'}<input type="date" name="d" value="${e?.date || todayISO()}" required></label>
      <label class="field">Valor (R$)<input type="number" step="0.01" min="0.01" name="v" value="${e?.amount ?? ''}" required></label>
    </div>
    <label class="field">Descrição<input name="desc" value="${esc(e?.description || '')}" required maxlength="120" placeholder="Ex.: aluguel da sala"></label>
    <label class="field">Categoria<select name="cat">${CATS.map((c) => `<option ${c === (e?.category || 'Outros') ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <label class="check"><input type="checkbox" name="paid" ${e?.paid === false ? '' : 'checked'}> Já está pago</label>
    <label class="check"><input type="checkbox" name="fixed" ${e?.fixed ? 'checked' : ''}> Gasto fixo: repetir todo mês</label>`,
  { okText: 'Salvar', onOk: async (d) => {
    const f = (n) => d.querySelector(`[name=${n}]`);
    if (!f('d').value || !f('desc').value.trim() || !(Number(f('v').value) > 0)) { toast('Preencha data, descrição e um valor maior que zero.', 'err'); return false; }
    await api.saveExpense({ ...(e ? { id: e.id } : {}), date: f('d').value, description: f('desc').value.trim(), category: f('cat').value, amount: Number(f('v').value), paid: f('paid').checked, fixed: f('fixed').checked });
    return true;
  } });
  pane.innerHTML = `
    ${trazidas ? callout(`<p>${trazidas} gasto(s) fixo(s) do mês passado entraram neste mês como <b>a pagar</b>.</p>`) : ''}
    <div class="stats">
      <div class="stat"><b>${brl(soma(pagos))}</b><span>Pago em ${esc(monthLabel(mes))}</span></div>
      <div class="stat warn"><b>${brl(soma(aPagar))}</b><span>A pagar</span></div>
      <div class="stat"><b>${brl(soma(list.filter((e) => e.fixed)))}</b><span>Gastos fixos</span></div>
      <div class="stat"><b>${brl(soma(list))}</b><span>Total do mês</span></div>
    </div>
    <div class="panel-head"><h3>Gastos de ${esc(monthLabel(mes))}</h3><button class="btn" id="ex-add">${icon('plus')}Novo gasto</button></div>
    ${list.length ? `<div class="table cols-ex">${list.map((e) => `<div class="tr cols-ex">
      <span>${fmtDate(e.date)}</span><span class="ellip">${esc(e.description)} ${e.category ? chip(e.category) : ''}${e.fixed ? ' ' + chip('Fixo', 'petrol') : ''}</span>
      <span>${brl(e.amount)}<br>${e.paid === false ? `<button class="link small" data-pagar="${e.id}">Marcar como pago</button>` : '<small class="muted">pago</small>'}</span>
      <span class="row" style="gap:0;flex-wrap:nowrap"><button class="icon-btn" data-ed="${e.id}" aria-label="Editar gasto" title="Editar">${icon('edit')}</button><button class="icon-btn" data-del="${e.id}" aria-label="Excluir gasto" title="Excluir">${icon('trash')}</button></span></div>`).join('')}</div>
      <section class="panel" style="margin-top:16px"><h3>Por categoria</h3>
        ${Object.entries(porCat).sort((x, y) => y[1] - x[1]).map(([c, v]) => `<div class="cat-bar"><span>${esc(c)}</span><i><b style="width:${Math.round((v / maior) * 100)}%"></b></i><span>${brl(v)}</span></div>`).join('')}</section>`
      : emptyState('Nenhum gasto neste mês', 'Registre aluguel, materiais, impostos e outros gastos do consultório. Marque como fixo o que se repete todo mês.')}`;

  $('#ex-add').onclick = async () => { if (await form()) { toast('Gasto salvo.'); refresh(); } };
  $$('[data-ed]').forEach((b) => (b.onclick = async () => { if (await form(list.find((e) => e.id === b.dataset.ed))) { toast('Gasto atualizado.'); refresh(); } }));
  $$('[data-pagar]').forEach((b) => (b.onclick = async () => { await api.saveExpense({ id: b.dataset.pagar, paid: true }); toast('Gasto marcado como pago.'); refresh(); }));
  $$('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Excluir este gasto?', 'Excluir'))) return;
    await api.deleteExpense(b.dataset.del); toast('Gasto excluído.');
    await sumir(b.closest('.tr') || null); refresh();
  }));
}

/* ---------- Resumo: entradas e saídas dos últimos meses, para acompanhar e mandar ao contador ---------- */
async function resumoTab(pane, mes) {
  const [y, mo] = mes.split('-').map(Number);
  const meses = [...Array(6)].map((_, i) => { const d = new Date(y, mo - 1 - (5 - i), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const de = `${meses[0]}-01`, ate = monthRange(mes)[1];
  const [sess, avul, exps] = await Promise.all([api.listPaidBetween(de, ate), api.listCharges({ paidFrom: de, paidTo: ate }).catch(() => []), api.listExpenses({ from: de, to: ate })]);
  const admins = await api.listPatientAdmins();
  const preco = Object.fromEntries(admins.map((a) => [a.patient_id, Number(a.session_price) || 0]));
  const entradas = [...sess.map((a) => ({ m: a.paid_on.slice(0, 7), v: a.amount != null ? Number(a.amount) : preco[a.patient_id] || 0, forma: a.payment_method || 'não informada' })),
    ...avul.map((c) => ({ m: c.paid_on.slice(0, 7), v: Number(c.amount || 0), forma: c.payment_method || 'não informada' }))].filter((e) => e.v > 0);
  const saidas = exps.filter((e) => e.paid !== false).map((e) => ({ m: e.date.slice(0, 7), v: Number(e.amount || 0), cat: e.category || 'Outros' }));
  const tot = (l, m) => l.filter((x) => x.m === m).reduce((s, x) => s + x.v, 0);
  const linhas = meses.map((m) => ({ m, ent: tot(entradas, m), sai: tot(saidas, m) }));
  const max = Math.max(1, ...linhas.flatMap((l) => [l.ent, l.sai]));
  const curto = (m) => MONTHS[Number(m.slice(5)) - 1].slice(0, 3);
  const FORMA = { pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência', convenio: 'Convênio', 'não informada': 'Não informada' };
  const agrupa = (l, k) => Object.entries(l.filter((x) => x.m === mes).reduce((o, x) => { o[x[k]] = (o[x[k]] || 0) + x.v; return o; }, {})).sort((a, b) => b[1] - a[1]);
  const atual = linhas[linhas.length - 1];

  pane.innerHTML = `
    <div class="stats">
      <div class="stat ok"><b>${brl(atual.ent)}</b><span>Entradas em ${esc(monthLabel(mes))}</span></div>
      <div class="stat warn"><b>${brl(atual.sai)}</b><span>Saídas (gastos pagos)</span></div>
      <div class="stat"><b>${brl(atual.ent - atual.sai)}</b><span>Saldo do mês</span></div>
      <div class="stat"><b>${brl(linhas.reduce((s, l) => s + l.ent - l.sai, 0))}</b><span>Saldo dos 6 meses</span></div>
    </div>
    <section class="panel"><h3>Entradas e saídas dos últimos 6 meses</h3>
      <div class="graf6" role="img" aria-label="${linhas.map((l) => `${monthLabel(l.m)}: entradas ${brl(l.ent)}, saídas ${brl(l.sai)}`).join('; ')}">
        ${linhas.map((l) => `<div class="g6"><div class="g6-b"><i class="ent" style="height:${Math.round((l.ent / max) * 100)}%" title="Entradas: ${brl(l.ent)}"></i><i class="sai" style="height:${Math.round((l.sai / max) * 100)}%" title="Saídas: ${brl(l.sai)}"></i></div><span>${curto(l.m)}</span></div>`).join('')}
      </div>
      <p class="small muted"><span class="g6-leg ent"></span>Entradas <span class="g6-leg sai" style="margin-left:14px"></span>Saídas</p>
      <div class="table" style="margin-top:10px"><div class="tr th cols-res"><span>Mês</span><span>Entradas</span><span>Saídas</span><span>Saldo</span></div>
        ${linhas.map((l) => `<div class="tr cols-res"><span>${esc(monthLabel(l.m))}</span><span>${brl(l.ent)}</span><span>${brl(l.sai)}</span><b>${brl(l.ent - l.sai)}</b></div>`).join('')}</div>
    </section>
    <div class="grid2">
      <section class="panel"><h3>Entradas de ${esc(monthLabel(mes))} por forma</h3>${agrupa(entradas, 'forma').map(([k, v]) => `<div class="fin-dl"><div><dt>${esc(FORMA[k] || k)}</dt><dd>${brl(v)}</dd></div></div>`).join('') || '<p class="muted small">Nenhuma entrada no mês.</p>'}</section>
      <section class="panel"><h3>Saídas de ${esc(monthLabel(mes))} por categoria</h3>${agrupa(saidas, 'cat').map(([k, v]) => `<div class="fin-dl"><div><dt>${esc(k)}</dt><dd>${brl(v)}</dd></div></div>`).join('') || '<p class="muted small">Nenhum gasto pago no mês.</p>'}</section>
    </div>
    <div class="row"><button class="btn quiet" id="res-csv">${icon('download')}Baixar planilha para o contador (CSV)</button></div>
    <p class="muted small">Entradas contam pela data do pagamento. Saídas contam os gastos marcados como pagos.</p>`;

  $('#res-csv').onclick = () => {
    const n = (v) => Number(v).toFixed(2).replace('.', ',');
    const rows = [['Tipo', 'Data', 'Descrição', 'Categoria ou forma', 'Valor'],
      ...sess.map((a) => ['Entrada', a.paid_on, `Sessão de ${a.date} - ${a.patients?.name || ''}`, FORMA[a.payment_method] || a.payment_method || '', n(a.amount != null ? a.amount : preco[a.patient_id] || 0)]),
      ...avul.map((c) => ['Entrada', c.paid_on, `${c.description} - ${c.patients?.name || ''}`, FORMA[c.payment_method] || c.payment_method || '', n(c.amount)]),
      ...exps.filter((e) => e.paid !== false).map((e) => ['Saída', e.date, e.description, e.category || '', n(e.amount)])];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
    el.download = `potira-entradas-saidas-${meses[0]}-a-${mes}.csv`; document.body.appendChild(el); el.click(); el.remove();
    api.logExport('resumo_financeiro', null, { de, ate });
  };
}

/* ---------- Documentos: orçamento e recibo ---------- */
async function documentsTab(pane, mes, from, to) {
  const { patients, adm, aps, priceOf, amountOf } = await loadBase(from, to);
  const active = patients.filter((p) => !p.archived);
  const pay = state.profile?.branding?.payment || {};
  pane.innerHTML = `
    <section class="panel"><h2>Orçamento</h2>
      <p class="muted">Sessões no mês × valor da sessão, com os dados de pagamento no rodapé. Válido por 15 dias.</p>
      <div class="grid2">
        <label class="field">Paciente<select id="or-p">${active.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
        <label class="field">Sessões no mês<input type="number" min="1" max="31" id="or-n" value="8"></label>
        <label class="field">Valor da sessão (R$)<input type="number" step="0.01" min="0" id="or-v"></label>
      </div>
      <div class="row"><button class="btn" id="or-pdf">${icon('download')}Gerar PDF</button><button class="btn quiet" id="or-doc">Word</button></div>
    </section>
    <section class="panel"><h2>Recibo</h2>
      <p class="muted">Recibo das sessões <b>pagas</b> de ${esc(monthLabel(mes))} do paciente escolhido.</p>
      <label class="field">Paciente<select id="rc-p">${active.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>
      <div id="rc-info" class="small" style="margin:8px 0"></div>
      <div class="row"><button class="btn" id="rc-pdf">${icon('download')}Gerar PDF</button><button class="btn quiet" id="rc-doc">Word</button></div>
    </section>
    <section class="panel"><h2>Recibos emitidos</h2><div id="rc-list"><p class="muted small">Carregando…</p></div></section>`;
  if (!active.length) { pane.innerHTML = emptyState('Nenhum paciente ativo', 'Cadastre um paciente para gerar orçamento e recibo.', '<a class="btn" href="#/pacientes">Ir para pacientes</a>'); return; }

  const pName = (id) => active.find((p) => p.id === id)?.name || '';
  // Recibos guardados: a segunda via sai com o mesmo número e o mesmo conteúdo.
  const drawRecibos = async () => {
    const box = $('#rc-list'); if (!box) return;
    let recs = []; try { recs = await api.listReceipts(); } catch { recs = []; }
    box.innerHTML = recs.length ? `<div class="table">${recs.map((r) => `<div class="tr" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span class="grow t">Nº ${String(r.numero).padStart(4, '0')} · ${esc(r.patients?.name || r.data?.patientName || '')}<small class="muted"> · ${fmtDate(r.issued_on)} · ${esc(r.data?.monthLabel || '')}</small></span>
      <b>${brl(r.total)}</b><button class="btn quiet sm" data-via="${r.id}">Segunda via (PDF)</button></div>`).join('')}</div>` : '<p class="muted small">Nenhum recibo emitido ainda.</p>';
    $$('[data-via]', box).forEach((b) => (b.onclick = () => { const r = recs.find((x) => x.id === b.dataset.via); exportReciboPdf({ professional: state.profile, payment: pay, ...r.data, numero: r.numero }); }));
  };
  drawRecibos();
  const specialty = state.profile?.specialty || '';
  const syncPrice = () => { $('#or-v').value = priceOf($('#or-p').value) || ''; };
  syncPrice();
  $('#or-p').onchange = syncPrice;

  const paidFor = (pid) => aps.filter((a) => a.patient_id === pid && cobravel(a, state.profile) && a.payment_status === 'pago');
  const refreshRc = () => {
    const items = paidFor($('#rc-p').value);
    const total = items.reduce((s, a) => s + amountOf(a), 0);
    $('#rc-info').innerHTML = items.length ? `${items.length} sessão(ões) paga(s) · total ${chip(brl(total), 'ok')}`
      : '<span class="muted">Nenhuma sessão paga neste mês para este paciente.</span>';
  };
  $('#rc-p').onchange = refreshRc; refreshRc();

  const orcArgs = () => ({
    professional: state.profile, patientName: pName($('#or-p').value), specialty,
    sessionsPerMonth: Number($('#or-n').value) || 0, unitPrice: Number($('#or-v').value) || 0,
    monthLabel: monthLabel(mes), payment: pay, validityDays: 15,
  });
  $('#or-pdf').onclick = () => { if (!$('#or-v').value) return toast('Informe o valor da sessão.', 'err'); exportOrcamentoPdf(orcArgs()); };
  $('#or-doc').onclick = () => { if (!$('#or-v').value) return toast('Informe o valor da sessão.', 'err'); exportOrcamentoWord(orcArgs()); };

  const rcArgs = () => {
    const items = paidFor($('#rc-p').value);
    return { professional: state.profile, patientName: pName($('#rc-p').value), specialty, monthLabel: monthLabel(mes),
      items: items.map((a) => ({ date: a.date, time: a.time, amount: amountOf(a) })),
      total: items.reduce((s, a) => s + amountOf(a), 0), payment: pay };
  };
  const needRc = (a) => { if (!a.items.length) { toast('Não há sessões pagas para este recibo.', 'err'); return false; } return true; };
  // Recibo com número sequencial: o número só avança quando o recibo é emitido.
  const emitRecibo = (fn) => async () => {
    const a = rcArgs(); if (!needRc(a)) return;
    // o número vem do banco (sequência no perfil do profissional), para a secretária também poder emitir
    let numero;
    try { numero = await api.nextReceiptNumber(); state.profile = { ...state.profile, branding: { ...(state.profile.branding || {}), recibo_seq: numero } }; }
    catch (err) { return toast(err.message, 'err'); }
    fn({ ...a, numero });
    api.saveReceipt({ patient_id: $('#rc-p').value, numero, total: a.total, data: { patientName: a.patientName, specialty: a.specialty, monthLabel: a.monthLabel, items: a.items, total: a.total } })
      .then(() => drawRecibos()).catch(() => {});
    api.logExport('recibo', null, { numero, sessoes: a.items.length, total: a.total });
  };
  $('#rc-pdf').onclick = emitRecibo(exportReciboPdf);
  $('#rc-doc').onclick = emitRecibo(exportReciboWord);
}

/* ---------- Dados de pagamento (aparecem no orçamento e no recibo) ---------- */
async function paymentTab(pane) {
  const p = state.profile || {};
  const pay = (p.branding && p.branding.payment) || {};
  const f = (k, label, ph = '') => `<label class="field">${label}<input name="${k}" value="${esc(pay[k] || '')}" placeholder="${esc(ph)}"></label>`;
  const extraRow = (e = {}) => `<div class="grid2 pix-extra-row" style="align-items:end">
      <label class="field">Nome da chave<input name="xl" value="${esc(e.label || '')}" placeholder="Ex.: Outro banco"></label>
      <label class="field">Chave PIX<input name="xk" value="${esc(e.key || '')}" placeholder="CPF, CNPJ, e-mail ou telefone"></label>
      <button type="button" class="btn quiet sm" data-rm-pix>Remover</button></div>`;
  pane.innerHTML = `
    <form id="pay-f" class="panel"><h2>Dados de pagamento</h2>
      <p class="muted">Aparecem no rodapé do orçamento, na cobrança e no recibo, para o paciente pagar e enviar o comprovante.</p>
      <div class="grid2">
        ${f('doc', 'CNPJ ou CPF', 'Ex.: 00.000.000/0001-00')}
        ${f('bank', 'Banco', 'Ex.: Itaú')}
        ${f('agency', 'Agência')}
        ${f('account', 'Conta')}
        ${f('holder', 'Titular da conta')}
        ${f('pix', 'Chave PIX principal', 'CNPJ, CPF, e-mail ou telefone')}
        ${f('city', 'Cidade (para o PIX)', 'Ex.: Boa Vista')}
      </div>
      <h3 style="margin-top:14px">Outras chaves PIX</h3>
      <p class="muted small">Cadastre outras chaves (ex.: de outro banco). Na hora de cobrar, você escolhe qual usar. Se houver só a principal, ela é usada.</p>
      <div id="pix-extras">${(pay.pix_extra || []).map(extraRow).join('')}</div>
      <button type="button" class="btn quiet sm" id="add-pix" style="margin:8px 0">${icon('plus')}Adicionar chave PIX</button>
      <label class="field">Observação<textarea name="note" rows="2" placeholder="Ex.: enviar o comprovante pelo WhatsApp (83) 98778-2014">${esc(pay.note || '')}</textarea></label>
      <button class="btn" type="submit">Salvar dados de pagamento</button>
    </form>`;
  const extras = $('#pix-extras', pane);
  const bindRm = () => extras.querySelectorAll('[data-rm-pix]').forEach((b) => { b.onclick = () => b.closest('.pix-extra-row').remove(); });
  bindRm();
  $('#add-pix', pane).onclick = () => { extras.insertAdjacentHTML('beforeend', extraRow()); bindRm(); };
  $('#pay-f').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payment = Object.fromEntries(['doc', 'bank', 'agency', 'account', 'holder', 'pix', 'city', 'note'].map((k) => [k, String(fd.get(k) || '').trim()]));
    const labels = fd.getAll('xl'), keys = fd.getAll('xk');
    payment.pix_extra = keys.map((k, i) => ({ label: String(labels[i] || '').trim(), key: String(k || '').trim() })).filter((x) => x.key);
    return busy(e.submitter || $('[type=submit]', e.target), 'Salvando…', async () => {
      const branding = { ...(p.branding || {}), payment };
      const row = await api.updateProfile(p.id, { branding });
      state.profile = { ...state.profile, branding: row.branding };
      toast('Dados de pagamento salvos.');
    });
  };
}

async function saveBranding(patch) {
  const branding = { ...(state.profile.branding || {}), ...patch };
  const row = await api.updateProfile(state.profile.id, { branding });
  state.profile = { ...state.profile, branding: row.branding };
}

/** Cobrança a partir da lista de inadimplência. */
function cobrar(d, pat) {
  return abrirCobranca({ profile: state.profile, patient: { id: d.id, name: d.name, phone: pat?.phone }, items: d.items });
}
