// Financeiro: cobranças dos atendimentos realizados, valores por paciente, despesas,
// orçamento, recibo e dados de pagamento. Cada profissional vê só os próprios dados.
import * as api from './api.js';
import { state } from './state.js';
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
  const { aps, priceOf, amountOf } = await loadBase(from, to);
  const real = aps.filter((a) => a.status === 'realizado');
  const sum = (list) => list.reduce((s, a) => s + amountOf(a), 0);
  const recebido = sum(real.filter((a) => a.payment_status === 'pago'));
  const aReceber = sum(real.filter((a) => a.payment_status !== 'pago'));
  const expenses = await api.listExpenses({ from, to });
  const despesas = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  pane.innerHTML = `
    <div class="stats">
      <div class="stat ok"><b>${brl(recebido)}</b><span>Recebido no mês</span></div>
      <div class="stat warn"><b>${brl(aReceber)}</b><span>A receber</span></div>
      <div class="stat"><b>${brl(despesas)}</b><span>Despesas</span></div>
      <div class="stat"><b>${brl(recebido - despesas)}</b><span>Saldo</span></div>
    </div>
    ${real.length ? `<div class="table cols-cob" id="cob">
      <div class="tr th cols-cob"><span>Atendimento</span><span>Paciente</span><span>Valor</span><span>Situação</span><span>Forma</span></div>
      ${real.map((a) => {
        const sem = a.amount == null && !priceOf(a.patient_id);
        return `<div class="tr cols-cob" data-id="${a.id}">
          <span>${fmtDate(a.date)} <small class="muted">${esc(hhmm(a.time))}</small></span>
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
    <p class="muted small" style="margin-top:10px">Cada atendimento marcado como <b>realizado</b> no Administrativo vira uma cobrança aqui. O valor vem do preço do paciente, mas você pode alterar caso a caso.</p>`
      : emptyState('Nenhum atendimento realizado neste mês', 'Marque os atendimentos como realizados na agenda do Administrativo. Eles aparecem aqui como cobranças.', '<a class="btn quiet" href="#/administrativo">Ir para a agenda</a>')}`;

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
    dt.style.display = st === 'pago' ? '' : 'none';
    dt.value = patch.paid_on || '';
    try { await api.updateAppointment(id, patch); toast('Cobrança atualizada.'); refresh(); }
    catch (err) { toast(err.message, 'err'); }
  };
  $$('#cob .tr[data-id]').forEach((row) => {
    $$('input,select', row).forEach((el) => (el.onchange = () => saveRow(row)));
  });
}

/* ---------- Valores por paciente ---------- */
async function pricesTab(pane, mes) {
  const { patients, adm } = await loadBase(...monthRange(mes));
  const list = patients.filter((p) => !p.archived);
  pane.innerHTML = `<section class="panel"><h2>Valor da sessão por paciente</h2>
    <p class="muted">Usado nas cobranças e nos orçamentos. Deixe vazio para pacientes sem valor definido.</p>
    ${list.length ? `<div class="table cols-val">
      <div class="tr th cols-val"><span>Paciente</span><span>Convênio</span><span>Valor da sessão</span></div>
      ${list.map((p) => `<div class="tr cols-val" data-pid="${p.id}">
        <span class="ellip t">${esc(p.name)}</span>
        <span class="ellip muted">${esc(adm[p.id]?.insurer || 'Particular')}</span>
        <span><input type="number" step="0.01" min="0" class="pr-val" value="${adm[p.id]?.session_price ?? ''}" placeholder="R$" aria-label="Valor da sessão de ${esc(p.name)}" style="width:130px;margin:0;min-height:0;padding:6px 8px"></span>
      </div>`).join('')}</div>` : '<p class="muted">Nenhum paciente ativo.</p>'}
  </section>`;
  $$('[data-pid]').forEach((row) => {
    $('.pr-val', row).onchange = async (e) => {
      const pid = row.dataset.pid; const cur = adm[pid] || {};
      try {
        await api.savePatientAdmin({ patient_id: pid, session_price: e.target.value === '' ? null : Number(e.target.value),
          insurer: cur.insurer || null, approach: cur.approach || null, guardian: cur.guardian || null });
        adm[pid] = { ...cur, patient_id: pid, session_price: e.target.value === '' ? null : Number(e.target.value) };
        toast('Valor salvo.');
      } catch (err) { toast(err.message, 'err'); }
    };
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
      <p class="muted">Sessões por semana × valor da sessão, com os dados de pagamento no rodapé. Válido por 15 dias.</p>
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

  const paidFor = (pid) => aps.filter((a) => a.patient_id === pid && a.status === 'realizado' && a.payment_status === 'pago');
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
  $('#rc-pdf').onclick = () => { const a = rcArgs(); if (needRc(a)) exportReciboPdf(a); };
  $('#rc-doc').onclick = () => { const a = rcArgs(); if (needRc(a)) exportReciboWord(a); };
}

/* ---------- Dados de pagamento (aparecem no orçamento e no recibo) ---------- */
async function paymentTab(pane) {
  const p = state.profile || {};
  const pay = (p.branding && p.branding.payment) || {};
  const f = (k, label, ph = '') => `<label class="field">${label}<input name="${k}" value="${esc(pay[k] || '')}" placeholder="${esc(ph)}"></label>`;
  pane.innerHTML = `
    <form id="pay-f" class="panel"><h2>Dados de pagamento</h2>
      <p class="muted">Aparecem no rodapé do orçamento e no recibo, para o paciente pagar e enviar o comprovante.</p>
      <div class="grid2">
        ${f('doc', 'CNPJ ou CPF', 'Ex.: 00.000.000/0001-00')}
        ${f('bank', 'Banco', 'Ex.: Itaú')}
        ${f('agency', 'Agência')}
        ${f('account', 'Conta')}
        ${f('holder', 'Titular da conta')}
        ${f('pix', 'Chave PIX', 'CNPJ, CPF, e-mail ou telefone')}
      </div>
      <label class="field">Observação<textarea name="note" rows="2" placeholder="Ex.: enviar o comprovante pelo WhatsApp (83) 98778-2014">${esc(pay.note || '')}</textarea></label>
      <button class="btn" type="submit">Salvar dados de pagamento</button>
    </form>`;
  $('#pay-f').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payment = Object.fromEntries(['doc', 'bank', 'agency', 'account', 'holder', 'pix', 'note'].map((k) => [k, String(fd.get(k) || '').trim()]));
    return busy(e.submitter || $('[type=submit]', e.target), 'Salvando…', async () => {
      const branding = { ...(p.branding || {}), payment };
      const row = await api.updateProfile(p.id, { branding });
      state.profile = { ...state.profile, branding: row.branding };
      toast('Dados de pagamento salvos.');
    });
  };
}
