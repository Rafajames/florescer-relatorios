import * as api from './api.js';
import { $, esc, toast, busy, openModal, icon } from './ui.js';
import { SPECIALTIES } from './state.js';

const hero = () => `
  <div class="auth-hero">
    <a class="brand" href="#/"><span class="mark">${icon('flower')}</span><b>Florescer</b></a>
    <div>
      <h1>Menos tempo escrevendo, mais tempo com o paciente.</h1>
      <p style="margin-top:14px">Registre a sessão, revise o esboço e entregue o relatório. Você decide o que o paciente vê.</p>
    </div>
    <ul>
      <li>${icon('shield')}Cada profissional vê só os próprios pacientes</li>
      <li>${icon('mic')}O áudio é descartado; só o texto fica para conferência</li>
      <li>${icon('check')}A IA escreve rascunhos, você revisa e assina</li>
    </ul>
  </div>`;

export function renderSetup() {
  $('#app').innerHTML = `
    <div class="auth-wrap">${hero()}
      <div class="auth-side"><div class="auth-card">
        <h2>Falta conectar o banco de dados</h2>
        <p class="muted" style="margin-top:8px">Este site precisa de um projeto <b>Supabase</b> (gratuito para começar). Siga o passo a passo do <code>README.md</code> e preencha <code>js/config.js</code> com a URL e a chave pública (anon) do projeto.</p>
        <p class="muted small">Quer só testar sem configurar nada? A versão local, com dados só neste navegador, está em <a href="local/">/local/</a>.</p>
      </div></div>
    </div>`;
}

export function renderAuth() {
  let mode = 'login';
  const draw = () => {
    $('#app').innerHTML = `
    <div class="auth-wrap">${hero()}<div class="auth-side"><div class="auth-card">
      <h2 style="margin-bottom:14px">${mode === 'login' ? 'Entrar no Florescer' : 'Criar conta'}</h2>
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
          </div>` : ''}
        <label class="field">E-mail<input type="email" name="email" required autocomplete="email"></label>
        <label class="field">Senha<input type="password" name="password" required minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></label>
        <button class="btn lg" type="submit">${mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
        ${mode === 'login' ? '<button type="button" class="link" id="forgot">Esqueci minha senha</button>' : ''}
        ${mode === 'signup' ? '<p class="muted small">Pacientes: use o mesmo e-mail que seu profissional cadastrou para você. Você verá somente os relatórios que ele liberar.</p>' : ''}
      </form>
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
