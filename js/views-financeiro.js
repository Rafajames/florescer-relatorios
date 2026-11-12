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
  $, $$, esc, fmtDate, todayISO, toast, confirmBox, busy, shell, loading, pageHeader, icon, chip, emptyState, callout,
} from './ui.js';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const METHODS = [['', 'Forma de pagamento'], ['pix', 'PIX'], ['dinheiro', 'Dinheiro'], ['cartao', 'Cartão'], ['transferencia', 'Transferência'], ['convenio', 'Convênio']];
const CATS = ['Aluguel', 'Materiais', 'Software e internet', 'Transporte', 'Impostos e taxas', 'Formação', 'Outros'];
const TABS = [['cobrancas', 'Cobranças'], ['valores', 'Valores'], ['despesas', 'Despesas'], ['documentos', 'Documentos'], ['pagamento', 'Dados de pagamento']];

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
  const aba = TABS.some(([k]) => k === params.get('aba')) ? params.get('aba') : 'cobrancas';
  const mes = /^\d{4}-\d{2}$/.test(params.get('mes') || '') ? params.get('mes') : todayISO().slice(0, 7);
  const [from, to] = monthRange(mes);

  main.innerHTML = pageHeader('Financeiro', 'Cobranças, valores, despesas e documentos. Só você vê estes dados.',
    `<input type="month" id="fin-mes" value="${mes}" aria-label="Mês" style="width:auto;margin:0">`) + `
    <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<a class="tab ${k === aba ? 'on' : ''}" href="#/financeiro?aba=${k}&mes=${mes}" style="text-decoration:none">${l}</a>`).join('')}</div>
    <div id="pane"></div>`;
  $('#fin-mes').onchange = (e) => { if (e.target.value) location.hash = `#/financeiro?aba=${aba}&mes=${e.target.value}`; };

  const pane = $('#pane');
  try {
    if (aba === 'pagamento') return paymentTab(pane);
    if (aba === 'valores') return pricesTab(pane, mes);
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
  const [{ patients, adm, aps, priceOf, amountOf }, abertas, pagasNoMes, expenses] = await Promise.all([
    loadBase(from, to), api.listOpenCharges(), api.listPaidBetween(from, to), api.listExpenses({ from, to }),
  ]);
  const prof = state.profile;
  const hoje = todayISO();
  const doMes = aps.filter((a) => cobravel(a, prof));
  const sum = (list) => list.reduce((s, a) => s + amountOf(a), 0);
  // Recebido: pela data do pagamento. A receber: tudo em aberto, de qualquer mês.
  const recebido = sum(pagasNoMes);
  const emAberto = abertas.filter((a) => cobravel(a, prof));
  const aReceber = sum(emAberto);
  const despesas = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  // Em aberto por paciente (todas as datas), com as cobranças agendadas vencidas primeiro.
  const byPatient = new Map();
  emAberto.forEach((a) => {
    if (!byPatient.has(a.patient_id)) byPatient.set(a.patient_id, { id: a.patient_id, name: a.patients?.name || 'Paciente', items: [] });
    byPatient.get(a.patient_id).items.push({ id: a.id, date: a.date, time: a.time, amount: amountOf(a) });
  });
  const devedores = [...byPatient.values()].map((d) => ({ ...d, vencida: cobrancaVencida(adm[d.id], hoje) }))
    .sort((x, y) => (y.vencida - x.vencida) || x.items[0].date.localeCompare(y.items[0].date));
  const diasEmAberto = (d) => Math.max(0, Math.round((new Date(hoje) - new Date(d)) / 864e5));
  const agendaTxt = (d) => {
    const a = adm[d.id] || {};
    if (d.vencida) return chip('Cobrar hoje', 'bloom');
    if (a.next_charge_on) return chip(`Agendada para ${fmtDate(a.next_charge_on)}`, 'petrol');
    if (a.billing_day) return chip(`Todo dia ${a.billing_day}`, 'petrol');
    return '';
  };
  const vencidas = devedores.filter((d) => d.vencida).length;
  const devedoresHtml = devedores.length ? `<section class="panel" style="margin-bottom:16px">
      <h3>Em aberto por paciente</h3>
      <p class="muted small">Sessões ainda não pagas, de qualquer mês.${vencidas ? ` <b>${vencidas} cobrança(s) agendada(s) para hoje.</b>` : ''}</p>
      <div class="table">${devedores.map((d) => {
        const total = d.items.reduce((s, i) => s + i.amount, 0);
        const dias = diasEmAberto(d.items[0].date);
        return `<div class="tr fin-dev">
          <span class="grow t">${esc(d.name)}<small class="muted"> · ${d.items.length} sessão(ões) · mais antiga em ${fmtDate(d.items[0].date)}</small></span>
          <span class="fin-dev-chips">${agendaTxt(d)}${chip(dias ? `${dias} dia(s) em aberto` : 'hoje', dias > 30 ? 'warn' : '')}<b>${brl(total)}</b></span>
          <span class="fin-dev-act"><button class="btn sm" data-cobrar="${d.id}">Cobrar</button>
          <button class="btn quiet sm" data-pago="${d.id}">Registrar pagamento</button>
          <button class="btn quiet sm" data-agendar="${d.id}">Agendar</button></span></div>`;
      }).join('')}</div></section>` : '';
  const devById = Object.fromEntries(devedores.map((d) => [d.id, d]));

  pane.innerHTML = `
    <div class="stats">
      <div class="stat ok"><b>${brl(recebido)}</b><span>Recebido em ${esc(monthLabel(mes))}</span></div>
      <div class="stat warn"><b>${brl(aReceber)}</b><span>A receber (total em aberto)</span></div>
      <div class="stat"><b>${brl(despesas)}</b><span>Despesas do mês</span></div>
      <div class="stat"><b>${brl(recebido - despesas)}</b><span>Saldo do mês</span></div>
    </div>
    ${devedoresHtml}
    <h3 style="margin:18px 0 10px">Sessões de ${esc(monthLabel(mes))}</h3>
    ${doMes.length ? `<div class="table cols-cob" id="cob">
      <div class="tr th cols-cob"><span>Sessão</span><span>Paciente</span><span>Valor</span><span>Situação</span><span>Forma</span></div>
      ${doMes.map((a) => {
        const sem = a.amount == null && !priceOf(a.patient_id);
        return `<div class="tr cols-cob" data-id="${a.id}">
          <span>${fmtDate(a.date)} <small class="muted">${esc(hhmm(a.time))}</small>${a.status === 'falta' ? ' ' + chip('Falta', 'warn') : ''}</span>
          <span class="ellip">${esc(a.patients?.name || '')}</span>
          <span><input type="number" step="0.01" min="0" class="cob-val" value="${amountOf(a) || ''}" aria-label="Valor" style="width:110px;margin:0;min-height:0;padding:5px 8px">${sem ? chip('sem valor', 'warn') : ''}</span>
          <span><select class="cob-st" aria-label="Situação" style="width:auto;margin:0;min-height:0;padding:5px 8px">
            <option value="pendente" ${a.payment_status !== 'pago' ? 'selected' : ''}>Pendente</option>
            <option value="pago" ${a.payment_status === 'pago' ? 'selected' : ''}>Pago</option></select>
            <input type="date" class="cob-dt" value="${a.paid_on || ''}" aria-label="Data do pagamento" style="width:auto;margin:0;min-height:0;padding:5px 6px;${a.payment_status === 'pago' ? '' : 'display:none'}"></span>
          <span><select class="cob-m" aria-label="Forma de pagamento" style="width:auto;margin:0;min-height:0;padding:5px 8px">${METHODS.map(([v, l]) => `<option value="${v}" ${(a.payment_method || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></span>
        </div>`;
      }).join('')}
    </div>
    <p class="muted small" style="margin-top:10px">Cada sessão marcada como <b>realizada</b> vira uma cobrança${prof?.branding?.charge_absence ? ' (faltas sem justificativa também)' : ''}. O valor é gravado quando a sessão é realizada; você pode alterar caso a caso.</p>`
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
  $$('[data-cobrar]').forEach((b) => (b.onclick = () => cobrar(devById[b.dataset.cobrar], pat(b.dataset.cobrar))));
  $$('[data-pago]').forEach((b) => (b.onclick = async () => {
    const d = devById[b.dataset.pago];
    if (await registrarPagamento({ patient: { id: d.id, name: d.name }, items: d.items })) refresh();
  }));
  $$('[data-agendar]').forEach((b) => (b.onclick = async () => {
    const d = devById[b.dataset.agendar];
    if (await agendarCobranca({ patient: { id: d.id, name: d.name }, admin: adm[d.id] })) refresh();
  }));
  $$('#cob .tr[data-id]').forEach((row) => {
    $$('input,select', row).forEach((el) => (el.onchange = () => saveRow(row)));
  });
}

/* ---------- Valores por paciente ---------- */
async function pricesTab(pane, mes) {
  const { patients, adm } = await loadBase(...monthRange(mes));
  const list = patients.filter((p) => !p.archived);
  const dias = (cur) => `<option value="">Sem dia fixo</option>${[...Array(28)].map((_, i) => `<option value="${i + 1}" ${cur === i + 1 ? 'selected' : ''}>Dia ${i + 1}</option>`).join('')}`;
  pane.innerHTML = `<section class="panel"><h2>Valor da sessão e dia de cobrança</h2>
    <p class="muted">O valor é usado nas cobranças e nos orçamentos. Mudar o valor não altera sessões já realizadas. No dia de cobrança, a cobrança do paciente aparece pronta para enviar.</p>
    <label class="check" style="margin-bottom:12px"><input type="checkbox" id="pr-faltas" ${state.profile?.branding?.charge_absence ? 'checked' : ''}> Cobrar também as faltas sem justificativa</label>
    ${list.length ? `<div class="table cols-val">
      <div class="tr th cols-val"><span>Paciente</span><span>Convênio</span><span>Valor da sessão</span><span>Cobrar todo mês</span></div>
      ${list.map((p) => `<div class="tr cols-val" data-pid="${p.id}">
        <span class="ellip t">${esc(p.name)}</span>
        <span class="ellip muted">${esc(adm[p.id]?.insurer || 'Particular')}</span>
        <span><input type="number" step="0.01" min="0" class="pr-val" value="${adm[p.id]?.session_price ?? ''}" placeholder="R$" aria-label="Valor da sessão de ${esc(p.name)}" style="width:130px;margin:0;min-height:0;padding:6px 8px"></span>
        <span><select class="pr-dia" aria-label="Dia de cobrança de ${esc(p.name)}" style="width:auto;margin:0;min-height:0;padding:6px 8px">${dias(adm[p.id]?.billing_day)}</select></span>
      </div>`).join('')}</div>` : '<p class="muted">Nenhum paciente ativo.</p>'}
  </section>`;
  $('#pr-faltas').onchange = async (e) => {
    try { await saveBranding({ charge_absence: e.target.checked }); toast(e.target.checked ? 'Faltas sem justificativa passam a ser cobradas.' : 'Faltas não são cobradas.'); }
    catch (err) { toast(err.message, 'err'); e.target.checked = !e.target.checked; }
  };
  $$('[data-pid]').forEach((row) => {
    const pid = row.dataset.pid;
    const salvar = async (patch, ok) => {
      try { await api.savePatientAdmin({ patient_id: pid, ...patch }); adm[pid] = { ...(adm[pid] || {}), patient_id: pid, ...patch }; toast(ok); }
      catch (err) { toast(err.message, 'err'); }
    };
    $('.pr-val', row).onchange = (e) => salvar({ session_price: e.target.value === '' ? null : Number(e.target.value) }, 'Valor salvo.');
    $('.pr-dia', row).onchange = (e) => salvar({ billing_day: e.target.value ? Number(e.target.value) : null }, e.target.value ? 'Dia de cobrança salvo.' : 'Dia de cobrança removido.');
  });
}

/* ---------- Despesas ---------- */
async function expensesTab(pane, mes, from, to) {
  const list = await api.listExpenses({ from, to });
  pane.innerHTML = `
    <section class="panel"><h2>Nova despesa</h2>
      <div class="grid2">
        <label class="field">Data<input type="date" id="ex-d" value="${todayISO()}"></label>
        <label class="field">Valor (R$)<input type="number" step="0.01" min="0" id="ex-v" placeholder="0,00"></label>
        <label class="field">Descrição<input id="ex-desc" placeholder="Ex.: aluguel da sala 2"></label>
        <label class="field">Categoria<select id="ex-cat">${CATS.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <button class="btn" id="ex-add">${icon('plus')}Adicionar despesa</button>
    </section>
    <h3 style="margin:8px 0 10px">Despesas de ${esc(monthLabel(mes))}: ${brl(list.reduce((s, e) => s + Number(e.amount || 0), 0))}</h3>
    ${list.length ? `<div class="table cols-ex">${list.map((e) => `<div class="tr cols-ex">
      <span>${fmtDate(e.date)}</span><span class="ellip">${esc(e.description)} ${e.category ? chip(e.category) : ''}</span>
      <span>${brl(e.amount)}</span><button class="icon-btn" data-del="${e.id}" aria-label="Excluir despesa" title="Excluir">${icon('trash')}</button></div>`).join('')}</div>`
      : '<p class="muted">Nenhuma despesa neste mês.</p>'}`;

  $('#ex-add').onclick = (e) => busy(e.currentTarget, 'Salvando…', async () => {
    const v = Number($('#ex-v').value), d = $('#ex-d').value, desc = $('#ex-desc').value.trim();
    if (!d || !desc || !(v >= 0) || $('#ex-v').value === '') throw new Error('Preencha data, descrição e valor.');
    await api.saveExpense({ date: d, description: desc, category: $('#ex-cat').value, amount: v });
    toast('Despesa adicionada.'); refresh();
  });
  $$('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox('Excluir esta despesa?', 'Excluir'))) return;
    await api.deleteExpense(b.dataset.del); toast('Despesa excluída.');
    refresh();
  }));
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
    </section>`;
  if (!active.length) { pane.innerHTML = emptyState('Nenhum paciente ativo', 'Cadastre um paciente para gerar orçamento e recibo.', '<a class="btn" href="#/pacientes">Ir para pacientes</a>'); return; }

  const pName = (id) => active.find((p) => p.id === id)?.name || '';
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
    const numero = (state.profile.branding?.recibo_seq || 0) + 1;
    try { await saveBranding({ recibo_seq: numero }); }
    catch (err) { return toast(err.message, 'err'); }
    fn({ ...a, numero });
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
