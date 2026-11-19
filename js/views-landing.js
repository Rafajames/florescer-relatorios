// Tela principal para quem não está logado: apresentação da Potira (visual da prévia preview/potira-apresentacao.html).
// As entradas ficam separadas: profissional (#/entrar e #/criar-conta) e paciente (#/paciente).
// A prévia do produto usa só dados fictícios.
import { $, icon } from './ui.js';
import { settings } from './state.js';
import { logoPagina, simboloColorido, unico } from './marca.js';
import { MARCA_SVG } from './marca-svg.js';

const BENEFICIOS = [
  ['calendar', 'Rotina em ordem', 'Agenda com sessões que se repetem, lembretes pelo WhatsApp com confirmação de presença, bloqueios e lista de espera.'],
  ['heart', 'Registros bem cuidados', 'Anamnese, evolução de cada sessão, relatório por período e documento livre, com modelos por área ou a partir do seu Word.'],
  ['wallet', 'Cobrança sem esforço', 'Por sessão, mensalidade ou pacote. Mensagem com PIX pronto, cobrança agendada e resumo de entradas e gastos.'],
];
const RECURSOS = [
  ['Pacientes e registros', 'Cadastro, consentimento, metas por paciente e escalas com gráfico da pontuação.'],
  ['Agenda e sessões', 'Semana, mês e lista, com confirmação e pedido de remarcação pelo paciente.'],
  ['Documentos e relatórios', 'PDF ou Word com a sua logo, as suas cores e o seu timbre, ou envio por link.'],
  ['Financeiro', 'Cobranças, pagamentos conferidos, gastos do consultório e planilha para o contador.'],
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
  ['A Potira substitui as decisões do profissional?', 'Não. A plataforma organiza o trabalho; as decisões clínicas e a responsabilidade continuam com você.'],
  ['Meus dados e os dos pacientes ficam seguros?', 'Cada profissional vê só os próprios pacientes. O áudio das sessões nunca é guardado. O paciente só vê o que foi revisado e liberado. O consentimento é registrado por paciente, conforme a LGPD.'],
  ['Funciona no celular?', 'Sim. A plataforma abre no navegador do celular, do tablet e do computador, sem instalar nada.'],
  ['Sou paciente. Como vejo meus relatórios?', 'Pelo Portal do paciente. No primeiro acesso, use o mesmo e-mail que você informou ao(à) profissional e crie uma senha.'],
];

export function renderLanding() {
  document.title = 'Potira · sua rotina de cuidado, mais organizada';
  // contato público: definido pelo administrador (Administração → Convites); o GitHub do criador aparece sempre
  const wa = String(settings.contato_whatsapp || '').replace(/\D/g, ''), mail = String(settings.contato_email || '').trim();
  const GIT = 'https://github.com/Rafajames';
  const ic = icon;
  $('#app').innerHTML = `
  <div class="lp">
    <header class="lp-top"><div class="lp-wrap lp-nav">
      <a class="lp-marca" href="#/" aria-label="Potira, início">${logoPagina()}</a>
      <nav class="lp-links" aria-label="Seções">
        <a href="#/" data-ir="plataforma">A plataforma</a><a href="#/" data-ir="beneficios">Benefícios</a><a href="#/" data-ir="como">Como funciona</a><a href="#/" data-ir="publico">Para quem</a><a href="#/" data-ir="duvidas">Dúvidas</a>
      </nav>
      <div class="lp-acoes"><a class="lp-pac" href="#/paciente">Portal do paciente</a><a class="lp-btn out" href="#/entrar">Entrar</a><a class="lp-btn pri" href="#/criar-conta">Criar conta</a></div>
    </div></header>

    <main>
      <section class="lp-hero"><div class="lp-wrap lp-hero-grid">
        <div>
          <span class="lp-tag">Em fase de testes · sem custo</span>
          <h1>Sua rotina de cuidado, <em>mais organizada.</em></h1>
          <p>Registros clínicos, agenda, documentos e financeiro em um só lugar, para você ter mais clareza na rotina e mais tempo para o que importa.</p>
          <div class="lp-cta"><a class="lp-btn pri" href="#/criar-conta">Criar minha conta ${ic('right')}</a><a class="lp-btn out" href="#/" data-ir="plataforma">Conhecer a Potira</a></div>
          <div class="lp-nota">${ic('shield')}Para profissionais de saúde. Pacientes entram pelo <a href="#/paciente" style="text-decoration:underline">Portal do paciente</a>.</div>
        </div>
        <div class="lp-mock" aria-hidden="true">
          <div class="lp-mock-top"><span><i></i><i></i><i></i></span><span>Prévia com dados fictícios</span></div>
          <div class="lp-mock-body">
            <aside class="lp-side"><span class="lp-side-logo">${unico(MARCA_SVG.logoMenu)}</span>
              ${[['home', 'Início'], ['users', 'Pacientes'], ['calendar', 'Agenda'], ['clipboard', 'Atendimentos'], ['file', 'Documentos'], ['wallet', 'Financeiro'], ['chart', 'Relatórios']].map(([i, t], n) => `<span class="${n ? '' : 'on'}">${ic(i)}${t}</span>`).join('')}
            </aside>
            <div class="lp-dash">
              <b class="ola">Olá, Ana!</b><small class="sub">Que bom ter você por aqui hoje.</small>
              <div class="lp-stats">
                <div class="lp-stat"><i class="lp-i-r">${ic('users')}</i><span><b>28</b><small>Pacientes ativos</small></span></div>
                <div class="lp-stat"><i class="lp-i-t">${ic('calendar')}</i><span><b>64</b><small>Sessões no mês</small></span></div>
                <div class="lp-stat"><i class="lp-i-g">${ic('wallet')}</i><span><b>R$ 3.240</b><small>Receitas</small></span></div>
              </div>
              <div class="lp-graf"><small>Evolução financeira</small>
                <svg viewBox="0 0 300 76" preserveAspectRatio="none"><defs><linearGradient id="lpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#087D91" stop-opacity=".25"/><stop offset="1" stop-color="#087D91" stop-opacity="0"/></linearGradient></defs>
                  <path class="ar" d="M0 52 C30 40 50 38 75 40 S120 30 150 28 S200 36 225 24 S270 14 300 12 L300 76 L0 76Z"/>
                  <path class="r" d="M0 52 C30 40 50 38 75 40 S120 30 150 28 S200 36 225 24 S270 14 300 12"/>
                  <path class="d" d="M0 66 C30 62 50 64 75 61 S120 60 150 58 S200 62 225 57 S270 55 300 52"/></svg></div>
              <div class="lp-ag"><div><em>09:00</em>Pedro L.<u>Confirmou</u></div><div><em>10:30</em>Marina S.<u>Confirmou</u></div><div><em>14:00</em>João V.<u>Confirmou</u></div></div>
            </div>
          </div>
        </div>
      </div></section>

      <section id="beneficios"><div class="lp-wrap">
        <div class="lp-head"><span class="lp-kicker">Uma rotina mais leve</span><h2>Organização que acompanha seu jeito de cuidar.</h2><p>Cada parte funciona sozinha, e todas conversam entre si: registrar a sessão já prepara a cobrança.</p></div>
        <div class="lp-cards">${BENEFICIOS.map(([i, t, d]) => `<article class="lp-card"><span class="lp-ic">${ic(i)}</span><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>
      </div></section>

      <section class="lp-produto" id="plataforma"><div class="lp-wrap lp-produto-grid">
        <div class="lp-copy"><span class="lp-kicker">A plataforma</span><h2>O essencial do seu trabalho, conectado.</h2>
          <p>Pacientes, agenda, documentos e financeiro em um ambiente integrado e simples de acompanhar, no computador ou no celular.</p>
          <div class="lp-feats">${RECURSOS.map(([t, d]) => `<div class="lp-feat"><span class="lp-check">${ic('check')}</span><div><b>${t}</b><small>${d}</small></div></div>`).join('')}</div>
        </div>
        <div class="lp-tela" aria-hidden="true"><div class="lp-tela-top"><i></i><i></i><i></i></div><div class="lp-tela-tit">Seu espaço de trabalho</div>
          <div class="lp-tela-grid">${[['users', 'lp-i-r', 'Pacientes', 'Cadastro e acompanhamento', 72], ['calendar', 'lp-i-t', 'Agenda', 'Sessões e lembretes', 58], ['file', 'lp-i-r', 'Documentos', 'Relatórios com seu timbre', 84], ['wallet', 'lp-i-g', 'Financeiro', 'Cobranças e PIX', 66]].map(([i, c, t, s, w], n) => `<div class="lp-tc"><i class="${c}">${ic(i)}</i><b>${t}</b><small>${s}</small><div class="mini"><span style="width:${w}%;animation-delay:${n * 0.15}s"></span></div></div>`).join('')}</div>
        </div>
      </div></section>

      <section id="como"><div class="lp-wrap">
        <div class="lp-head"><span class="lp-kicker">Como funciona</span><h2>Do cadastro à cobrança, em quatro passos.</h2><p>Comece pelo essencial e use os outros recursos quando precisar.</p></div>
        <div class="lp-passos">${PASSOS.map(([t, d], i) => `<article class="lp-passo"><strong>0${i + 1}</strong><h3>${t}</h3><p>${d}</p></article>`).join('')}</div>
      </div></section>

      <section class="lp-confia"><div class="lp-wrap lp-confia-grid">
        <div class="lp-copy"><span class="lp-kicker">Tecnologia com responsabilidade</span><h2>A tecnologia apoia. Você continua no controle.</h2><p>A inteligência artificial é opcional. Se você conectar a sua, ela transcreve o áudio e escreve um rascunho; quem revisa e assina é sempre você.</p></div>
        <div class="lp-caixa"><h3>Cuidado com os dados de quem você atende</h3><ul>
          <li>${ic('shield')}O áudio da sessão nunca é guardado.</li>
          <li>${ic('shield')}Cada profissional vê só os próprios pacientes.</li>
          <li>${ic('check')}O paciente só vê o que foi revisado e liberado.</li>
          <li>${ic('check')}Consentimento registrado por paciente, conforme a LGPD.</li>
        </ul></div>
      </div></section>

      <section id="publico" class="lp-publico"><div class="lp-wrap">
        <div class="lp-head"><span class="lp-kicker">Feita para sua realidade</span><h2>Para quem transforma cuidado em trabalho todos os dias.</h2></div>
        <div class="lp-cards">
          <article class="lp-card"><span class="lp-ic">${ic('edit')}</span><h3>Profissionais autônomos</h3><p>Terapia ocupacional, psicologia, fonoaudiologia, fisioterapia, nutrição e outras áreas.</p><a class="lp-btn out" href="#/criar-conta">Criar conta</a></article>
          <article class="lp-card"><span class="lp-ic">${ic('clipboard')}</span><h3>Clínicas <span class="lp-breve">em breve</span></h3><p>Um gestor, vários profissionais e secretaria, cada um vendo só o que lhe cabe.</p></article>
          <article class="lp-card"><span class="lp-ic">${ic('heart')}</span><h3>Pacientes e famílias</h3><p>Relatórios liberados, próximas sessões, confirmação de presença e recibos, em uma página só sua.</p><a class="lp-btn out" href="#/paciente">Abrir o Portal do paciente</a></article>
        </div>
      </div></section>

      <section id="nome"><div class="lp-wrap"><div class="lp-historia">
        <div class="lp-flor">${simboloColorido()}</div>
        <div><span class="lp-kicker">A essência Potira</span><h2>Por que Potira?</h2>
          <p><b>Potira</b> é uma palavra de origem tupi que quer dizer <b>flor</b>. A plataforma nasceu como <i>Florescer Relatórios</i>; ao ganhar um nome próprio, a ideia de florescer ficou: uma flor cresce aos poucos, com cuidado e constância, como o paciente ao longo das sessões.</p>
          <p>Feita no Brasil, em português: do vocabulário (sessão, evolução, anamnese) ao PIX e à LGPD.</p></div>
      </div></div></section>

      <section id="duvidas"><div class="lp-wrap">
        <div class="lp-head"><span class="lp-kicker">Dúvidas frequentes</span><h2>O que você gostaria de saber?</h2></div>
        <div class="lp-faq">${FAQ.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
      </div></section>

      <section style="padding-top:0"><div class="lp-wrap"><div class="lp-final">
        <h2>Mais organização para sua rotina de cuidado.</h2>
        <p>Crie a sua conta, use o paciente de teste e conte o que precisa melhorar.</p>
        <div class="lp-cta"><a class="lp-btn cla" href="#/criar-conta">Começar agora ${ic('right')}</a><a class="lp-btn out" href="#/entrar">Já tenho conta</a></div>
      </div></div></section>

      <section id="contato" style="padding-top:0"><div class="lp-wrap"><div class="lp-contato">
        <div><span class="lp-kicker">Contato</span><h2>Fale com a gente</h2><p>A Potira é criada por <b>James</b> (Jamerson Rafael). Dúvidas, sugestões ou problemas? Fale por aqui.</p></div>
        <div class="lp-cta"><a class="lp-btn out" target="_blank" rel="noopener" href="${GIT}">GitHub · Rafajames</a>${wa ? `<a class="lp-btn out" target="_blank" rel="noopener" href="https://wa.me/${wa}">WhatsApp</a>` : ''}${mail ? `<a class="lp-btn out" href="mailto:${mail}">E-mail</a>` : ''}</div>
      </div></div></section>
    </main>

    <footer class="lp-wrap lp-rodape">
      <a class="lp-marca" href="#/" aria-label="Potira">${logoPagina()}</a>
      <span>© ${new Date().getFullYear()} Potira · em fase de testes</span>
      <nav aria-label="Rodapé"><a href="#/entrar">Entrar</a><a href="#/paciente">Portal do paciente</a><a href="termos.html">Termos de uso</a><a href="privacidade.html">Privacidade</a></nav>
    </footer>
    <a class="lp-flutuante" href="#/" data-ir="contato">${ic('heart')}Contato</a>
  </div>`;
  document.querySelectorAll('.lp [data-ir]').forEach((b) => (b.onclick = (e) => {
    e.preventDefault();
    const alvo = document.getElementById(b.dataset.ir);
    if (alvo) alvo.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }));
  // cada bloco aparece suavemente ao entrar na tela (nada some para quem pede menos movimento)
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const blocos = document.querySelectorAll('.lp-card, .lp-passo, .lp-feat, .lp-tela, .lp-caixa, .lp-historia, .lp-faq details, .lp-final, .lp-contato, .lp-head');
    const obs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visto'); obs.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    blocos.forEach((b, i) => { b.classList.add('revela'); b.style.transitionDelay = `${(i % 3) * 70}ms`; obs.observe(b); });
  }
  window.scrollTo(0, 0);
}
