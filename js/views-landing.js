// Tela principal para quem não está logado: apresentação da Potira, com Entrar no topo.
// As entradas ficam separadas: profissional (#/entrar e #/criar-conta) e paciente (#/paciente).
import { $, icon, esc } from './ui.js';
import { settings } from './state.js';

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
  const ic = icon;
  // contato público: definido pelo administrador (Administração → Convites); sem ele, a seção não aparece
  const wa = String(settings.contato_whatsapp || '').replace(/\D/g, ''), mail = String(settings.contato_email || '').trim();
  const GIT = 'https://github.com/Rafajames'; // contato do criador (James); WhatsApp e e-mail entram quando o administrador preencher
  const contato = true;
  $('#app').innerHTML = `
  <div class="land">
    <header class="land-top"><div class="land-wrap land-nav">
      <a class="land-marca" href="#/" aria-label="Potira, início"><span class="mark">${icon('flower')}</span><b>Potira</b></a>
      <nav class="land-links" aria-label="Seções">
        <button type="button" data-ir="recursos">Recursos</button>
        <button type="button" data-ir="como">Como funciona</button>
        <button type="button" data-ir="quem">Para quem</button>
        <button type="button" data-ir="duvidas">Dúvidas</button>
        <button type="button" data-ir="nome">O nome</button>
        ${contato ? '<button type="button" data-ir="contato">Contato</button>' : ''}
      </nav>
      <div class="land-acoes">
        <a class="btn quiet sm land-pac" href="#/paciente">${icon('users')}Portal do paciente</a>
        <a class="btn sm" href="#/entrar">Entrar</a>
      </div>
    </div></header>

    <main class="land-wrap">
      <section class="land-hero">
        <div class="land-petalas" aria-hidden="true">${'<i></i>'.repeat(7)}</div>
        <span class="land-selo">Em fase de testes · sem custo</span>
        <h1>O consultório inteiro em um só lugar.</h1>
        <p>Anamnese, evolução de cada sessão, relatórios, agenda e cobrança. Para profissionais de saúde que querem escrever menos, organizar melhor e entregar documentos com a própria marca.</p>
        <div class="land-cta"><a class="btn bloom lg" href="#/criar-conta">Criar minha conta</a><a class="btn lg land-ghost" href="#/entrar">Já tenho conta</a></div>
        <div class="land-tela" aria-hidden="true">
          <div class="lt-menu"><i></i><span class="on"></span><span></span><span></span><span></span></div>
          <div class="lt-slides">
            <div class="lt-corpo on" data-m="0">
              <b>Bom dia, Ana</b>
              <div class="lt-cards"><div><small>Sessões de hoje</small><strong>5</strong></div><div><small>A receber</small><strong>R$ 840</strong></div><div><small>Rascunhos</small><strong>2</strong></div></div>
              <div class="lt-linha"><em>09:00</em><span>Pedro L.</span><u class="ok">Confirmou</u></div>
              <div class="lt-linha"><em>10:00</em><span>Marina S.</span><u class="lt-troca"><i>Agendada</i><i>Confirmou</i></u></div>
              <div class="lt-linha"><em>14:00</em><span>João V.</span><u class="bl">Evolução</u></div>
              <div class="lt-aviso">${icon('check')}Tudo salvo</div>
            </div>
            <div class="lt-corpo" data-m="2">
              <b>Agenda da semana</b>
              <div class="lt-pilulas"><u>Dia</u><u>Lista</u><u class="on">Semana</u><u>Mês</u></div>
              <div class="lt-grade">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((d, i) => `<div><small>${d}</small>${[[1, 0], [0, 2], [1, 3], [2, 0], [0, 1]][i].map((t, k) => `<span class="s${t}" style="margin-top:${k ? 6 : [4, 22, 10, 30, 4][i]}px">${['Pedro', 'Marina', 'João', 'Lia', 'Caio', 'Bia', 'Téo', 'Nina', 'Ravi', 'Sol'][i * 2 + k]}</span>`).join('')}</div>`).join('')}<i class="lt-agora"></i></div>
              <div class="lt-linha"><em>Lembrete</em><span>enviado pelo WhatsApp</span><u class="ok">Confirmou</u></div>
            </div>
            <div class="lt-corpo" data-m="3">
              <b>Financeiro · novembro</b>
              <div class="lt-cards"><div><small>Recebido</small><strong>R$ 3.240</strong></div><div><small>A receber</small><strong>R$ 840</strong></div><div><small>Gastos</small><strong>R$ 910</strong></div></div>
              <div class="lt-barras">${[42, 58, 50, 71, 64, 88].map((h, i) => `<span style="--a:${h}%;animation-delay:${i * 0.08}s"><small>${['jun', 'jul', 'ago', 'set', 'out', 'nov'][i]}</small></span>`).join('')}</div>
              <div class="lt-linha"><em>PIX</em><span>Marina S. · 4 sessões</span><u class="lt-troca"><i>Cobrar</i><i>Pago</i></u></div>
            </div>
            <div class="lt-corpo" data-m="1">
              <b>Relatório com o seu timbre</b>
              <div class="lt-doc">
                <div class="lt-doc-top"><i>${icon('flower')}</i><span><strong>Ana Souza</strong><small>Terapia Ocupacional · CREFITO 00000</small></span></div>
                <h6>Evolução · Pedro L.</h6>
                <p class="lt-escreve"><span></span><span></span><span class="c"></span></p>
                <h6>Conduta</h6>
                <p class="lt-escreve d2"><span></span><span class="c"></span></p>
                <div class="lt-doc-pe"><u class="lt-troca"><i>Rascunho</i><i>Revisado</i></u><u class="bl">PDF</u></div>
              </div>
            </div>
            <div class="lt-corpo" data-m="-1">
              <b>Portal do paciente</b>
              <div class="lt-linha"><em>${icon('calendar')}</em><span>Próxima sessão · sex 14:00</span><u class="lt-troca"><i>Confirmar</i><i>Confirmado</i></u></div>
              <div class="lt-linha"><em>${icon('file')}</em><span>Relatório de acompanhamento</span><u class="ok">Liberado</u></div>
              <div class="lt-linha"><em>${icon('file')}</em><span>Orientações para casa</span><u>Abrir</u></div>
              <div class="lt-linha"><em>${icon('wallet')}</em><span>Recibo nº 0007 · R$ 480</span><u class="bl">PDF</u></div>
            </div>
          </div>
          <div class="lt-pontos"><i class="on"></i><i></i><i></i><i></i><i></i></div>
        </div>
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

      <section id="nome" class="land-nome">
        <div class="land-nome-flor">${icon('flower')}</div>
        <div>
          <span class="land-selo escuro">Sobre o nome</span>
          <h2>Por que Potira?</h2>
          <p><b>Potira</b> é uma palavra de origem tupi que quer dizer <b>flor</b>. Também é usada no Brasil como nome próprio feminino.</p>
          <p>A plataforma nasceu como <i>Florescer Relatórios</i>. Na hora de ganhar um nome próprio, a ideia de florescer ficou: trocamos por uma palavra curta, brasileira e fácil de lembrar, que guarda o mesmo sentido. Uma flor cresce aos poucos, com cuidado e constância, como o paciente ao longo das sessões.</p>
          <ul class="land-curios">
            <li><b>A marca é uma flor.</b> O símbolo no topo da página é a flor da Potira.</li>
            <li><b>O rosa é de flor.</b> As cores são o petróleo, que traz calma e confiança, e o rosa, a cor da flor que se abre.</li>
            <li><b>O repositório guarda o nome antigo.</b> O código ainda se chama florescer-relatorios, a semente da Potira.</li>
            <li><b>Feita no Brasil, em português.</b> Do vocabulário (sessão, evolução, anamnese) ao PIX e à LGPD.</li>
          </ul>
        </div>
      </section>

      ${contato ? `<section id="contato" class="land-contato"><div><h2>Fale com a gente</h2><p class="land-sub">A Potira é criada por <b>James</b> (Jamerson Rafael). Dúvidas, sugestões ou problemas? Fale por aqui.</p></div>
        <div class="land-cta"><a class="btn lg" target="_blank" rel="noopener" href="${GIT}">GitHub · Rafajames</a>${wa ? `<a class="btn lg" target="_blank" rel="noopener" href="https://wa.me/${wa}">WhatsApp</a>` : ''}${mail ? `<a class="btn quiet lg" href="mailto:${esc(mail)}">${esc(mail)}</a>` : ''}</div></section>` : ''}

      <section class="land-fim">
        <h2>Quer testar com os seus pacientes?</h2>
        <p>Crie a sua conta, use o paciente de teste e conte o que precisa melhorar.</p>
        <a class="btn bloom lg" href="#/criar-conta">Começar agora</a>
      </section>
    </main>

    <footer class="land-wrap land-rodape"><span>Potira · relatórios clínicos</span>
      <span><a href="#/entrar">Entrar</a> · <a href="#/paciente">Portal do paciente</a> · <a href="#/" data-ir="contato">Contato</a> · <a href="termos.html">Termos de uso</a> · <a href="privacidade.html">Privacidade</a></span></footer>
  </div>`;
  document.querySelectorAll('.land [data-ir]').forEach((b) => (b.onclick = (e) => {
    e.preventDefault();
    const alvo = document.getElementById(b.dataset.ir);
    if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  // animação: cada bloco aparece suavemente ao entrar na tela (nada some para quem pede menos movimento)
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const blocos = document.querySelectorAll('.land-card, .land-passos > div, .land-faixa, .land-faq details, .land-nome, .land-fim, .land section > h2');
    const obs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visto'); obs.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    blocos.forEach((b, i) => { b.classList.add('revela'); b.style.transitionDelay = `${(i % 3) * 70}ms`; obs.observe(b); });
  }
  // prévia do produto: alterna Início, Agenda e Financeiro (dados fictícios); para sozinha ao sair da página
  const tela = document.querySelector('.land-tela');
  if (tela) {
    const slides = [...tela.querySelectorAll('.lt-corpo')], pontos = [...tela.querySelectorAll('.lt-pontos i')], menu = [...tela.querySelectorAll('.lt-menu span')];
    let at = 0;
    const mostra = (n) => { at = n; slides.forEach((x, i) => x.classList.toggle('on', i === n)); pontos.forEach((x, i) => x.classList.toggle('on', i === n)); menu.forEach((x, i) => x.classList.toggle('on', i === Number(slides[n].dataset.m))); };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setInterval(() => { if (!tela.isConnected) return clearInterval(t); if (!document.hidden) mostra((at + 1) % slides.length); }, 5200);
    }
  }
  window.scrollTo(0, 0);
}
