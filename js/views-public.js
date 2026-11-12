// Páginas públicas por link (sem login): anamnese para o paciente responder e
// relatório revisado para ler e baixar. Só aparece a tela do link, nada do painel.
import * as api from './api.js';
import { $, esc, icon, fmtDate } from './ui.js';
import { bodyHtml } from './richtext.js';
import { exportPdf, exportWord } from './export.js';
import { sha256 } from './cobranca.js';

const CONSENT = 'Autorizo que as informações que eu escrever aqui sejam registradas no meu prontuário pelo(a) profissional, para acompanhamento do meu atendimento, conforme a LGPD (Lei 13.709/2018). Posso revogar esta autorização a qualquer momento.';

const MSG = {
  link_invalido: 'Este link não está mais disponível. Ele pode ter expirado ou sido cancelado. Peça um novo link ao(à) profissional.',
  ja_respondido: 'Esta anamnese já foi respondida. Obrigado(a)!',
  consentimento_obrigatorio: 'Marque a autorização antes de enviar.',
  resposta_invalida: 'Não consegui registrar a resposta. Tente de novo.',
  relatorio_indisponivel: 'Este relatório não está disponível no momento.',
};
const errorText = (e) => { const m = String(e?.message || e); const k = Object.keys(MSG).find((x) => m.includes(x)); return k ? MSG[k] : 'Não foi possível carregar agora. Tente de novo em instantes.'; };

const card = (title, html) => `<section class="panel"><h1>${esc(title)}</h1>${html}</section>`;
const erro = (msg) => card('Link indisponível', `<p>${esc(msg)}</p>`);

export async function renderPublicLink(token) {
  const app = $('#app');
  app.innerHTML = `<div class="pub"><header class="pub-h">${icon('flower')}<b>Potira</b></header><main class="pub-main" id="pub-main"><p class="muted">Carregando…</p></main></div>`;
  const main = $('#pub-main');
  try {
    const info = await api.getPublicLink(token);
    marca(info);
    if (info.kind === 'anamnese') return anamnese(main, token, info);
    if (info.kind === 'confirmacao') return confirmacao(main, token, info);
    if (info.kind === 'orientacao') return orientacao(main, info);
    if (info.kind === 'pesquisa') return pesquisa(main, token, info);
    if (info.needs_password) return senha(main, token);
    return relatorio(main, info);
  } catch (e) {
    main.innerHTML = erro(errorText(e));
  }
}

/** Topo com a marca de quem enviou o link (logo e nome); sem marca, fica a Potira. */
function marca(info) {
  const b = info.branding || {}, h = $('.pub-h');
  const nome = b.org_name || info.professional_name;
  if (!h || !nome) return;
  h.innerHTML = `${b.logo ? `<img src="${esc(b.logo)}" alt="" style="height:28px;max-width:120px;object-fit:contain">` : icon('flower')}<b>${esc(nome)}</b>`;
  if (/^#[0-9a-f]{6}$/i.test(b.color || '')) h.style.color = b.color;
}

/* ---------- anamnese ---------- */
function campo(s, i) {
  const label = `<span class="pub-q">${esc(s.title)}</span>`;
  const hint = s.hint ? `<small class="muted">${esc(s.hint)}</small>` : '';
  let input;
  if (s.type === 'curto') input = `<input name="a${i}" value="${esc(s.value || '')}" aria-label="${esc(s.title)}">`;
  else if (s.type === 'data') input = `<input type="date" name="a${i}" aria-label="${esc(s.title)}">`;
  else if (s.type === 'marcar') input = `<select name="a${i}" aria-label="${esc(s.title)}"><option value="">—</option><option>Sim</option><option>Não</option><option>Não sei</option></select>`;
  else if (s.type === 'escolha') input = `<select name="a${i}" aria-label="${esc(s.title)}"><option value="">—</option>${(s.options || []).map((o) => `<option>${esc(o)}</option>`).join('')}</select>`;
  else input = `<textarea name="a${i}" rows="${s.type === 'longo' ? 4 : 2}" aria-label="${esc(s.title)}"></textarea>`;
  return `<label class="field pub-f">${label}${hint}${input}</label>`;
}

function anamnese(main, token, info) {
  if (info.responded) { main.innerHTML = card('Obrigado!', `<p>Sua anamnese já foi enviada para ${esc(info.professional_name)}.</p>`); return; }
  main.innerHTML = `<section class="panel">
    <h1>${esc(info.title)}</h1>
    <p class="muted">Formulário de <b>${esc(info.patient_name)}</b>, enviado por ${esc(info.professional_name)}${info.specialty ? ' (' + esc(info.specialty) + ')' : ''}. Responda com as suas palavras; se for responsável, responda pelo(a) paciente. Pode deixar em branco o que não souber. Este link vale até ${esc(fmtDate(info.expires_at))}.</p>
    <form id="pf">
      ${info.sections.map((s, i) => campo(s, i)).join('')}
      <label class="check pub-cons"><input type="checkbox" id="pf-cons"> <span>${esc(CONSENT)}</span></label>
      <div class="row end"><button class="btn" type="submit">Enviar respostas</button></div>
      <p id="pf-err" class="small" role="alert"></p>
    </form></section>`;

  $('#pf').onsubmit = async (e) => {
    e.preventDefault();
    if (!$('#pf-cons').checked) { $('#pf-err').textContent = errorText(new Error('consentimento_obrigatorio')); return; }
    const answers = {};
    info.sections.forEach((s, i) => {
      let v = (e.target.elements[`a${i}`]?.value || '').trim();
      if (s.type === 'data' && v) v = fmtDate(v);
      answers[i] = v;
    });
    const btn = $('[type=submit]', e.target); btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      await api.submitPublicAnamnese(token, answers, CONSENT);
      main.innerHTML = card('Obrigado!', `<p>Suas respostas foram enviadas para ${esc(info.professional_name)}. Não precisa fazer mais nada.</p>`);
    } catch (err) {
      $('#pf-err').textContent = errorText(err); btn.disabled = false; btn.textContent = 'Enviar respostas';
    }
  };
}

/* ---------- confirmação de presença ---------- */
function confirmacao(main, token, info) {
  const quando = `${new Date(info.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}${info.time ? ' às ' + String(info.time).slice(0, 5) : ''}`;
  const feito = (r) => card(r === 'confirmado' ? 'Presença confirmada' : 'Pedido enviado',
    r === 'confirmado' ? `<p>Obrigado! ${esc(info.professional_name)} espera por você na ${esc(quando)}.</p>`
      : `<p>${esc(info.professional_name)} recebeu o seu pedido para remarcar a sessão de ${esc(quando)} e vai entrar em contato.</p>`);
  if (info.status !== 'agendado') { main.innerHTML = card('Sessão', '<p>Esta sessão não está mais agendada. Fale com o(a) profissional se tiver dúvida.</p>'); return; }
  main.innerHTML = `<section class="panel"><h1>Sua sessão</h1>
    <p>${esc(info.patient_name)}, sua sessão com <b>${esc(info.professional_name)}</b>${info.specialty ? ' (' + esc(info.specialty) + ')' : ''} é <b>${esc(quando)}</b>.</p>
    ${info.confirm_status ? `<p class="muted">Sua última resposta: ${info.confirm_status === 'confirmado' ? 'presença confirmada' : 'pediu para remarcar'}. Você pode mudar.</p>` : ''}
    <div class="row"><button class="btn" data-r="confirmado">Confirmo a presença</button><button class="btn quiet" data-r="remarcar">Preciso remarcar</button></div>
    <p id="cf-err" class="small" role="alert"></p></section>`;
  main.querySelectorAll('[data-r]').forEach((b) => (b.onclick = async () => {
    main.querySelectorAll('[data-r]').forEach((x) => (x.disabled = true));
    try { await api.publicConfirm(token, b.dataset.r); main.innerHTML = feito(b.dataset.r); }
    catch (err) { $('#cf-err').textContent = errorText(err); main.querySelectorAll('[data-r]').forEach((x) => (x.disabled = false)); }
  }));
}

/* ---------- orientações para casa ---------- */
function orientacao(main, info) {
  main.innerHTML = `<section class="panel"><h1>${esc(info.title)}</h1>
    <p class="muted">Para ${esc(info.patient_name)} · enviado por ${esc(info.professional_name)} em ${esc(fmtDate(info.created_at))}</p>
    <div class="pre" style="white-space:pre-wrap;line-height:1.6">${esc(info.content)}</div>
    <div class="row" style="margin-top:14px"><button class="btn quiet" id="or-print">Imprimir ou salvar em PDF</button></div></section>`;
  $('#or-print').onclick = () => window.print();
}

/* ---------- pesquisa de satisfação ---------- */
function pesquisa(main, token, info) {
  let nota = null;
  main.innerHTML = `<section class="panel"><h1>Como está sendo o atendimento?</h1>
    <p class="muted">Pesquisa de ${esc(info.professional_name)}. É anônima: não pedimos seu nome.</p>
    <p><b>De 0 a 10, que nota você dá ao atendimento?</b></p>
    <div class="pub-notas" role="group" aria-label="Nota de 0 a 10">${[...Array(11)].map((_, i) => `<button type="button" class="btn quiet" data-n="${i}">${i}</button>`).join('')}</div>
    <label class="field pub-f"><span class="pub-q">Quer contar o motivo ou deixar uma sugestão? (opcional)</span><textarea id="pq-c" rows="4" maxlength="2000"></textarea></label>
    <div class="row end"><button class="btn" id="pq-send">Enviar</button></div>
    <p id="pq-err" class="small" role="alert"></p></section>`;
  main.querySelectorAll('[data-n]').forEach((b) => (b.onclick = () => {
    nota = Number(b.dataset.n);
    main.querySelectorAll('[data-n]').forEach((x) => { x.classList.toggle('quiet', x !== b); x.setAttribute('aria-pressed', x === b); });
  }));
  $('#pq-send').onclick = async (e) => {
    if (nota === null) { $('#pq-err').textContent = 'Escolha uma nota de 0 a 10.'; return; }
    e.currentTarget.disabled = true;
    try { await api.publicSubmitSurvey(token, nota, $('#pq-c').value); main.innerHTML = card('Obrigado!', '<p>Sua resposta foi enviada. Ela ajuda a melhorar o atendimento.</p>'); }
    catch (err) { $('#pq-err').textContent = errorText(err); e.currentTarget.disabled = false; }
  };
}

/* ---------- relatório ---------- */
function senha(main, token) {
  main.innerHTML = `<section class="panel"><h1>Relatório protegido</h1>
    <p class="muted">Digite a senha que o(a) profissional enviou junto com o link.</p>
    <form id="sf"><label class="field">Senha<input type="password" id="sp" autocomplete="off" required></label>
    <div class="row end"><button class="btn" type="submit">Abrir relatório</button></div>
    <p id="sf-err" class="small" role="alert"></p></form></section>`;
  $('#sf').onsubmit = async (e) => {
    e.preventDefault();
    const hash = await sha256(`${token}:${$('#sp').value}`);
    try {
      const full = await api.getPublicLink(token, hash);
      marca(full);
      if (full.needs_password) { $('#sf-err').textContent = 'Senha incorreta. Confira com o(a) profissional.'; return; }
      relatorio(main, full);
    } catch (err) { main.innerHTML = erro(errorText(err)); }
  };
}

function relatorio(main, info) {
  const args = () => ({
    report: { title: info.title, kind: info.report_kind || 'sessao', session_date: info.session_date, period_start: info.period_start, period_end: info.period_end },
    patientName: info.patient_name,
    professional: { full_name: info.professional_name, specialty: info.specialty, council_registry: info.council_registry, branding: info.branding || {} },
    sections: info.sections, layout: info.layout || null,
  });
  main.innerHTML = `<section class="panel">
      <h1>${esc(info.title)}</h1>
      <p class="muted">${esc(info.patient_name)} · ${esc(info.professional_name)}${info.specialty ? ' · ' + esc(info.specialty) : ''}</p>
      <div class="row"><button class="btn" id="pdf">Baixar PDF</button><button class="btn quiet" id="doc">Baixar Word</button></div>
    </section>
    ${info.sections.map((s) => `<section class="panel"><h2>${esc(s.title)}</h2><div class="rt">${bodyHtml(s)}</div></section>`).join('')}`;
  $('#pdf').onclick = () => exportPdf(args());
  $('#doc').onclick = () => exportWord(args());
}
