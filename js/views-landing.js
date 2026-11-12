// Tela principal para quem não está logado: apresentação da Potira, com Entrar no topo.
// As entradas ficam separadas: profissional (#/entrar e #/criar-conta) e paciente (#/paciente).
import { $, icon } from './ui.js';

const RECURSOS = [
  ['file', 'Registro clínico', 'Anamnese, evolução, relatório por período e documento livre, com modelos por área ou a partir do seu próprio Word.'],
  ['check', 'Plano terapêutico', 'Metas por paciente, marcadas em cada evolução, e escalas criadas por você com gráfico da pontuação.'],
  ['calendar', 'Agenda', 'Sessões que se repetem, lembretes pelo WhatsApp com confirmação de presença, bloqueios e lista de espera.'],
  ['wallet', 'Cobrança', 'Por sessão, mensalidade ou pacote. Mensagem com PIX pronto, cobrança agendada e pagamento conferido pelo comprovante.'],
  ['sliders', 'Entradas e gastos', 'Controle dos gastos do consultório, resumo dos últimos meses e planilha para o contador.'],
  ['users', 'Entrega ao paciente', 'Portal do paciente e links com validade para anamnese, relatório e orientações para casa.'],
];
const PASSOS = [
  ['Cadastre', 'O paciente, o consentimento e, se quiser, a anamnese por link para a família responder.'],
  ['Agende', 'As sessões da semana. O lembrete vai com o link para confirmar ou remarcar.'],
  ['Registre', 'A evolução da sessão, digitando ou gravando. Marque as metas trabalhadas.'],
  ['Entregue e cobre', 'Relatório revisado em PDF ou por link, e a cobrança com o PIX já calculado.'],
];
const FAQ = [
  ['Quanto custa?', 'A Potira está em fase de testes com profissionais convidados e, nesta fase, não tem custo.'],
  ['Preciso usar inteligência artificial?', 'Não. Tudo funciona sem IA. Se você conectar a sua, ela transcreve o áudio e escreve um rascunho; quem revisa e assina é sempre você.'],
  ['Meus dados e os dos pacientes ficam seguros?', 'Cada profissional vê só os próprios pacientes. O áudio das sessões nunca é guardado. O paciente só vê o que foi revisado e liberado. O consentimento é registrado por paciente, conforme a LGPD.'],
  ['Funciona no celular?', 'Sim. A plataforma abre no navegador do celular, do tablet e do computador, sem instalar nada.'],
  ['Sou paciente. Como vejo meus relatórios?', 'Pelo Portal do paciente. No primeiro acesso, use o mesmo e-mail que você informou ao(à) profissional e crie uma senha.'],
];

export function renderLanding() {
  document.title = 'Potira · registro clínico, agenda e cobrança para profissionais de saúde';
  const ic = (n) => { try { return icon(n); } catch { return icon('file'); } };
  $('#app').innerHTML = `
  <div class="land">
    <header class="land-top"><div class="land-wrap land-nav">
      <a class="land-marca" href="#/" aria-label="Potira, início"><span class="mark">${icon('flower')}</span><b>Potira</b></a>
      <nav class="land-links" aria-label="Seções">
        <button type="button" data-ir="recursos">Recursos</button>
        <button type="button" data-ir="como">Como funciona</button>
        <button type="button" data-ir="quem">Para quem</button>
        <button type="button" data-ir="duvidas">Dúvidas</button>
      </nav>
      <div class="land-acoes">
        <a class="btn quiet sm land-pac" href="#/paciente">${icon('users')}Portal do paciente</a>
        <a class="btn sm" href="#/entrar">Entrar</a>
      </div>
    </div></header>

    <main class="land-wrap">
      <section class="land-hero">
        <span class="land-selo">Em fase de testes · sem custo</span>
        <h1>O consultório inteiro em um só lugar.</h1>
        <p>Anamnese, evolução de cada sessão, relatórios, agenda e cobrança. Para profissionais de saúde que querem escrever menos, organizar melhor e entregar documentos com a própria marca.</p>
        <div class="land-cta"><a class="btn bloom lg" href="#/criar-conta">Criar minha conta</a><a class="btn lg land-ghost" href="#/entrar">Já tenho conta</a></div>
      </section>

      <section id="recursos"><h2>O que a Potira faz</h2>
        <p class="land-sub">Cada parte funciona sozinha, e todas conversam entre si: registrar a sessão já prepara a cobrança.</p>
        <div class="land-grade">${RECURSOS.map(([i, t, d]) => `<article class="land-card"><span class="land-ic">${ic(i)}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>
      </section>

      <section class="land-faixa">
        <div><h2>A inteligência artificial é opcional</h2><p class="land-sub">Tudo funciona sem IA. Se você conectar a sua, ela transcreve o áudio e escreve um rascunho. Quem revisa e assina é sempre você.</p></div>
        <ul>
          <li>${icon('shield')}O áudio da sessão nunca é guardado.</li>
          <li>${icon('shield')}Cada profissional vê só os próprios pacientes.</li>
          <li>${icon('check')}O paciente só vê o que foi revisado e liberado.</li>
          <li>${icon('check')}Consentimento registrado por paciente, conforme a LGPD.</li>
          <li>${icon('check')}Documentos com a sua logo, as suas cores e o seu timbre.</li>
        </ul>
      </section>

      <section id="como"><h2>Como funciona no dia a dia</h2>
        <p class="land-sub">Do cadastro à cobrança, em quatro passos.</p>
        <div class="land-passos">${PASSOS.map(([t, d]) => `<div><b>${t}</b>${d}</div>`).join('')}</div>
      </section>

      <section id="quem"><h2>Para quem é</h2>
        <div class="land-grade tres">
          <article class="land-card"><span class="land-ic">${icon('edit')}</span><h3>Profissional autônomo</h3><p>Terapia ocupacional, psicologia, fonoaudiologia, fisioterapia, nutrição e outras áreas. Registro clínico, agenda e financeiro do seu consultório.</p><a class="btn quiet sm" href="#/criar-conta">Criar conta</a></article>
          <article class="land-card"><span class="land-ic">${icon('users')}</span><h3>Paciente e família</h3><p>Relatórios liberados, próximas sessões, confirmação de presença e recibos, em uma página só sua.</p><a class="btn quiet sm" href="#/paciente">Abrir o Portal do paciente</a></article>
          <article class="land-card"><span class="land-ic">${ic('clipboard')}</span><h3>Clínicas <small class="land-breve">em breve</small></h3><p>Um gestor, vários profissionais e secretaria, cada um vendo só o que lhe cabe. A administração não acessa registros clínicos.</p></article>
        </div>
      </section>

      <section id="duvidas"><h2>Dúvidas frequentes</h2>
        <div class="land-faq">${FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
      </section>

      <section class="land-fim">
        <h2>Quer testar com os seus pacientes?</h2>
        <p>Crie a sua conta, use o paciente de teste e conte o que precisa melhorar.</p>
        <a class="btn bloom lg" href="#/criar-conta">Começar agora</a>
      </section>
    </main>

    <footer class="land-wrap land-rodape"><span>Potira · relatórios clínicos</span>
      <span><a href="#/entrar">Entrar</a> · <a href="#/paciente">Portal do paciente</a> · <a href="termos.html">Termos de uso</a> · <a href="privacidade.html">Privacidade</a></span></footer>
  </div>`;
  document.querySelectorAll('.land [data-ir]').forEach((b) => (b.onclick = () => {
    const alvo = document.getElementById(b.dataset.ir);
    if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  window.scrollTo(0, 0);
}
