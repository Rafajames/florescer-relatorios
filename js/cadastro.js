// Cadastro completo do paciente: formulário (identificação, contato, endereço, responsáveis,
// administrativo), máscaras, validação de CPF, busca de CEP e o quadro "Cadastro" da ficha.
import { esc, fmtDate } from './ui.js';
import { cpfValido } from './cobranca.js';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
const MAX_RESP = 3;

export const soDigitos = (v) => String(v || '').replace(/\D/g, '');
export const fmtCpf = (v) => { const d = soDigitos(v); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : (v || ''); };
export const fmtCep = (v) => { const d = soDigitos(v); return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : (v || ''); };
/** CPF só com os 3 dígitos do meio visíveis, para listas. */
export const cpfMascarado = (v) => { const d = soDigitos(v); return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : ''; };

const mascara = {
  cpf: (v) => { const d = soDigitos(v).slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4'); },
  cep: (v) => { const d = soDigitos(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; },
  tel: (v) => {
    const d = soDigitos(v).slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  },
};

const campo = (rotulo, name, valor, extra = '') => `<label class="field">${rotulo}<input name="${name}" value="${esc(valor ?? '')}" ${extra}></label>`;

function respBloco(r = {}, i = 0) {
  return `<div class="cad-resp" data-resp>
    <div class="cad-resp-topo"><b>Responsável ${i + 1}</b><button type="button" class="btn sm quiet" data-resp-del>Remover</button></div>
    <div class="grid2">
      ${campo('Nome', 'r_nome', r.nome)}
      ${campo('Parentesco / vínculo', 'r_parentesco', r.parentesco, 'placeholder="Mãe, pai, filho(a), cuidador…"')}
      ${campo('CPF', 'r_cpf', fmtCpf(r.cpf), 'inputmode="numeric" data-mask="cpf" placeholder="000.000.000-00"')}
      ${campo('Telefone / WhatsApp', 'r_telefone', r.telefone, 'inputmode="tel" data-mask="tel"')}
    </div>
    ${campo('E-mail', 'r_email', r.email, 'type="email"')}
    <div class="row cad-checks">
      <label class="check"><input type="checkbox" name="r_legal" ${r.legal ? 'checked' : ''}> Responsável legal</label>
      <label class="check"><input type="checkbox" name="r_financeiro" ${r.financeiro ? 'checked' : ''}> Responsável financeiro (recibos e nota fiscal)</label>
    </div>
  </div>`;
}

/** HTML do formulário completo. `guardianAntigo` = texto do campo antigo de responsável (patient_admin.guardian). */
export function formCadastro(p = {}, guardianAntigo = '') {
  const resps = Array.isArray(p.guardians) && p.guardians.length ? p.guardians : (guardianAntigo ? [{ nome: guardianAntigo }] : [{}]);
  const sel = (v) => (p.sex === v ? 'selected' : '');
  return `
  <h4 class="cad-sec">Identificação</h4>
  <label class="field">Nome completo ou identificação<input name="name" required value="${esc(p.name || '')}"><small>Pode usar iniciais, se preferir.</small></label>
  <div class="grid2">
    ${campo('Nome social', 'social_name', p.social_name)}
    ${campo('CPF', 'cpf', fmtCpf(p.cpf), 'inputmode="numeric" data-mask="cpf" placeholder="000.000.000-00"')}
    <label class="field">Data de nascimento<input type="date" name="birth_date" value="${esc(p.birth_date || '')}"></label>
    <label class="field">Sexo<select name="sex"><option value="">Não informar</option><option value="feminino" ${sel('feminino')}>Feminino</option><option value="masculino" ${sel('masculino')}>Masculino</option><option value="outro" ${sel('outro')}>Outro</option></select></label>
    ${campo('RG', 'rg', p.rg)}
    ${campo('Órgão emissor / UF', 'rg_issuer', p.rg_issuer, 'placeholder="SSP/RR"')}
  </div>

  <h4 class="cad-sec">Contato</h4>
  <label class="field">E-mail do paciente<input type="email" name="email" value="${esc(p.email || '')}"><small>Necessário para o paciente acessar o portal. Confira se está correto.</small></label>
  <div class="grid2">
    ${campo('Telefone', 'phone', p.phone, 'inputmode="tel" data-mask="tel"')}
    ${campo('WhatsApp', 'whatsapp', p.whatsapp, 'inputmode="tel" data-mask="tel" placeholder="Se for diferente do telefone"')}
    ${campo('Telefone alternativo', 'phone_alt', p.phone_alt, 'inputmode="tel" data-mask="tel"')}
  </div>

  <h4 class="cad-sec">Endereço</h4>
  <div class="grid2">
    <label class="field">CEP<input name="cep" value="${esc(fmtCep(p.cep))}" inputmode="numeric" data-mask="cep" placeholder="00000-000"><small data-cep-msg>Preenche a rua e a cidade sozinho.</small></label>
    ${campo('Rua / logradouro', 'street', p.street)}
    ${campo('Número', 'street_number', p.street_number)}
    ${campo('Complemento', 'complement', p.complement)}
    ${campo('Bairro', 'district', p.district)}
    ${campo('Cidade', 'city', p.city)}
    <label class="field">UF<select name="uf"><option value=""></option>${UFS.map((u) => `<option ${p.uf === u ? 'selected' : ''}>${u}</option>`).join('')}</select></label>
  </div>

  <h4 class="cad-sec">Responsáveis</h4>
  <p class="muted small">Para crianças, adolescentes ou pacientes que precisam de cuidador. Marque quem é o responsável financeiro: é para ele que saem recibos e, no futuro, a nota fiscal.</p>
  <div data-resps>${resps.map(respBloco).join('')}</div>
  <button type="button" class="btn sm quiet" data-resp-add>+ Adicionar responsável</button>

  <h4 class="cad-sec">Administrativo</h4>
  <div class="grid2">
    ${campo('Nº da carteirinha do convênio', 'insurance_card', p.insurance_card)}
    <label class="field">Data de entrada<input type="date" name="entry_date" value="${esc(p.entry_date || '')}"></label>
    ${campo('Como chegou / origem', 'origin', p.origin, 'placeholder="Indicação, convênio, escola…"')}
  </div>

  <h4 class="cad-sec">Observações</h4>
  <label class="field">Observações<textarea name="notes" rows="3">${esc(p.notes || '')}</textarea></label>`;
}

/** Liga máscaras, CEP e botões de responsável dentro do formulário. */
export function ligarCadastro(d) {
  d.addEventListener('input', (e) => { const m = e.target.dataset?.mask; if (m) e.target.value = mascara[m](e.target.value); });
  const lista = d.querySelector('[data-resps]');
  const renumerar = () => {
    lista.querySelectorAll('[data-resp]').forEach((b, i) => { b.querySelector('b').textContent = `Responsável ${i + 1}`; });
    d.querySelector('[data-resp-add]').style.display = lista.children.length >= MAX_RESP ? 'none' : '';
  };
  d.querySelector('[data-resp-add]').onclick = () => { lista.insertAdjacentHTML('beforeend', respBloco({}, lista.children.length)); renumerar(); };
  lista.addEventListener('click', (e) => {
    if (!e.target.closest('[data-resp-del]')) return;
    const b = e.target.closest('[data-resp]');
    if (lista.children.length > 1) b.remove(); else b.querySelectorAll('input').forEach((i) => { if (i.type === 'checkbox') i.checked = false; else i.value = ''; });
    renumerar();
  });
  renumerar();
  const cep = d.querySelector('[name=cep]'), msg = d.querySelector('[data-cep-msg]');
  cep.addEventListener('input', async () => {
    const c = soDigitos(cep.value);
    if (c.length !== 8) return;
    msg.textContent = 'Buscando endereço…';
    try {
      const r = await fetch(`https://viacep.com.br/ws/${c}/json/`).then((x) => x.json());
      if (r.erro) { msg.textContent = 'CEP não encontrado. Preencha à mão.'; return; }
      const por = (n, v) => { const el = d.querySelector(`[name=${n}]`); if (v && !el.value) el.value = v; };
      por('street', r.logradouro); por('district', r.bairro); por('city', r.localidade); por('uf', r.uf);
      msg.textContent = 'Endereço preenchido. Confira e coloque o número.';
    } catch { msg.textContent = 'Sem conexão com a busca de CEP. Preencha à mão.'; }
  });
}

/** Lê o formulário. Lança Error com mensagem amigável se algo estiver inválido. */
export function lerCadastro(d) {
  const g = (n) => (d.querySelector(`[name=${n}]`)?.value || '').trim();
  const cpf = soDigitos(g('cpf'));
  if (cpf && !cpfValido(cpf)) throw new Error('O CPF do paciente não é válido. Confira os números.');
  const cep = soDigitos(g('cep'));
  if (cep && cep.length !== 8) throw new Error('O CEP precisa ter 8 números.');
  const guardians = [...d.querySelectorAll('[data-resp]')].map((b, i) => {
    const v = (n) => (b.querySelector(`[name=${n}]`)?.value || '').trim();
    const rc = soDigitos(v('r_cpf'));
    if (rc && !cpfValido(rc)) throw new Error(`O CPF do responsável ${i + 1} não é válido.`);
    return { nome: v('r_nome'), parentesco: v('r_parentesco'), cpf: rc || '', telefone: v('r_telefone'), email: v('r_email'),
      legal: b.querySelector('[name=r_legal]').checked, financeiro: b.querySelector('[name=r_financeiro]').checked };
  }).filter((r) => r.nome || r.cpf || r.telefone || r.email);
  if (guardians.some((r) => !r.nome)) throw new Error('Informe o nome de cada responsável.');
  const ou = (v) => v || null;
  return {
    name: g('name'), social_name: ou(g('social_name')), cpf: ou(cpf), birth_date: ou(g('birth_date')), sex: ou(g('sex')),
    rg: ou(g('rg')), rg_issuer: ou(g('rg_issuer')),
    email: ou(g('email')), phone: ou(g('phone')), whatsapp: ou(g('whatsapp')), phone_alt: ou(g('phone_alt')),
    cep: ou(cep), street: ou(g('street')), street_number: ou(g('street_number')), complement: ou(g('complement')),
    district: ou(g('district')), city: ou(g('city')), uf: ou(g('uf')),
    guardians, insurance_card: ou(g('insurance_card')), entry_date: ou(g('entry_date')), origin: ou(g('origin')),
    notes: ou(g('notes')),
  };
}

export const enderecoTexto = (p) => {
  const l1 = [p.street, p.street_number].filter(Boolean).join(', ') + (p.complement ? ' — ' + p.complement : '');
  const l2 = [p.district, [p.city, p.uf].filter(Boolean).join('/')].filter(Boolean).join(', ');
  return [l1, l2, p.cep ? 'CEP ' + fmtCep(p.cep) : ''].filter(Boolean).join(' · ');
};

/** Quadro "Cadastro" da ficha do paciente. */
export function painelCadastro(p) {
  const linha = (k, v) => (v ? `<div class="cad-linha"><span class="muted small">${k}</span><span>${esc(v)}</span></div>` : '');
  const resps = (p.guardians || []).map((r) => `<div class="cad-r"><b>${esc(r.nome)}</b>${r.parentesco ? ' · ' + esc(r.parentesco) : ''}
      ${[r.legal ? 'legal' : '', r.financeiro ? 'financeiro' : ''].filter(Boolean).map((t) => `<span class="chip">${t}</span>`).join(' ')}
      <div class="muted small">${[r.cpf ? 'CPF ' + fmtCpf(r.cpf) : '', r.telefone, r.email].filter(Boolean).map(esc).join(' · ')}</div></div>`).join('');
  const corpo = linha('Nome social', p.social_name) + linha('CPF', p.cpf ? fmtCpf(p.cpf) : '') +
    linha('RG', [p.rg, p.rg_issuer].filter(Boolean).join(' ')) + linha('Sexo', p.sex) +
    linha('WhatsApp', p.whatsapp) + linha('Telefone alternativo', p.phone_alt) + linha('Endereço', enderecoTexto(p)) +
    linha('Carteirinha', p.insurance_card) + linha('Entrada', p.entry_date ? fmtDate(p.entry_date) : '') + linha('Origem', p.origin);
  const falta = [!p.cpf && 'CPF', !p.cep && !p.street && 'endereço'].filter(Boolean);
  return `<div class="panel" data-aba="resumo">
    <div class="panel-head"><h3>Cadastro</h3><button type="button" class="btn sm quiet" id="cad-edit">Completar</button></div>
    ${corpo || '<p class="muted small">Só os dados básicos foram preenchidos.</p>'}
    ${resps ? `<h4 class="cad-sec" style="margin-top:12px">Responsáveis</h4>${resps}` : ''}
    ${falta.length ? `<p class="muted small" style="margin-top:10px">Falta ${falta.join(' e ')} — necessário para recibo e nota fiscal.</p>` : ''}
  </div>`;
}
