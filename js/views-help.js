// Central de ajuda: mapa de todas as funções e um passo a passo de cada uma.
import { $, $$, esc, shell, pageHeader, icon } from './ui.js';
import { settings } from './state.js';

const FIRST = [
  ['Complete seu perfil', 'Configurações → Perfil e timbre: nome, conselho, número, UF e categoria.', '#/config?aba=perfil'],
  ['Deixe com a sua cara', 'Configurações → Aparência e marca: logo, cores, rodapé e link próprio.', '#/config?aba=aparencia'],
  ['Cadastre um paciente', 'Pacientes → Novo paciente. Ou use "Criar paciente de teste" para experimentar.', '#/pacientes'],
  ['Registre o consentimento', 'Na ficha do paciente → Registrar consentimento. Sem ele a gravação fica bloqueada.', '#/pacientes'],
  ['Faça a primeira sessão', 'Novo → Evolução → escolha paciente e modelo → grave ou digite → abra o relatório.', '#/nova'],
  ['Revise e libere', 'No relatório: Marcar como revisado → Liberar ao paciente.', '#/relatorios'],
];

const TOPICS = [
  { t: 'Pacientes', where: 'Menu Pacientes', link: '#/pacientes', items: [
    ['Cadastrar', 'Pacientes → Novo paciente. O e-mail só é necessário para liberar relatórios no portal.'],
    ['Consentimento (LGPD)', 'Ficha do paciente → Registrar consentimento. Você pode revogar depois no mesmo lugar.'],
    ['Linha do tempo', 'A ficha mostra anamnese, evoluções, relatórios e documentos em ordem de data.'],
    ['Prontuário completo', 'Ficha do paciente → Prontuário: gera PDF ou Word com tudo, ou só o que o paciente pode ver.'],
    ['Arquivar ou excluir', 'Ficha do paciente → Ações com cuidado. Arquivar esconde; excluir apaga tudo e não volta.'],
    ['Paciente de teste', 'Pacientes → Criar paciente de teste. Dados fictícios na sua área de atuação (psicologia, fisioterapia, etc.); remova com o mesmo botão.'],
  ] },
  { t: 'Sessão: gravar e transcrever', where: 'Nova sessão', link: '#/nova', items: [
    ['Escolher paciente e modelo', 'Passo 1. O botão Gravar só libera com consentimento registrado.'],
    ['Gravar', 'Passo 2 → Gravar. Use o teste de 5 segundos no bloco do microfone para ajustar o volume.'],
    ['Teleconsulta', 'Marque "capturar áudio da aba" para gravar a voz do paciente em videochamada (no computador).'],
    ['Enviar áudio já gravado', 'Arraste o arquivo para a área de envio. Precisa de uma IA de transcrição conectada.'],
    ['Sem IA', 'Digite a sessão ou use o botão "Abrir o relatório para eu escrever". O áudio nunca é guardado, só o texto.'],
    ['Anotações', 'Escreva durante a sessão; elas ficam no relatório junto da transcrição.'],
  ] },
  { t: 'Anamnese e evolução', where: 'Ficha do paciente', link: '#/pacientes', items: [
    ['Anamnese', 'Ficha do paciente → Fazer anamnese. É a entrevista inicial; há modelos por área.'],
    ['Evolução', 'Ficha do paciente → Nova evolução. Registra cada sessão.'],
    ['Por período', 'Menu Por período: junta várias sessões num relatório (e a anamnese, se quiser).'],
  ] },
  { t: 'Editar o relatório', where: 'Relatórios → abrir um relatório', link: '#/relatorios', items: [
    ['Editar a qualquer momento', 'Os campos têm caixa visível. Rascunhos salvam sozinhos; revisados e liberados pedem "Salvar agora".'],
    ['Formatação', 'Clique num campo longo: negrito, itálico, listas, título, alinhamento e tabela.'],
    ['Campos', 'Cada seção pode subir, descer, ficar oculta ao paciente (olho) ou ser removida. "Adicionar campo" cria outra.'],
    ['Transcrição ao lado', '"Ver transcrição ao lado" mostra o texto da sessão enquanto você edita.'],
    ['Histórico e versões', 'Aba Histórico: veja versões anteriores e restaure uma delas.'],
    ['Editar vários', 'Relatórios → marque os relatórios → Editar um por vez. Use "Próximo" para passar ao seguinte.'],
    ['Revisar e liberar', 'Marcar como revisado → Liberar ao paciente. Só o que você libera aparece no portal.'],
    ['Exportar', 'Exportar PDF (com prévia) ou Word, com o seu timbre. Dá para exportar só as seções visíveis.'],
  ] },
  { t: 'Documento livre', where: 'Ficha do paciente → Novo documento', link: '#/pacientes', items: [
    ['Criar', 'Dê um título e escreva como no Word, com tabelas e listas.'],
    ['Paciente vê?', 'Somente depois de revisado e liberado, como os outros relatórios.'],
  ] },
  { t: 'Modelos', where: 'Menu Modelos', link: '#/modelos', items: [
    ['Enviar um documento seu', 'Arraste um Word, PDF ou foto. O sistema monta os campos; ajuste e salve.'],
    ['Criar e editar', 'Novo modelo, ou "Duplicar e editar" num modelo do sistema. Campos: texto longo, curto, data, sim/não e escolha.'],
  ] },
  { t: 'Sua marca e documentos', where: 'Configurações → Aparência e marca', link: '#/config?aba=aparencia', items: [
    ['Logo, cores e frase', 'Aparecem no menu, no login e nos documentos.'],
    ['Link próprio', 'Seus pacientes abrem esse link e veem o login com a sua marca.'],
    ['Estilo dos documentos', 'Tipo de letra, margem e cabeçalho do PDF e do Word.'],
    ['Registro e redes', 'Configurações → Perfil e timbre: conselho, número, UF, categoria, Instagram e site. O paciente vê no portal.'],
  ] },
  { t: 'Inteligência artificial (opcional)', where: 'Configurações → Chaves de IA', link: '#/config?aba=chaves', items: [
    ['Conectar', 'Escolha o provedor, crie a chave pelo link indicado e cole. Há opções gratuitas.'],
    ['O que muda', 'Com IA: rascunho automático e reescrita de seções. Sem IA: tudo funciona, você escreve.'],
    ['Privacidade', 'A chave fica só neste navegador e o nome do paciente nunca vai para a IA.'],
  ] },
  { t: 'Conforto de leitura', where: 'Configurações → Aparência e marca', link: '#/config?aba=aparencia', items: [
    ['Tema, letra e contraste', 'Claro, escuro ou automático; três tamanhos de letra; alto contraste. Vale só neste aparelho.'],
    ['Atalhos', 'Ctrl K busca, Ctrl S salva, Alt N nova sessão, Alt H início, ? mostra a ajuda de atalhos.'],
  ] },
  { t: 'Portal do paciente', where: 'O que o paciente vê', link: '#/pacientes', items: [
    ['Como o paciente acessa', 'Cria uma conta como Paciente com o mesmo e-mail que você cadastrou.'],
    ['O que aparece', 'Só relatórios revisados e liberados, e só as seções visíveis. A transcrição nunca aparece.'],
  ] },
  { t: 'Dados e conta', where: 'Configurações', link: '#/config?aba=dados', items: [
    ['Exportar e auditar', 'Aba Dados e privacidade: exportação dos seus dados e registro de atividades.'],
    ['Sair da conta', 'Configurações → Sair da conta (no celular) ou o ícone no menu lateral.'],
  ] },
];

// textos da Ajuda: padrão do sistema + os ajustes feitos pelo administrador (settings.help_edits)
export function helpDefaults() {
  return { FIRST: FIRST.map((x) => [...x]), TOPICS: TOPICS.map((t) => ({ ...t, items: t.items.map((i) => [...i]) })) };
}
export function resolvedHelp() {
  const ed = settings.help_edits || {}, d = helpDefaults();
  d.FIRST.forEach((f) => { if (typeof ed['first|' + f[0]] === 'string') f[1] = ed['first|' + f[0]]; });
  d.TOPICS.forEach((t) => t.items.forEach((i) => { const k = t.t + '|' + i[0]; if (typeof ed[k] === 'string') i[1] = ed[k]; }));
  return d;
}

export async function renderHelp() {
  const main = shell('ajuda');
  const H = resolvedHelp();
  const extra = Array.isArray(settings.help_extra) ? settings.help_extra.filter((x) => x && x.t && x.text) : [];
  main.innerHTML = pageHeader('Ajuda', 'Onde fazer cada coisa, passo a passo.', `<button class="btn quiet" id="ver-tour">${icon('right')}Ver o tour</button>`) + `
    <section class="panel"><h2>Primeiros passos</h2>
      <ol class="help-steps">${H.FIRST.map(([t, d, h]) => `<li><a href="${h}"><b>${esc(t)}</b></a><span class="muted">${esc(d)}</span></li>`).join('')}</ol></section>
    <label class="field">Procurar na ajuda<input id="hq" type="search" placeholder="Ex.: liberar, logo, microfone, tabela"></label>
    <div id="topics">${H.TOPICS.map((tp) => `<details class="panel help-topic" open><summary><h2>${esc(tp.t)}</h2><a class="btn quiet sm" href="${tp.link}">${icon('right')}${esc(tp.where)}</a></summary>
      <dl class="help-list">${tp.items.map(([k, v]) => `<div class="help-item"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></details>`).join('')}</div>
    ${extra.map((x) => `<details class="panel help-topic" open><summary><h2>${esc(x.t)}</h2></summary><dl class="help-list"><div class="help-item"><dd style="white-space:pre-wrap">${esc(x.text)}</dd></div></dl></details>`).join('')}
    <p id="hnone" class="muted hide">Nada encontrado. Tente outra palavra.</p>`;
  $('#ver-tour').onclick = () => import('./tour.js').then((m) => m.startTour());
  $('#hq').oninput = (e) => {
    const q = e.target.value.trim().toLowerCase(); let any = false;
    $$('.help-topic').forEach((d) => {
      let hit = false;
      $$('.help-item', d).forEach((i) => { const m = !q || i.textContent.toLowerCase().includes(q) || d.querySelector('h2').textContent.toLowerCase().includes(q); i.classList.toggle('hide', !m); hit = hit || m; });
      d.classList.toggle('hide', !hit); any = any || hit;
    });
    $('#hnone').classList.toggle('hide', any);
  };
}

/** Página própria "Sobre a Potira" (fora da Ajuda). */
export function renderAbout() {
  const main = shell('sobre');
  main.innerHTML = pageHeader('Sobre a Potira', 'O que é a plataforma e como ela cuida dos dados.') + `
    <section class="panel">
      <p>A Potira é uma plataforma para profissionais de saúde registrarem sessões, escreverem anamneses, evoluções e relatórios, cuidarem da agenda e das cobranças, e entregarem documentos ao paciente com segurança. A inteligência artificial é opcional: o sistema funciona sem ela.</p>
      <p class="muted small">Cada profissional vê só os próprios pacientes. O áudio das sessões nunca é guardado. Dados de saúde são tratados conforme a LGPD. A plataforma está em fase de testes.</p>
    </section>
    <section class="panel"><h2>Saiba mais</h2>
      <div class="row"><a class="btn quiet sm" target="_blank" rel="noopener" href="https://github.com/Rafajames/florescer-relatorios/blob/main/docs/ATUALIZACOES.md">${icon('file')}Novidades e atualizações</a>
      <a class="btn quiet sm" href="apresentacao.html" target="_blank" rel="noopener">Página de apresentação</a>
      <a class="btn quiet sm" href="termos.html" target="_blank" rel="noopener">Termos de uso</a><a class="btn quiet sm" href="privacidade.html" target="_blank" rel="noopener">Privacidade</a></div>
    </section>`;
}
