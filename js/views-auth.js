import * as api from './api.js';
import { $, esc, toast, busy, openModal, icon } from './ui.js';
import { SPECIALTIES } from './state.js';
import * as ai from './ai.js';
import { saveKey } from './ai-connect.js';

const logoTile = (b) => (b && b.logo
  ? `<span class="mark has-logo"><img src="${esc(b.logo)}" alt=""></span>`
  : `<span class="mark">${icon('flower')}</span>`);

// brand: marca do profissional (logo, nome, frase); sem marca, aparece o Florescer
const hero = (b) => {
  const own = Boolean(b && (b.logo || b.org_name));
  return `
  <div class="auth-hero">
    <a class="brand" href="#/">${logoTile(b)}<b>${esc(own ? (b.org_name || '') : 'Florescer')}</b></a>
    <div>
      <h1>${own ? esc(b.tagline || 'Acesse sua área.') : 'Menos tempo escrevendo, mais tempo com o paciente.'}</h1>
      ${own ? '' : '<p style="margin-top:14px">Registre a sessão, revise o esboço e entregue o relatório. Você decide o que o paciente vê.</p>'}
    </div>
    ${own ? `<p class="credit">Plataforma Florescer Relatórios</p>` : `<ul>
      <li>${icon('shield')}Cada profissional vê só os próprios pacientes</li>
      <li>${icon('mic')}O áudio é descartado; só o texto fica para conferência</li>
      <li>${icon('check')}A IA é opcional: escreve rascunhos e você revisa e assina</li>
    </ul>`}
  </div>`;
};
// no celular o painel lateral some; a marca aparece no topo do cartão
const mobileBrand = (b) => `<div class="auth-mobile-brand">${logoTile(b)}<b>${esc((b && b.org_name) || 'Florescer')}</b></div>`;

export function renderSetup() {
  $('#app').innerHTML = `
    <div class="auth-wrap">${hero(null)}
      <div class="auth-side"><div class="auth-card">
        <h2>Falta conectar o banco de dados</h2>
        <p class="muted" style="margin-top:8px">Este site precisa de um projeto <b>Supabase</b> (gratuito para começar). Siga o passo a passo do <code>README.md</code> e preencha <code>js/config.js</code> com a URL e a chave pública (anon) do projeto.</p>
        <p class="muted small">Quer só testar sem configurar nada? A versão local, com dados só neste navegador, está em <a href="local/">/local/</a>.</p>
      </div></div>
    </div>`;
}

export function renderAuth(brand = null) {
  let mode = 'login';
  const draw = () => {
    $('#app').innerHTML = `
    <div class="auth-wrap">${hero(brand)}<div class="auth-side"><div class="auth-card">${mobileBrand(brand)}
      <h2 style="margin-bottom:14px">${mode === 'login' ? (brand && brand.org_name ? 'Entrar em ' + esc(brand.org_name) : 'Entrar no Florescer') : 'Criar conta'}</h2>
      <div class="tabs">
        <button class="tab ${mode === 'login' ? 'on' : ''}" data-mode="login">Entrar</button>
        <button class="tab ${mode === 'signup' ? 'on' : ''}" data-mode="signup">Criar conta</button>
      </div>
      <form id="auth-form" class="stack">
        ${mode === 'signup' ? `
          <div class="seg" id="role-seg" style="margin-bottom:14px">
            <label><input type="radio" name="role" value="professional" checked><span>Sou profissional</span></label>
            <label><input type="radio" name="role" value="patient"><span>Sou paciente</span></label>
          </div>
          <label class="field">Nome completo<input name="full_name" required autocomplete="name"></label>
          <div id="pro-fields" class="stack">
            <label class="field">Área de atuação<select name="specialty">${SPECIALTIES.map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>
            <label class="field">Registro no conselho (opcional)<input name="council_registry" placeholder="ex.: CRP 20/12345"></label>
            <details class="signup-ai"><summary>Conectar minha IA agora (opcional)</summary>
              <label class="field">Provedor<select name="ai_provider">${['gemini', 'groq', 'anthropic', 'openai'].map((id) => `<option value="${id}">${esc(ai.PROVIDERS[id].label)}${ai.PROVIDERS[id].free ? ' (gratuito)' : ''}</option>`).join('')}</select></label>
              <label class="field">Chave de acesso<input type="password" name="ai_key" autocomplete="off" placeholder="Cole a chave aqui"></label>
              <p class="muted small">Gemini e Groq têm plano gratuito: <a href="${ai.PROVIDERS.gemini.keyUrl}" target="_blank" rel="noopener">criar chave Gemini</a> e <a href="${ai.PROVIDERS.groq.keyUrl}" target="_blank" rel="noopener">criar chave Groq</a>. A chave fica só neste navegador. Dá para pular e conectar depois.</p>
            </details>
          </div>` : ''}
        <label class="field">E-mail<input type="email" name="email" required autocomplete="email"></label>
        <label class="field">Senha<input type="password" name="password" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></label>
        <button class="btn lg" type="submit">${mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
        ${mode === 'login' ? '<button type="button" class="link" id="forgot">Esqueci minha senha</button>' : ''}
        ${mode === 'signup' ? '<p class="muted small">Pacientes: use o mesmo e-mail que seu profissional cadastrou para você. Você verá somente os relatórios que ele liberar.</p>' : ''}
      </form>
      <p class="auth-credit">Feito com Florescer Relatórios</p>
    </div></div></div>`;

    document.querySelectorAll('.auth-card .tab').forEach((b) => (b.onclick = () => { mode = b.dataset.mode; draw(); }));
    const seg = $('#role-seg');
    if (seg) seg.addEventListener('change', () => {
      $('#pro-fields').style.display = seg.querySelector('input:checked').value === 'patient' ? 'none' : '';
    });
    const forgot = $('#forgot');
    if (forgot) forgot.onclick = async () => {
      const email = $('input[name=email]').value.trim();
      if (!email) return toast('Digite seu e-mail primeiro.', 'err');
      try { await api.resetPassword(email); toast('Enviamos um link para redefinir a senha.'); }
      catch (e) { toast(e.message, 'err'); }
    };

    $('#auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const btn = e.target.querySelector('button[type=submit]');
      await busy(btn, 'Aguarde…', async () => {
        if (mode === 'login') {
          await api.signIn(f.get('email'), f.get('password'));
        } else {
          const role = f.get('role');
          const meta = { role, full_name: f.get('full_name') };
          if (role === 'professional') { meta.specialty = f.get('specialty'); meta.council_registry = f.get('council_registry'); }
          const res = await api.signUp(f.get('email'), f.get('password'), meta);
          const aiKey = (f.get('ai_key') || '').trim();
          if (role === 'professional' && aiKey) {
            try { await ai.testKey(f.get('ai_provider'), aiKey); saveKey(f.get('ai_provider'), aiKey); }
            catch (err) { toast('A chave de IA não foi aceita e não foi salva: ' + err.message + ' Você pode conectar depois.', 'err'); }
          }
          if (!res.session) {
            mode = 'login'; draw();
            toast('Conta criada! Confirme o e-mail que enviamos e depois entre.');
          }
        }
      });
    };
  };
  draw();
}

export function promptNewPassword() {
  return openModal('Defina uma nova senha',
    `<label class="field">Nova senha<input type="password" id="np" minlength="6" required></label>`,
    { okText: 'Salvar senha', onOk: async (d) => { await api.setNewPassword($('#np', d).value); toast('Senha atualizada.'); } });
}
