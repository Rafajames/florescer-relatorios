# Tarefa para Claude — implementar a identidade visual e o redesign do Potira

**Solicitação aprovada pelo James:** aplicar o redesign visual da plataforma e integrar a nova identidade vetorial Potira. O público futuro inclui profissionais autônomos e clínicas, mas esta tarefa é exclusivamente visual: não implementar ainda cadastro ampliado, clínicas, NFS-e, mudanças no banco ou novas regras de negócio.

## 1. Leia antes de começar

Leia integralmente, nesta ordem:
1. `docs/DIRETRIZES.md`
2. `docs/PENDENCIAS.md`
3. `docs/ATUALIZACOES.md`
4. `docs/ESPECIFICACAO-EVOLUCAO-POTIRA.md)
5. `CLAUDE.md)
6. `assets/brand/README.md` (guia dos SVGs)
7. Inspecione os arquivos atuais de `js/ui.js`, `js/theme.js`, `js/brand.js`, `js/views-home.js`, `js/views-landing.js`, `js/views-settings.js`, `css/app.css` e `index.html`.

Não presuma que exemplos antigos ou imagens de referência descrevem exatamente o código atual. Confirme seletores, rotas, estrutura e comportamento diretamente no repositório.

## 2. Identidade oficial

Os arquivos vetoriais estão em `assets/brand/`:
- `potira-logo-claro.svg`
- `potira-logo-escuro.svg`
- `potira-logo-negativo.svg`
- `potira-simbolo-colorido.svg`
- `potira-simbolo-negativo.svg`
- `potira-simbolo-monocromatico.svg`
- `potira-icone-claro.svg`
- `potira-icone-escuro.svg`
- `potira-icone-negativo.svg`

Use sempre o nome **Potira**, sem o subtítulo “Gestão em Saúde”. A identidade do produto usa petróleo `#134B5F`, amora `#B83D6F`, rosa e turquesa dos SVGs. Não redesenhe, distorça, recorte ou rasterize os SVGs.

### Comportamento do logotipo
- Tema claro: `potira-logo-claro.svg`.
- Tema escuro: `potira-logo-escuro.svg`.
- Em fundo petróleo sólido: `potira-logo-negativo.svg`.
- Ícone/favicons: escolher o SVG de ícone correspondente ao fundo.
- A alternância deve seguir o tema já existente em `js/theme.js` (`data-theme` e modo automático), sem criar um segundo mecanismo de tema.
- Verifique como o modo automático reage à preferência do sistema e faça a logo acompanhar exatamente o mesmo estado visual.
- Não dependa exclusivamente de `prefers-color-scheme` se o usuário já escolheu tema manual dentro do Potira.
- O SVG monocromático pode ser usado inline com `currentColor`; não espere que `currentColor` funcione de modo confiável em SVG carregado por `img src`.
- Não substituir a marca própria enviada pelo profissional em `profiles.branding`. A marca Potira é a marca institucional/padrão; a marca personalizada do profissional deve continuar aparecendo nos locais onde já aparece hoje.

## 3. Direção visual

Use a referência visual aprovada como inspiração de hierarquia e organização:
- Interface clara, acolhedora e profissional.
- Fundo neutro suave; cartões brancos; bordas discretas; cantos arredondados consistentes.
- Espaçamento generoso e hierarquia tipográfica clara.
- Menu lateral em petróleo, com estados ativos e hover legíveis.
- Amora para ações principais e destaques; não introduza verde-limão como cor principal.
- Gráficos simples, discretos e com legenda/valores legíveis.
- Ícones consistentes e sem excesso de decoração.
- Evitar aparência de dashboard genérico ou de sistema hospitalar antiquado.
- Manter as fontes oficiais definidas nas diretrizes: Bricolage Grotesque para títulos e Instrument Sans para textos. Não trocar por fontes aleatórias.
- Manter textos em português brasileiro e vocabulário da plataforma: “sessão”, “paciente”, “Evolução”, “Anamnese”, “Relatório”.

## 4. Escopo de implementação

Faça o redesign visual integral das telas existentes, sem alterar suas funcionalidades:
- Moldura global, menu lateral, topo, navegação e perfil.
- Início do profissional (primeira prioridade visual): saudação, data, próximos compromissos, indicadores existentes, pendências, atividades e cartões que já tenham dados reais.
- Listas e fichas de pacientes.
- Anamnese, evolução, editor de relatório e documentos.
- Agenda, frequência, declarações e convênios.
- Financeiro, cobranças, gastos, recibos e telas de valores.
- Configurações, aparência, marca, privacidade e consentimentos.
- Portal do paciente e páginas públicas.
- Login, criação de conta, recuperação de acesso, onboarding, ajuda e apresentação pública.
- Modais, menus, formulários, filtros, tabelas, estados vazios, carregamento, erros e confirmações.

### Início do profissional
Melhore a organização do painel sem inventar métricas:
- Destaque a saudação e a data.
- Organize os dados já disponíveis em cartões de leitura rápida.
- Dê boa visibilidade às próximas sessões e às tarefas que exigem ação.
- Use gráficos somente com dados existentes e mantenha rótulos e períodos claros.
- Ações rápidas devem apontar para funções/rotas que já existem.
- Não exibir faturamento, despesas ou informações que o perfil atual não tem autorização para consultar.
- Não inventar “pacientes ativos”, receita, conversão ou contagens se não houver fonte real no código.

## 5. Regras técnicas obrigatórias

- Manter HTML, CSS e JavaScript puro em módulos ES. Sem framework, build, TypeScript, bundler ou `npm install`.
- Não adicionar serviço pago ou dependência externa.
- Não alterar schema, RPC, RLS, Supabase, autenticação, dados, permissões ou regras clínicas/financeiras.
- Não reescrever arquivos inteiros quando mudanças pontuais forem suficientes.
- Centralizar padrões visuais reutilizáveis em `css/app.css` e componentes existentes em `js/ui.js`, quando adequado.
- Preservar responsividade e acessibilidade: teclado, foco visível, contraste, labels, alvos de toque e `prefers-reduced-motion`.
- Conferir modo claro, escuro e automático em todas as telas. Não deixar textos, ícones, bordas, campos ou modais ilegíveis.
- Conferir telas estreitas a partir de 390 px; não pode haver rolagem horizontal da página.
- Não remover recursos por motivos estéticos.
- Não alterar marca personalizada do profissional nem os documentos exportados além de ajustes visuais necessários e compatíveis.
- Evitar CSS inline novo; preferir classes e tokens reutilizáveis.
- Não usar imagens de dashboard com dados fictícios como conteúdo real da aplicação.

## 6. Ordem de execução

1. Faça inventário rápido das telas/rotas e dos padrões visuais existentes.
2. Integre os SVGs nos pontos institucionais (menu, login/apresentação, favicon e locais de marca Potira), respeitando marcas personalizadas.
3. Estabeleça tokens e componentes visuais coerentes com as diretrizes.
4. Redesenhe a moldura global e o Início do profissional.
5. Aplique o sistema visual nas demais telas, por módulos, preservando ações e fluxos.
6. Revise tema claro/escuro/automático, responsividade e acessibilidade.
7. Corrija regressões visuais e funcionais encontradas.

Não pare após redesenhar apenas a página inicial: o pedido aprovado é redesign de toda a plataforma. A página Início é a primeira prioridade, não o limite do escopo.

## 7. Testes obrigatórios

- Abrir as rotas principais como profissional autônomo.
- Confirmar que navegação, botões, formulários, modais e ações continuam funcionando.
- Conferir menu recolhido/expandido se existir.
- Conferir tema claro, escuro e automático, inclusive após recarregar.
- Conferir logo institucional e marca personalizada do profissional.
- Conferir pelo menos 390 px, tablet e desktop.
- Conferir foco por teclado, contraste e movimento reduzido.
- Procurar erros de console, imports quebrados e recursos 404.
- Confirmar que nenhuma consulta, regra de negócio ou permissão foi alterada.
- Se não houver credenciais/dados para testar uma rota, registrar isso como não testado; não afirmar que foi validada.

## 8. Entrega no GitHub

- Trabalhe na branch `main`, conforme o fluxo documentado.
- Antes do commit, execute `python3 tools/stamp.py` e inclua `index.html`.
- Atualize `docs/ATUALIZACOES.md` e `docs/PENDENCIAS.md`.
- Se algum requisito não puder ser concluído sem decisão do James, pare apenas essa parte, explique o bloqueio e continue o restante que estiver claro.
- Não misture nesta entrega a implementação de cadastro completo, conta de clínica ou NFS-e.
- Ao concluir, informe arquivos principais alterados, testes realmente executados, limitações e o link de teste: https://rafajames.github.io/florescer-relatorios/

**Comece agora pela leitura dos documentos e inspeção do código. Depois implemente o escopo visual aprovado sem pedir nova confirmação de prioridade.**
