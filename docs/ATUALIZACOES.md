# Atualizações da Potira

Histórico do que foi feito, da mudança mais nova para a mais antiga. Cada entrega nova deve ganhar uma entrada no topo.

Sobre o que ainda falta, veja [PENDENCIAS.md](PENDENCIAS.md). Sobre as regras do projeto, veja [DIRETRIZES.md](DIRETRIZES.md).

## 20/11/2026 — Assistente: remarcar, horário livre, visão do dia, cobrar e recibo

- **Remarcar sessão** (`remarcar_sessao`): o Assistente só monta a **solicitação** ("de 20/11 09:00 para 21/11 10:20"); nada muda até o profissional clicar em **Aceitar** (ou Recusar). Só sessões agendadas; avisa conflito de horário; a confirmação do paciente volta a ficar em branco.
- **Horário livre** (`horario_livre`): horários livres de um dia a partir das sessões marcadas (expediente padrão 08:00–18:00 e 50 min, ajustáveis no pedido).
- **"Como está meu dia?"** (`visao_do_dia`): sessões de hoje, pacientes que pediram para remarcar pelo link de confirmação (próximos 30 dias), evoluções pendentes, cobranças agendadas que vencem hoje e total em aberto.
- **Cobrar paciente** (`cobrar_paciente`): abre a mesma janela de cobrança da ficha (PIX e WhatsApp) com tudo em aberto; nada é enviado sem o profissional.
- **Recibo** (`gerar_recibo`): com confirmação, emite o recibo numerado das sessões pagas do mês (mesmo PDF e mesma lista de "Recibos emitidos" do Financeiro). Sem sessão paga, não gasta número.
- Ajuda do Assistente e exemplos do painel atualizados.
- Testado com banco e IA simulados: horário livre, visão do dia, remarcação (resumo, conflito, mudança só após aceitar), cobrança (com e sem valores em aberto) e recibo (com e sem sessão paga). **Não testado com IA real nem com o banco real.**

## 19/11/2026 (tarde) — Assistente de IA, importação de pacientes, Ajuda nova e Medicina

### Assistente de IA (`js/agente.js`)
- Botão do Assistente no canto inferior direito, só para o profissional com IA de texto conectada (some sem chave, para secretária e na tela de Nova sessão). Painel lateral no computador, tela cheia no celular.
- Funciona com Gemini, Claude (Anthropic), OpenAI e Groq, usando a mesma chave de Configurações, com ferramentas (function calling).
- Ferramentas: consultar a Ajuda; buscar pacientes; listar sessões; resumo financeiro; pendências (quem deve, sessões sem evolução, rascunhos); ler evoluções para resumir; abrir telas. Ações com **confirmação obrigatória** (card Confirmar/Cancelar): agendar sessão, mudar situação da sessão, cadastrar paciente e lançar gasto. Nota fiscal responde que ainda não existe. Nada é apagado.
- Privacidade: a IA recebe pacientes como código ([P1]) com iniciais e idade; o nome volta só na tela. Evoluções só vão quando a IA precisa resumir. Conversa só em memória, limpa ao sair da conta.
- Testado no simulado com IA falsa nos 4 formatos (Claude, Gemini, OpenAI, Groq): dois "Lucas" → pergunta qual; agendar com confirmação; cancelar não altera nada; pendências; dúvida respondida pela Ajuda. **Não testado com IA real nem com o banco real.**

### Importação de pacientes (`js/importar.js`)
- Pacientes → **Importar planilha**: Excel (.xlsx/.xls, leitor SheetJS carregado do CDN só nessa hora) ou CSV (`;`, `,` ou tab; UTF-8 ou o formato do Excel em português).
- Liga as colunas sozinho pelos nomes mais comuns (Paciente, Dt. Nascimento, Celular, Nome da mãe, Convênio…); dá para ajustar. Prévia com situação de cada linha.
- Converte datas (dd/mm/aaaa, aaaa-mm-dd, número do Excel), telefones, CPF (repõe zero à esquerda) e CEP; inválidos viram aviso e ficam em branco. Responsável entra como legal e financeiro; convênio vai para o Administrativo.
- Repetidos não entram: mesmo CPF, ou mesmo nome + nascimento, de quem já está cadastrado ou repetido na planilha.
- Grava em blocos de 200 com um lote (`patients.import_batch`, v20); **Desfazer a última importação** apaga o lote. Planilha modelo para baixar. Arquivo lido só no navegador.
- Testado no simulado com CSV (Windows-1252, cabeçalhos variados, repetidos, CPF/data/e-mail inválidos) e Excel; desfazer conferido. **Não testado com o banco real.**

### Ajuda
- Central de Ajuda com tópicos novos: cadastro completo e responsáveis, importação, agenda, financeiro e cobranças, chaves de IA (trocar, mais de uma, remover) e Assistente. É a mesma base que o Assistente consulta e funciona sem IA.

### Medicina
- Áreas "Medicina" e "Psiquiatria" separadas (antes "Psiquiatria / Medicina"; quem tinha o valor antigo passou para Psiquiatria). Modelos do sistema novos: Anamnese médica, Evolução médica (SOAP), Anamnese psiquiátrica e Evolução psiquiátrica (v20). Menu do perfil: Médica/Médico e Médica/Médico psiquiatra.

## 19/11/2026 — Cadastro completo do paciente

- **Banco (v19, já aplicado):** colunas novas em `patients`, todas opcionais: nome social, CPF (só números, validado), RG e órgão emissor, sexo, WhatsApp, telefone alternativo, endereço (CEP, rua, número, complemento, bairro, cidade, UF), carteirinha do convênio, data de entrada, origem e `guardians` (lista de até 3 responsáveis: nome, parentesco, CPF, telefone, e-mail, legal, financeiro).
- **Formulário** "Novo paciente" / "Editar cadastro" (`js/cadastro.js`) em seções: Identificação, Contato, Endereço, Responsáveis, Administrativo e Observações. Máscaras de CPF, CEP e telefone; CPF do paciente e dos responsáveis validado; CEP preenche rua, bairro, cidade e UF pelo ViaCEP (gratuito; se falhar, preenche à mão).
- **Responsáveis:** pelo menos um bloco sempre visível, até 3, com marcação de responsável legal e financeiro. O principal (financeiro, ou o primeiro) é copiado para o campo antigo de responsável, então documentos e Administrativo continuam funcionando. Pacientes antigos abrem com o responsável que já existia.
- **Ficha:** quadro "Cadastro" no Resumo, com os dados preenchidos, responsáveis e aviso quando falta CPF ou endereço (botão "Completar").
- **Planilha de pacientes (CSV)** em Configurações passou a incluir os campos novos.
- Conta de testes: responsáveis, cidade e data de entrada preenchidos nos pacientes.
- Testado no ambiente simulado (formulário em 390 px, máscaras, CPF inválido barrado, adicionar/remover responsável, quadro da ficha). **Não testado no site real** (sem acesso ao Supabase daqui): salvar, reabrir e conferir a ficha.

## 19/11/2026 — Conta fictícia de testes e planejamento (Assistente, cadastro completo, importação)

- Criada no Supabase a conta **Testes de IA** (terapeuta ocupacional, `testes.ia@example.com`) com 10 pacientes fictícios, 90 sessões, 41 evoluções, cobranças nos 4 modos, metas, despesas e lista de espera. Detalhes e roteiro de testes em [CONTA-TESTES.md](CONTA-TESTES.md). Nenhuma alteração de código ou de estrutura do banco.
- Documentado o **Assistente de IA** (6 tipos de pedido, regras, ferramentas): [ASSISTENTE-IA.md](ASSISTENTE-IA.md).
- Documentados o **cadastro completo** (CPF, endereço, responsável financeiro) e a **importação de pacientes por planilha**: [IMPORTACAO-PACIENTES.md](IMPORTACAO-PACIENTES.md).
- PENDENCIAS §10 com os três itens. Nada disso foi implementado ainda.

## 19/11/2026 — Nova apresentação (página inicial pública)

### Documentação atualizada
- README refeito: logo, o que a Potira faz por área do menu, visual, tecnologia (IAs Gemini, Groq, Anthropic e OpenAI), estrutura de pastas, como instalar e como contribuir.
- DIRETRIZES: novas regras de interface (ordem do menu, títulos iguais ao menu, nada repetido, marca Potira na moldura e do profissional nos documentos, Início só com dados reais) e regras da marca/estilos.
- PENDENCIAS §9 reescrita com a situação do redesign; CLAUDE.md com o mapa do código atualizado.

### Profissão no feminino/masculino e logo do celular corrigida
- No menu do perfil aparece a profissão, não a área: Terapeuta ocupacional, Psicóloga/Psicólogo, Fonoaudióloga/Fonoaudiólogo, Médica/Médico, Enfermeira/Enfermeiro, Fisioterapeuta, Nutricionista, Assistente social. Em "Outra", usa a categoria escrita no perfil.
- Feminino ou masculino: escolha nova em Configurações → Perfil ("Como você é apresentado(a)"), guardada em `credentials.tratamento` (sem mudança de banco). Sem escolha, o sistema usa o primeiro nome (termina em "a" → feminino).
- Logo do topo no celular aparecia só com as pétalas de fora: o desenho estava duas vezes na página com os mesmos ids de cor, e a cópia escondida do menu lateral "levava" as cores. Agora cada cópia tem ids próprios (`unico` em `js/marca.js`). Símbolo do topo um pouco maior.
- Testado no ambiente simulado (celular claro e escuro; perfil). Documentos (PDF/Word) continuam com a área de atuação como antes.

### Menu lateral: logo menor e botão para recolher
- Logo do menu menor no computador.
- Botão "Recolher menu" no rodapé do menu: recolhido, o menu fica estreito e mostra só os ícones (o nome aparece ao passar o mouse) e o símbolo da Potira no lugar da logo. A escolha fica guardada neste navegador. Não muda o celular.
- Testado no ambiente simulado (1024, 1280 e 1440 px; claro e escuro; escolha mantida ao trocar de página).

### Logo do profissional só nos documentos; foto do Google no perfil
- Menu, topo do celular e telas de entrada mostram sempre a marca Potira. A logo e o nome do consultório continuam nos documentos (PDF e Word); as cores escolhidas seguem mudando o menu. Texto de Configurações → Aparência ajustado.
- Círculo do perfil (canto superior direito): usa a foto da conta Google quando a pessoa entrou pelo Google e a conta tem foto; senão, as iniciais. Se a foto não carregar, voltam as iniciais.
- A entrada com Google ainda não existe: precisa ativar o Google no Supabase (Authentication → Providers) com um cliente OAuth do Google Cloud, e depois pôr o botão "Entrar com Google". Ver PENDENCIAS.

### Redesign, entrega 2 de 3: telas internas no padrão do Início
- Abas viram uma barra de pílulas (aba ativa em petróleo), que rola de lado quando não cabe: vale para Agenda, Financeiro, ficha do paciente, editor, Documentos e Configurações.
- Painéis, tabelas, números (stats), cartões de paciente, de configurações e de registro: brancos, cantos do novo padrão e sombra discreta, sem borda. Títulos na fonte da marca (Bricolage). Campos com cantos mais arredondados.
- Regras repetidas desses componentes em `app.css` foram juntadas numa só (saíram 8 regras duplicadas).
- Corrigida a rolagem lateral do Financeiro em tablet (~768 a 1100 px): a tabela de cobranças vira duas colunas nessa faixa.
- Varredura no ambiente simulado: 17 telas × 4 larguras (390, 768, 1024, 1366), claro; Financeiro também no escuro. Sem rolagem lateral. O Resumo do Financeiro dá erro só no simulado (dados de teste sem data de pagamento); conferir no site real.

### Logo sem selo e menos repetição
- Logo e símbolo sem o quadrado de fundo em todo o sistema (topo da apresentação no tema escuro, topo do celular, entrada, Portal do paciente, primeiro acesso e páginas por link). A entrada ganhou a logo nova no lugar da flor antiga.
- Sem informações repetidas: Configurações, Sobre e Sair ficam só no menu do perfil (canto superior direito: Meu perfil, Sobre a Potira, Sair). Saíram de "Mais", do rodapé do menu lateral e do cabeçalho de Configurações (que também tinha Ajuda). Barra do celular da secretária(o) troca Sair por Ajuda; a do administrador fica com Início e Segurança.
- Títulos das páginas iguais aos nomes do menu: Agenda, Atendimentos, Documentos, Relatórios, Ajuda e Suporte (também no título da aba e no tour).
- Início: tirados "Pacientes" e "Rascunhos para revisar" de Sessões de hoje (já estão nos indicadores) e o cartão "Últimos 7 dias" (o minigráfico de sessões mostra o mesmo). Atendimentos sem o botão "Nova sessão" (o "Novo" do topo faz o mesmo).
- Testado no ambiente simulado (claro/escuro, 390/768/1280/1440). Barra da secretária(o) não testada (o ambiente simulado não monta esse perfil).

- Recriada no visual da prévia `preview/potira-apresentacao.html` aprovada pelo James: topo claro com logo, destaque com prévia do novo Início (dados fictícios, gráfico que se desenha, agenda com destaque animado), benefícios, "A plataforma" com espaço de trabalho, quatro passos, bloco de confiança (IA opcional, LGPD), público, "Por que Potira?", dúvidas, chamada final, contato e botão flutuante de Contato.
- Mudanças em relação à prévia: logo e símbolo oficiais no lugar do ✿, ícones do sistema no lugar dos caracteres, botões ligados a Entrar, Criar conta e Portal do paciente, textos com o que a Potira faz de fato, perguntas frequentes mantidas, contato real (GitHub; WhatsApp e e-mail quando o administrador preencher), tema escuro e movimento reduzido.
- Estilos em `css/landing.css` (novo); as regras antigas da apresentação saíram de `app.css`.
- Testado no ambiente simulado (390 e 1366 px; claro, escuro e automático; botão Entrar), sem erros nem rolagem lateral.

## 18/11/2026 — Redesign, entrega 1 de 3: marca, moldura e Início

### Início e moldura mais próximos da imagem de referência
- Nome do profissional no canto superior direito (com iniciais); ao clicar abre Configurações, Sobre a Potira e Sair. O rodapé do menu com o nome saiu; Ajuda e Suporte ficou no fim do menu.
- Rodapé com "Seus dados estão seguros", lema, versão (carimbo do stamp.py) e Online/Sem internet (estado real do navegador).
- Logo do menu direto sobre o petróleo, sem selo (versão com nome petróleo quando a cor da marca é clara).
- Início: "Olá, nome!", indicadores com variação em relação ao mesmo período do mês anterior e minigráfico dos últimos 30 dias (pacientes ativos, sessões no mês, receitas no mês, documentos pendentes); gráfico de linhas de receitas e despesas (7/30/90 dias); Ações rápidas em blocos; Últimas atividades (pacientes novos, registros e pagamentos, com hora); Próximos compromissos com horário em destaque (Iniciar/Falta mantidos). Sessões de hoje, atenção, relatórios do mês, 7 dias e checklist continuam abaixo.
- Fora por falta de dado ou função: sino de notificações, foto do profissional e Notas Fiscais.
- Testado no ambiente simulado (360, 390, 768, 1280, 1440 px; claro e escuro), sem erros e sem rolagem lateral.

### Marca Potira refeita pela imagem enviada
- Os SVGs de `assets/brand/` não eram a marca do James. Refiz em vetor a lótus com a figura no centro e o nome "Potira", a partir da imagem (logo clara, escura, negativa, horizontal, símbolos e ícones). É uma reprodução próxima, não idêntica; o nome foi vetorizado da imagem e pode ter pequenas irregularidades. Se houver os SVGs originais, basta substituí-los.
- Menu usa a logo empilhada; topo da apresentação usa a horizontal. Favicons e ícones atualizados. Sem "Gestão em Saúde".
- Testado no ambiente simulado (menu, apresentação, celular, claro e escuro).

### Apresentação (página inicial pública) no novo visual
- Logo oficial no topo (claro/escuro), lótus discreta no fundo do destaque, cartões com sombra e cantos do novo padrão, ícones em petróleo, rosa e turquesa, símbolo oficial em "Por que Potira?" e prévia com item ativo rosa. Textos e seções não mudaram.
- Testado no ambiente simulado (1366 e 390 px, claro e escuro), sem erros no console nem rolagem lateral. Não testado em aparelhos reais.

### Redesign, entrega 1 de 3 (revisada pela imagem de referência)
- Menu: Início, Pacientes, Agenda, Atendimentos, Documentos, Financeiro, Relatórios, Configurações, Ajuda e Suporte. Item ativo em rosa (cor de destaque da marca, com texto que se ajusta à cor), flor de lótus discreta no fundo do menu. Notas Fiscais não aparece (a funcionalidade ainda não existe; ficará dentro de Financeiro).
- Rotas: Agenda = Administrativo; Atendimentos = lista de relatórios/sessões; Documentos = modelos de documento; Relatórios = relatório por período. Nada mudou nas páginas, só nos nomes do menu. No celular a barra inferior passa a ter Agenda no lugar de Relatórios; o resto fica em "Mais".
- "Atendimentos" foi usado a pedido do James, embora as DIRETRIZES evitem a palavra; nos textos segue "sessões".
- Início: indicadores (sessões hoje, pacientes, recebido no mês, a receber), Evolução financeira (7/30/90 dias, com os mesmos pagamentos do Resumo do Financeiro), Ações rápidas, Sessões de hoje (com "Iniciar sessão"), Próximos compromissos (Iniciar/Falta/lembretes mantidos), Últimas atividades (relatórios e pagamentos), atenção, relatórios do mês e últimos 7 dias. Só dados reais; sem pagamentos, os valores aparecem zerados.
- Novo `js/home-fin.js`. Botões de destaque usam texto escuro quando a cor da marca é clara.
- Testado no ambiente simulado: 390/768/1024/1280/1366 px, claro/escuro, marca clara, alternância 7/30/90, movimento reduzido; sem erros no console e sem rolagem lateral. Não testado com dados reais nem no iPhone.

- **Marca Potira oficial** (SVGs de `assets/brand/`) no menu lateral, na barra do topo do celular e nos favicons (claro e escuro). A logo troca sozinha com o tema (claro, escuro e automático, inclusive ao recarregar) e leva o próprio fundo oficial, então fica legível em qualquer cor de menu escolhida. A marca própria do profissional continua no menu e no topo do celular.
- **Moldura redesenhada, celular primeiro:** topo com a marca e a busca, barra de baixo flutuante com alvos de toque maiores, link "Pular para o conteúdo" para teclado, foco visível no menu, tablet com menu mais estreito.
- **Início:** "O que precisa da sua atenção" virou cartão próprio (sobe para o topo no celular); estilos soltos trocados por classes; contraste do texto secundário melhorado. Nenhuma métrica nova.
- **CSS reorganizado:** `css/tokens.css` (cores, tipografia, espaços, temas escuro/automático), `css/marca.css`, `css/shell.css` (moldura) e `css/inicio.css`. Cerca de 230 linhas de regras repetidas saíram do `app.css`. `tools/stamp.py` agora carimba todos os CSS.
- `tools/gerar-marca.py` gera `js/marca-svg.js` a partir dos SVGs (inline, para o nome usar a fonte Bricolage). Rode de novo se um SVG da marca mudar.
- Sem mudança de banco, rotas, regras de negócio ou permissões.

## 18/11/2026 — Identidade vetorial e roteiro de redesign

- Adicionados nove arquivos SVG em `assets/brand/`: logotipos claro, escuro e negativo; símbolos colorido, negativo e monocromático; ícones claro, escuro e negativo.
- Criado `docs/CLAUDE-IMPLEMENTAR-REDESIGN-POTIRA.md`, roteiro para o Claude integrar a identidade e executar o redesign visual completo, preservando a arquitetura e as funcionalidades existentes.
- Esta entrega adiciona ativos e instruções; a implementação visual no código ainda não foi executada.

## 18/11/2026 — Especificação de evolução do Potira

- Criada [ESPECIFICACAO-EVOLUCAO-POTIRA.md](ESPECIFICACAO-EVOLUCAO-POTIRA.md), com o plano técnico para atender autônomos e clínicas, ampliar o cadastro de pacientes, planejar a emissão de NFS-e e reformular toda a interface.
- Esta entrega é documentação: nenhum código, banco ou integração fiscal foi alterado. Permanecem pendentes as decisões fiscais e a questão de saída de profissional da clínica.

## 14/11/2026 — Anamnese recebida: a resposta primeiro

- Em Anamneses recebidas cada item tem só **Ver resposta**. A janela mostra as respostas e, embaixo, as decisões: Criar paciente, Juntar a um paciente que já existe, Salvar para depois ou Descartar.
- A novidade "Paciente novo respondeu a anamnese" abre essa resposta direto (antes caía numa ficha inexistente).

## 14/11/2026 — Ajustes de layout no celular

- Anamneses recebidas: nome e dados em cima, botões embaixo ocupando a largura (antes o texto ficava espremido, uma palavra por linha).
- Título da página não passa mais por cima da barra do topo ao rolar.
- Menu "⋯" do editor de relatório abre inteiro, embaixo da tela (antes aparecia cortado no topo).

## 14/11/2026 — Novidades clicáveis

- No Início aparece só a novidade mais recente; clicar nela leva direto ao que avisa (anamnese respondida abre a própria anamnese).
- Clicar no título "Novidades" (ou em "Ver as outras") abre uma janela com as últimas 30, com bolinha nas que ainda não foram vistas.
- Corrigido erro "home.atualizarSelo is not a function" ao entrar (o número do menu não trava mais a tela).

## 14/11/2026 — Anamnese para paciente novo e "Anamneses recebidas"

- **Anamnese sem paciente cadastrado:** botão "Enviar anamnese" em Pacientes, opção "Anamnese por link" no botão Novo e "Enviar para um paciente preencher" ao salvar um modelo. Primeiro pergunta "Paciente novo" ou "Paciente já cadastrado"; escolhido um, o outro some (com "Trocar"). Dentro da ficha do paciente não há escolha.
- **Dados que o profissional já tem** (nome, responsáveis, nascimento, telefone) vão preenchidos no formulário; o telefone serve para o WhatsApp.
- **Link fixo:** um link que várias famílias podem responder (ex.: bio do Instagram), válido por 1 ano, com limite de 20 respostas por hora.
- **Anamneses recebidas** no Início e em Pacientes, com o número no menu Pacientes. Para cada resposta: ver respostas, **Criar paciente** (nome, nascimento, telefone e responsável vêm da resposta; avisa se já existe paciente com o mesmo nome ou telefone), **Juntar a um paciente que já existe** ou **Descartar**. A anamnese vai para a ficha como rascunho e o consentimento aceito no link é registrado no paciente.
- Depois de criar o paciente: **Agendar a primeira sessão**, revisar a anamnese ou abrir a ficha.
- **Rascunho no celular dos pais:** se fecharem a página no meio, as respostas continuam lá.
- Banco: tabela `anamnese_inbox`, coluna `share_links.reusable`, `public_submit_anamnese` manda resposta sem paciente para a caixa, regra `share_links_tipo_dados` aceita anamnese sem paciente.
- Pacientes são de cada profissional: dois profissionais com a mesma criança têm cadastros separados; o aviso de repetido só olha os pacientes de quem está logado.

## 14/11/2026 — "O que fazer agora?" ao salvar, modelos da Potira como guia e timbre opcional

- **Modelos da Potira abrem direto no editor**, como guia. Ao salvar, viram modelo do profissional (etiqueta "Meu"); o original não muda.
- **Ao salvar um modelo**, abre a janela "O que fazer agora?": enviar para um paciente preencher (anamnese), usar agora com um paciente (anamnese e evolução), baixar em branco em PDF ou Word.
- **Ao clicar em "Salvar agora" num registro** (anamnese, evolução, relatório): baixar em PDF ou Word, guardar como modelo meu, enviar o formulário para o paciente preencher (anamnese) e marcar como revisado, se quiser. Ctrl+S salva sem abrir a janela.
- **Logo e marca d'água opcionais** em PDF e Word: padrão é em branco. Marcando, sai a logo do profissional e, como marca d'água, a do modelo enviado ou a própria logo bem clarinha. No Word a marca d'água não aparece (limitação do Word).
- **Reenviar** anamnese por link na ficha do paciente (gera um link novo com as mesmas perguntas).
- O link é só para o paciente **preencher**; tirado o link de leitura da anamnese adicionado mais cedo.

## 14/11/2026 — Salvar cópia de modelo, linhas de resposta e link da anamnese

- **Corrigido o erro "Você não tem permissão para esta ação"** ao salvar um modelo copiado de um modelo da Potira (como a Anamnese geral): a cópia era gravada sem dono e o banco recusava. Agora toda cópia ou modelo novo nasce no nome de quem salvou. Os modelos da Potira continuam intocáveis para profissionais.
- No editor de modelo, novo botão **Salvar como cópia** (o modelo original fica como está; se o nome não mudar, ganha "(cópia)").
- A **orientação** de cada campo agora é uma caixa que cresce enquanto se digita (e pode ser puxada para ficar maior).
- Nos campos de texto longo, botões **+ linha / − linha** definem quantas linhas de resposta o campo tem (de 1 a 12); vale na prévia do modelo e no formulário da anamnese por link.
- Anamnese revisada agora pode ser enviada **por link** (leitura, com PDF e Word), pelo menu Exportar da própria tela do relatório ("Enviar por link ao paciente") e também pela ficha do paciente. A anamnese para o paciente **preencher** já existia ("Anamnese para responder").

## 13/11/2026 — Prévia da apresentação com três telas

- A prévia no destaque alterna sozinha, a cada 5 segundos, entre **Início**, **Agenda da semana** (grade com sessões coloridas e a linha do agora) e **Financeiro** (recebido, a receber, gastos, barras dos meses e uma cobrança por PIX). Tudo com nomes e valores fictícios; o item do menu lateral e os pontinhos acompanham a troca. Depois entraram mais duas telas: **Relatório com o seu timbre** (texto "sendo escrito", Rascunho → Revisado, PDF) e **Portal do paciente** (próxima sessão para confirmar, relatório liberado, orientações e recibo em PDF).

## 13/11/2026 — Animações contínuas na apresentação

- No destaque: pétalas subindo devagar, brilho rosa se movendo, e a prévia da tela "viva" (flutua, o menu troca de item, cada sessão ganha a vez, "Agendada" vira "Confirmou", aviso "Tudo salvo" aparece e some).
- Mais abaixo: os números do passo a passo acendem em sequência e os ícones dos recursos balançam de leve.
- Só CSS, sem biblioteca; tudo para para quem pede menos movimento.

## 13/11/2026 — Contato no site

- A apresentação tem sempre a seção **Fale com a gente**, com o nome do criador e o link do GitHub (github.com/Rafajames); também no rodapé ("Contato") e na página Sobre. WhatsApp e e-mail continuam opcionais (Administração → Convites).

## 13/11/2026 — Crítica das telas novas, tudo corrigido

- **Agenda:** a grade começa uma hora antes da primeira sessão e termina uma depois da última (mínimo de 8 horas); linha rosa do "agora" no dia de hoje; clicar num espaço livre já abre o agendamento com o horário (arredondado para meia hora); no celular a visão padrão é **Dia**; etiquetas das horas não cortam; setas com o nome certo na visão Dia.
- **Editor:** a situação aparece uma vez só (o caminho Rascunho → Revisado → Liberado, agora na horizontal acima do texto, sem coluna vazia à direita); no celular os botões viram "Revisar"/"Liberar" e "Tudo salvo" cabe inteiro.
- **Ficha do paciente:** Arquivar e Excluir saíram do Resumo e foram para o menu **Mais** (junto com as exportações); cada paciente abre sempre no Resumo; no computador o Resumo usa duas colunas.
- **Pacientes:** formato **Cartões ou Lista** compacta (lembra a escolha; com mais de 24 pacientes começa em Lista); "Arquivados" virou pílula; as cores das iniciais ficam entre o petróleo e o rosa da marca.
- **Relatórios:** "Mais filtros" abre por cima da barra de seleção.
- **Configurações:** todos os cartões têm estado (salvamento automático, texto do termo, autenticador, pasta); dentro da seção ficou só o "voltar".
- **Apresentação:** prévia da tela da plataforma no destaque; atalhos das seções rolam de lado no celular; seção **Fale com a gente** (WhatsApp e e-mail) que só aparece se o administrador preencher o contato em Administração → Convites (`app_settings`: `contato_whatsapp`, `contato_email`).
- **Novidades:** o "visto" fica no perfil (`preferences.novidades_visto`) e vale em todos os aparelhos.
- **Animações:** as de entrada (painéis em sequência, números contando, gráficos) só na primeira visita do dia; check, janelas e flor continuam sempre.

## 13/11/2026 — Acertos no Financeiro e na Agenda (migração v17 aplicada)

- **Anular o último recibo:** em Financeiro → Documentos, o recibo mais recente tem "Anular"; ele sai da lista e do portal, e o número volta a ficar livre (função `undo_receipt_number`, só devolve se for o último e não houver recibo com aquele número).
- **Evolução ligada à sessão certa:** "Iniciar", "Evolução" e "Registrar evolução" levam a sessão no endereço (`&sessao=`); a evolução guarda `appointment_id` e marca como realizada aquela sessão, não a primeira do dia.
- **Editar valor em Cobranças:** a tela não volta ao topo e a linha salva pisca em verde.
- **Agenda:** nova visão **Dia** (setas andam de um em um dia; clicar num dia do Mês abre o Dia).
- Não feito: pagamento parcial (precisa de desenho) e controle de convênio com guias.

## 13/11/2026 — Recibo em PDF no portal do paciente

- No Portal do paciente, cada recibo ganha o botão **PDF**, com o mesmo conteúdo, número e timbre da segunda via do profissional.
- Banco: migração **v16** troca `portal_overview()` para enviar também o conteúdo do recibo e os dados do profissional usados no documento (nome, especialidade, registro, consultório e marca, sem convênios nem configurações internas). Só o próprio paciente (mesmo e-mail) recebe. Aplicada em 13/11/2026; o visitante sem login continua sem acesso à função.

## 13/11/2026 — Agenda em grade semanal e visão do mês

- A agenda tem três visões, em pílulas ao lado de "Hoje": **Lista** (a de antes), **Semana** (grade com colunas por dia e sessões no horário, do tamanho da duração) e **Mês** (calendário com as sessões de cada dia). A última visão escolhida é lembrada.
- Na Semana: clicar numa sessão abre a edição; clicar num espaço vazio do dia agenda; bloqueios aparecem hachurados; cores por situação (agendada, realizada, falta, cancelada); ✓ quando o paciente confirmou.
- No Mês: clicar no dia abre aquela semana em lista; dias bloqueados aparecem hachurados; no celular, as sessões viram pequenas barras.

## 13/11/2026 — Busca mais completa e progresso no relatório por período

- **Busca (Ctrl K)** agora acha também sessões (por nome do paciente ou data, 60 dias para trás e para frente, levando à semana certa da agenda), cobranças em aberto por paciente (quantidade e total) e as páginas do Financeiro e da Agenda.
- **Relatório por período** ganha a seção "Progresso das metas e escalas": a situação de cada meta, em quantas das sessões escolhidas ela foi trabalhada, e a primeira e a última pontuação de cada escala no período. É montada a partir dos registros, sem IA, e pode ser editada como qualquer seção.

## 13/11/2026 — Editor do relatório revisado

- **Barra fixa no topo** que acompanha a rolagem: paciente, situação, "Tudo salvo" e o botão do próximo passo (Marcar como revisado ou Liberar ao paciente). No celular, fica numa linha só.
- **Exportar** virou um menu (prévia do portal, Word para editar, PDF, só seções visíveis). **⋯** reúne retirar do portal, voltar para rascunho, levar dados da anamnese ao cadastro e excluir.
- **Metas trabalhadas** foram para logo abaixo do texto. O lado direito ficou só com o caminho Rascunho → Revisado → Liberado, com o check se desenhando.
- Correções: "Criado em" sem data, título com a mesma fonte da plataforma, "Salvar agora" virou link discreto (o salvamento automático continua).

## 13/11/2026 — Pacientes e Relatórios em cartões

- **Pacientes:** cartões com as iniciais em círculo colorido, última sessão, número de registros e avisos (sem consentimento, rascunhos, arquivado, teste). Filtros viraram pílulas; o topo mostra quantos estão em atendimento.
- **Relatórios:** cada registro é um cartão com faixa colorida por tipo (evolução, anamnese, período, documento), paciente e data numa linha. A situação (Todos, Rascunho, Revisado, Liberado) virou pílulas; paciente, tipo e datas ficam em "Mais filtros". A seleção de vários continua igual.

## 13/11/2026 — Configurações em cartões

- Configurações abre com um cartão por seção (Perfil e timbre, Aparência e marca, Preferências, Chaves de IA, Consentimento, Segurança, Dados e privacidade): ícone, uma linha de descrição e um estado curto ("Completo", "Falta o registro", "Personalizada", "Sem IA", "1 conectada").
- Ao abrir uma seção, o título é o nome dela e há "voltar" para Configurações. A lista lateral de seções continua para trocar rápido.

## 13/11/2026 — Ficha do paciente em abas

- A ficha do paciente ganhou abas: **Resumo** (próximas sessões, observações, consentimento, portal, arquivar/excluir), **Clínico** (plano terapêutico, linha do tempo, escalas), **Financeiro** e **Arquivos e links**. A última aba aberta é lembrada durante a visita.
- Os botões do topo (Nova evolução, Agendar, Registrar, Enviar por link, Exportar, Editar) continuam visíveis em todas as abas.
- O texto do Portal do paciente na ficha foi corrigido: o paciente entra pelo Portal e cria a senha no primeiro acesso (não existe mais "criar conta como Paciente").

## 13/11/2026 — Backup completo e Novidades no Início

- "Baixar backup completo" passou a levar tudo: pacientes, consentimentos, relatórios e versões, sessões, bloqueios, lista de espera, valores e forma de cobrança, cobranças, recibos, gastos, metas, escalas e pontuações, links enviados, respostas da pesquisa, modelos e o perfil.
- Novo bloco **Novidades** no topo do Início, com o que os pacientes fizeram nos últimos 14 dias: anamnese respondida, presença confirmada, pedido para remarcar (destacado), orientações e relatório abertos, pesquisa respondida. Cada item leva à tela certa; "Marcar como visto" esconde até chegar algo novo.

## 13/11/2026 — Animações pela plataforma

- Aviso de "salvo" com um check que se desenha; janelas abrem subindo e fecham mais rápido; painéis e números aparecem em sequência.
- Números dos resumos do Financeiro sobem contando; barras do resumo crescem; a linha do gráfico de escalas se desenha.
- Agenda desliza para o lado ao trocar de semana; o chip "confirmado" dá um pulinho; um gasto excluído encolhe antes de sumir.
- Comemoração com uma flor que se abre no primeiro paciente cadastrado e no primeiro relatório liberado (uma vez só, neste navegador).
- Tudo desligado para quem pede menos movimento. Funções novas em `js/ui.js`: `celebrar()` e `sumir()`.

## 13/11/2026 — "Por que Potira?" e animações na apresentação

- Nova seção no fim da apresentação, também no menu do topo ("O nome"): o significado de Potira (tupi, "flor"), por que o nome foi escolhido e curiosidades. Resumo também em Sobre.
- Os blocos da apresentação aparecem suavemente ao rolar a página, e a flor da seção do nome se mexe devagar. Tudo desligado para quem pede menos movimento.
- Regra de animações registrada em DIRETRIZES; telas que ainda não têm animação, listadas em PENDENCIAS.

## 12/11/2026 — Apresentação como tela principal

- Quem abre o site sem estar logado vê a **apresentação da Potira**: recursos, como funciona, para quem é, dúvidas frequentes e rodapé com Termos e Privacidade.
- No topo ficam **Entrar** e **Portal do paciente**. "Criar minha conta" e "Já tenho conta" ficam no destaque.
- Endereços de entrada: `#/entrar`, `#/criar-conta`, `#/paciente` e, com a marca do profissional, `#/c/nome` e `#/paciente/nome` (estes continuam abrindo direto a tela de login). A tela de login ganhou o link "Conhecer a Potira".
- O arquivo `apresentacao.html` virou só um redirecionamento para a tela principal (uma única apresentação para manter). Em Sobre, o botão abre `./?apresentacao`, que mostra a apresentação mesmo para quem está logado.
- Código: `js/views-landing.js`.
- Clínica: respostas do James registradas em `docs/CLINICA.md` (nada implementado).

## 12/11/2026 — Portal do paciente com entrada própria

- "Criar conta" passou a ser **só para profissionais**. Saiu a escolha "Sou profissional / Sou paciente".
- O paciente entra por uma página só dele, o **Portal do paciente** (`#/paciente`, ou `#/paciente/link-próprio` com a marca do profissional), com "Entrar" e "Primeiro acesso". No primeiro acesso ele usa o mesmo e-mail que informou ao profissional e cria a senha.
- Na tela de entrada do profissional há o atalho "É paciente? Portal do paciente"; no portal, o atalho "Entrar como profissional".
- A página pública do profissional passou a apontar para o Portal do paciente.

## 12/11/2026 — Cadastro só de profissional ou paciente

- Por decisão do James, **não existe cadastro de secretária(o)**. Saíram a opção "Sou secretária(o)" em Criar conta e a aba Equipe em Configurações. Quem cria conta é profissional ou paciente.
- O acesso de equipe volta no futuro como parte da **conta de clínica**, com layout próprio (ver pendências, seção 3B). A base no banco (schema v15) e o modo secretária no código continuam lá, sem entrada pela tela.

## 12/11/2026 — Modelos de documento com novo layout

- A tela mostra os **tipos de documento** em destaque (Anamnese, Evolução, Relatório por período), com filtro por tipo.
- Cada modelo virou um cartão curto: nome, quantidade de campos, área e selos (Meu, Da Potira, Padrão, Com timbre). A lista de campos saiu da tela.
- Abrir um modelo próprio leva ao editor. Abrir um modelo da Potira mostra os campos para leitura, com o botão "Editar uma cópia".
- "Enviar documento meu" virou um botão no topo, no lugar do bloco grande.

## 12/11/2026 — Sobre em página própria

- "Sobre a Potira" saiu da Ajuda e virou uma página própria (`#/sobre`), aberta pelo link no rodapé do menu e pelo item em "Mais" no celular. A Ajuda ficou só com o passo a passo e o tour.

## 12/11/2026 — Secretária, página pública do profissional e portal do paciente

Banco: schema **v15** (aplicado com a aprovação do James).

- **Acesso de secretária(o):** o profissional libera um e-mail em Configurações → Equipe. A pessoa cria a conta como "Sou secretária(o)" e entra direto na **agenda e no financeiro** daquele profissional: agenda, lembretes, lista de espera, frequência, declarações, cobranças, gastos, resumo, valores e recibos. Não vê relatórios, anamneses, evoluções nem a ficha do paciente; cadastra só nome, telefone e e-mail. Não altera dados de pagamento, convênios nem a opção de cobrar faltas.
- **Página pública do profissional** em `#/p/link-próprio`: apresentação, áreas de atuação, cidade e botão de WhatsApp. Ligada em Configurações → Aparência e marca.
- **Portal do paciente:** próximas sessões com "Confirmo" e "Preciso remarcar", e lista de recibos (número, data e valor).
- O número do recibo passou a vir do banco, para a secretária também emitir.

**Correção importante**
- Salvar "Aparência e marca" apagava os dados de pagamento (chaves PIX), os convênios, a sequência de recibos e a opção de cobrar faltas, porque regravava a marca sem preservar o resto. Agora preserva. "Voltar ao padrão" também passou a manter esses dados.

## 12/11/2026 — Pasta dos documentos no computador

- Em Configurações → Dados e privacidade, o profissional escolhe uma pasta do computador. A plataforma cria uma subpasta por paciente, com Relatórios, Recibos, Cobranças e Laudos e exames.
- Vão direto para a pasta: documentos em Word (relatório, prontuário, recibo, orçamento, declaração, frequência), a mensagem de cobrança em texto e os **laudos e exames anexados** na ficha do paciente.
- A ficha do paciente lista os arquivos da pasta, abre e exclui.
- O PDF continua saindo pela janela de impressão; a pasta do paciente já fica criada e um aviso diz onde salvar.
- Funciona no Chrome e no Edge do computador. Em outros navegadores e no celular, os arquivos continuam sendo baixados. A plataforma não guarda cópia dos arquivos.

## 12/11/2026 — Agenda, plano terapêutico, financeiro completo e apresentação

Banco: schemas **v13** e **v14** (aplicados). O schema **v15** está escrito mas **não aplicado** (ver pendências).

**Início e agenda**
- Início: "Sessões de hoje" com botões Iniciar, Falta e Evolução; botão "Lembretes de amanhã"; aniversariantes do mês com mensagem pronta.
- Lembretes em lote pelo WhatsApp. Cada mensagem leva um link para o paciente **confirmar a presença ou pedir para remarcar**; a resposta aparece na agenda e no Início.
- Reagendar com um toque (mesmo paciente, horário e duração, uma semana depois). Excluir uma sessão ou a série inteira que se repete.
- Bloqueio de dia ou horário (feriado, folga), com aviso ao agendar por cima.
- Lista de espera, com botão para chamar pelo WhatsApp.
- Exportar as sessões dos próximos 90 dias para o calendário do celular (.ics).
- Pesquisa de satisfação anônima por link (nota de 0 a 10 e comentário), com resumo em Administrativo → Pesquisa.

**Clínico**
- Plano terapêutico: metas por paciente, com prazo e situação. A evolução marca as metas trabalhadas e a ficha mostra em quantas sessões cada meta apareceu.
- Escalas criadas pelo profissional, aplicadas por paciente, com gráfico da pontuação.
- Orientações para casa por link, com registro de quando o link foi aberto.

**Financeiro**
- Cada paciente paga **por sessão, mensalidade ou pacote**. Mensalidade: a cobrança do mês nasce sozinha e as sessões entram quitadas. Pacote: vende-se o pacote, o saldo de sessões diminui a cada sessão realizada.
- Cobrança avulsa (avaliação, material, taxa).
- Convênio que paga fica separado do paciente em "Em aberto".
- **Gastos** (antes Despesas): editar, gasto fixo que se repete todo mês, pago ou a pagar, totais por categoria.
- **Resumo:** entradas e saídas dos últimos 6 meses com gráfico, por forma de pagamento e por categoria, e planilha para o contador.
- Recibos emitidos ficam guardados, com segunda via no mesmo número.
- Registrar pagamento guarda quem pagou, lido do comprovante. O arquivo do comprovante não é guardado.

**Produto**
- Tour de primeiro acesso em cinco passos (pode ser revisto na Ajuda).
- Página de apresentação da Potira: `apresentacao.html`.
- Contraste automático: tema de cor clara usa uma versão mais escura em botões e links; o menu mantém a cor escolhida.

**Correções**
- A animação de entrada das telas deixava o conteúdo por cima dos menus suspensos; alguns itens não recebiam o clique.
- Plural "sessões" em contadores.
- "Atendimentos de hoje" virou "Sessões de hoje".

## 12/11/2026 — Documentação, menu colorido e animações

- Documentação do projeto no repositório: README (Sobre), diretrizes, atualizações, pendências e `CLAUDE.md`.
- **Sobre a Potira** dentro do sistema: link no rodapé do menu, item em "Mais" no celular e botão no topo da Ajuda.
- **Menu colorido:** o menu lateral e a barra de baixo do celular usam a cor do tema do profissional (Configurações → Aparência e marca), com versão para tema escuro. Se a cor escolhida for clara, o texto do menu fica escuro.
- **Animações discretas:** entrada das telas, abertura de janelas e menus, e resposta ao passar o mouse e ao tocar. Ficam desligadas para quem pede menos movimento no aparelho.

## 12/11/2026 — Financeiro e Administrativo revisados, cobrança agendada e comprovante

Banco: schema **v12**.

**Financeiro**
- "Em aberto por paciente" passou a considerar todos os meses. Antes, a dívida sumia ao trocar o mês.
- "Recebido no mês" passou a usar a data do pagamento. "A receber" mostra o total em aberto.
- O valor da sessão é gravado quando a sessão é realizada; mudar o preço não altera sessões antigas.
- **Registrar pagamento:** lê o comprovante (PDF sem IA; foto ou print com IA), propõe valor e data, marca as sessões mais antigas que cabem no valor e só salva depois da confirmação do profissional. O arquivo não é guardado.
- **Cobrança agendada:** dia fixo do mês (1 a 28) ou data avulsa, por paciente. No dia, aparece "Cobrar hoje" em Financeiro e um aviso no Início. Enviar a cobrança encerra o agendamento do período.
- Opção de cobrar faltas sem justificativa (Financeiro → Valores).
- Dia de cobrança por paciente na aba Valores.
- Tabelas de cobranças, valores e despesas ganharam colunas (antes saíam empilhadas) e versão para celular.
- Chave PIX de telefone é convertida para o formato do PIX (+55…). Número de 11 dígitos é tratado como CPF quando os dígitos verificadores conferem.
- Texto do orçamento corrigido ("sessões no mês").

**Administrativo**
- Aviso de conflito quando já existe sessão no mesmo horário.
- Dias sem sessão em uma linha, com atalho "Agendar" em cada dia.
- Aviso ao excluir sessão realizada ou com pagamento registrado.
- Pacientes arquivados não aparecem ao agendar.
- Declaração de comparecimento não é emitida sem sessões realizadas.
- Botão "Lembrete" com texto (antes era só um ícone).
- Textos corrigidos ("da primeira sessão", "sessão avulsa").

**Ficha do paciente e links**
- Ações do topo agrupadas: Nova evolução, Agendar sessão e os menus Registrar, Enviar por link e Exportar.
- Painel financeiro com Definir valor, Agendar cobrança e Registrar pagamento.
- Anamnese: botão "Atualizar cadastro" leva nascimento, responsáveis e diagnóstico para a ficha, com conferência.
- Página pública do link mostra a marca do profissional e não trata quem responde como se fosse o paciente.
- Timbre do modelo enviado vale também no prontuário completo e no relatório por link.
- Menu: "Relatório por período" e "Modelos de documento".

## 12/11/2026 — Anamnese por link com campos editáveis, timbre do modelo e fechar janelas

Banco: schema **v11**.

- **Anamnese por link:** começa com Nome completo, Nomes dos pais ou responsáveis, Data de nascimento, Diagnóstico e Queixa principal. O profissional edita, reordena, remove e acrescenta perguntas antes de gerar o link. Pode partir de um modelo ou da última lista usada.
- **Modelo enviado em Word (.docx):** além dos campos, preserva logo, marca d'água, cabeçalho e rodapé do documento, e usa nos relatórios feitos com o modelo. Ao salvar, vira o modelo padrão (evolução ou anamnese).
- **Janelas:** X no canto superior direito; clicar fora fecha quando nada foi digitado.

## 10/11/2026 — Nome Potira, novo visual e tutoriais

- A plataforma passou a se chamar **Potira** (antes Florescer Relatórios).
- Novo visual em cartões: menu e topo em cartões, Início em painel e tema escuro.
- Tutoriais passo a passo para conectar as chaves de IA (pasta `tutoriais/`).

## 08/11/2026 — Cobrança, links públicos e módulos Administrativo e Financeiro

Banco: schema **v10** (links públicos e registro de exportações).

- **Cobrança:** mostra só a quantidade de sessões e o total, sem datas, horários e valor unitário. A cobrança em Word foi removida.
- Chave PIX aparece na mensagem e no PDF; outras chaves PIX cadastráveis e escolha na hora de cobrar; chave editável na janela de cobrança.
- Registrar a evolução marca a sessão agendada do dia como realizada.
- Janela de cobrança com mensagem editável, copiar, baixar (.txt e PDF) e WhatsApp; código PIX copia-e-cola.
- Agendar sessão e cobrar pela ficha do paciente; lista "Próximas sessões".
- **Links públicos:** anamnese para o paciente responder sem login e relatório para ler e baixar, com validade e senha opcional.
- Lembrete de sessão pelo WhatsApp.
- Declarações revisadas (datas e o termo "sessão"); recibo com número sequencial e valor por extenso.
- Botão Voltar na barra superior.
- Pasta do paciente com resumo financeiro e auditoria em PDF.
- **Financeiro:** cobranças, valores por paciente, despesas, orçamento, recibo e dados de pagamento.
- **Administrativo:** agenda semanal, folha de frequência, declarações e convênios. Botão "Mais" no celular.
- Editor de modelos em página inteira; modelos por área (o profissional vê os da área dele, os Gerais e os próprios); modelos de terapia ocupacional.

## Versões anteriores

### Novidades da versão 4 (design)
- Tema claro, escuro ou automático; tamanho da letra (normal, grande, extra) e alto contraste, em Configurações → Aparência e marca (vale por aparelho).
- Carregamento com esqueletos, telas vazias com orientação, áreas de arrastar arquivo (logo, assinatura, áudio, documento-modelo).
- Início com números e últimos 7 dias; ficha do paciente com linha do tempo única.
- Editor: transcrição ao lado do texto; no celular, uma seção aberta por vez; botão de gravar fixo na sessão.
- Atalhos: Ctrl K, Ctrl S, Alt N, Alt H e `?` para ajuda.
- Estilo dos documentos (letra, margem, cabeçalho) e prévia do PDF antes de imprimir.
Não exige mudança no banco.

### Registro profissional e redes (versão 4.1)
Em Configurações → Perfil: conselho, número, UF, categoria e links (Instagram, site, outra rede). O paciente vê isso no portal. Não há verificação automática. **Rode o `supabase/schema.sql` de novo** (cria a coluna `credentials` e atualiza a função do portal).

### Texto com formatação (versão 4.2)
Campos longos do relatório têm barra de formatação (negrito, itálico, sublinhado, listas, título, alinhamento). Vale no editor, no portal e nas exportações. Sem mudança no banco.

### Documento livre (versão 4.3)
Na ficha do paciente, "Novo documento": página livre com formatação e tabelas. O paciente só vê depois de revisado e liberado. Exige a atualização do `reports_kind_check` (já em `supabase/schema.sql`).

### Versão sem cache
`python3 tools/stamp.py` carimba a versão em `index.html` (mapa de módulos). Roda sozinho antes de cada commit; assim o navegador não mostra uma versão antiga.

### v5 — Administração
Painel `#/admin` (só para quem tem `is_admin`): modelos do sistema, textos padrão (consentimento, rodapé, áreas), nomes dos modelos de IA, aviso geral, lista de profissionais (ativar/desativar) e tópicos extras da Ajuda. O administrador não acessa pacientes, relatórios nem transcrições. SQL em `supabase/admin.sql`. Para conceder o acesso: `update public.profiles set is_admin = true where id = (select id from auth.users where email = 'SEU@EMAIL');`

#### v5.1
Admin: uso (só totais), convites (exigência opcional, desligada por padrão), registro de ações com "Desfazer", resetar autenticador, serviços de IA extras (compatíveis com OpenAI) e lista de modelos por serviço. Autenticador (TOTP) opcional em Configurações → Segurança, desligado por padrão; quem perde o aparelho usa "Perdi meu autenticador" (link por e-mail) ou pede reset ao admin. SQL em `supabase/admin2.sql`.

### Novidades da versão 3

- **IA opcional.** O sistema funciona sem nenhuma IA (você grava ou digita e escreve o relatório no editor). Com IA, escolha o provedor: **Google Gemini** e **Groq** têm plano gratuito; **Claude** e **OpenAI** são pagos. A conexão pode ser feita no cadastro, no primeiro acesso ou em Configurações → Chaves de IA, com botão de testar. Atenção à LGPD: em planos gratuitos o provedor pode usar o conteúdo enviado; o sistema nunca envia o nome do paciente.
- **Anamnese e Evolução.** Cada paciente tem anamnese (entrevista inicial, com modelos por área) e evoluções por sessão, além dos relatórios por período, que podem incluir a anamnese como contexto.
- **Edição a qualquer momento.** O relatório pode ser aberto durante a sessão (com bloco de anotações) e continua editável depois de revisado ou liberado. Alterações em relatório liberado pedem confirmação, e as versões anteriores ficam no Histórico, com botão de restaurar.
- **Modelos a partir dos seus documentos.** Envie .docx, PDF ou foto (foto exige IA com visão: Gemini, Claude ou OpenAI). O sistema monta um modelo de campos (texto, data, sim/não, escolha) que você ajusta. Ele reproduz a **estrutura** do documento, não o layout visual exato.
- **Marca própria.** Em Configurações → Aparência: logo, cores, nome, frase de login, rodapé e assinatura. A tela de login mostra a sua marca, pelo link próprio `…/#/c/seu-nome` ou pela última marca usada no navegador.
- **Áudio melhor.** Ganho ajustável com compressor, medidor de volume, escolha de microfone, teste de 5 segundos com reprodução e captação opcional do áudio da aba (teleconsulta).
- **Prontuário completo** em PDF ou Word, por paciente.

> Depois de atualizar, rode de novo `supabase/schema.sql` no SQL Editor (é seguro repetir).

### O que há de novo na versão 2 (interface redesenhada)

- **Início orientado à ação**: escolha o paciente e inicie a sessão; fila de "o que precisa da sua atenção" (rascunhos, relatórios revisados não liberados, pacientes sem consentimento) e checklist de configuração.
- **Busca rápida (Ctrl+K)** por páginas, pacientes e relatórios.
- **Nova sessão em 3 passos**: paciente e modelo, captação (gravar ou enviar áudio, transcrição editável), opções da IA (nível de detalhe, marcar trechos `[verificar]`, instruções extras).
- **Editor de relatório com controle por seção**: reordenar, ocultar do paciente (ícone de olho), reescrever uma seção com IA, remover; salvamento automático; fluxo Rascunho → Revisado → Liberado; prévia do portal; exportar só o que o paciente vê.
- **Lista de relatórios com filtros e ações em lote** (revisar, liberar, retirar, excluir).
- **Preferências**: detalhamento padrão da IA, instruções permanentes, modelo padrão, padrão de título, salvamento automático.
- **Dados**: backup completo em JSON, planilha CSV de pacientes e registro de atividades.

> **Atualizando de uma versão anterior?** Execute novamente `supabase/schema.sql` no SQL Editor (é seguro repetir). Ele adiciona a coluna `preferences` e atualiza o portal para respeitar a visibilidade por seção.

### Logo do profissional no menu
- A logo enviada agora aparece sempre numa caixa branca, com contorno fino, no menu e no topo. Antes, em alguns temas, a logo com fundo colorido se misturava com a cor do menu e parecia um bloco estranho.

### Sessões na grade da agenda cabem na caixa
- O texto de cada sessão (hora e nome do paciente) fica dentro do bloco. Nomes longos são cortados com "..." conforme o espaço da sessão, e o nome completo aparece ao passar o mouse.

### Agenda: botão Dia removido, "Ver dia" na lista
- Saiu o botão Dia. Na Lista, cada dia tem "Ver dia" ao lado de "Agendar", que abre só aquele dia.
- Na tela de um dia, "Voltar para a lista" leva de volta à semana.
- No celular, a agenda abre na Lista (antes abria no Dia).
- Menu "Ações" da agenda abre alinhado à direita do botão, sem cortar.

### Bloqueios que se repetem (almoço, seg a sex) e encaixes
- Em Ações → "Bloqueios que se repetem", o profissional cria uma regra: horário, motivo e dias da semana. A regra vale em todos esses dias, na grade e na lista, e avisa ao tentar agendar por cima.
- Na faixa de cada dia: "Liberar neste dia" libera só aquela data. Depois aparece "Bloquear de novo" para voltar atrás. Os outros dias continuam bloqueados.
- Agendar dentro de um horário bloqueado continua permitido após confirmar. A sessão fica marcada como "Encaixe" na lista.
- Migração v18 (tabelas `agenda_rules` e `agenda_rule_releases`, coluna `appointments.encaixe`), aplicada no Supabase e conferida. A exportação de backup inclui as duas tabelas novas.
- Testado no ambiente simulado: criar a regra (5 dias), liberar um dia, bloquear de novo e agendar com encaixe. Não testado com dados reais.

### Pedido de remarcação: sugerir horários
- Quando o paciente pede para remarcar, a sessão aparece como pedido na agenda (chip "pedido de remarcação") e no Início, em "O que precisa da sua atenção".
- Botão "Sugerir horários" mostra os horários livres dos próximos 7 dias (seg a sáb, das 08h às 22h, de 30 em 30 min), sem sessão e sem bloqueio. O profissional marca os que pode oferecer e a mensagem sai pronta para o WhatsApp. Depois, marca com "Reagendar".
- A grade da agenda agora mostra sempre das 08h às 22h.
- Testado no ambiente simulado. Não testado com dados reais. Domingo fica fora da sugestão.

### Agenda: botão Hoje só aparece quando não está em hoje
- Na Lista, Semana e Mês, o botão Hoje some quando o período mostrado já inclui hoje.
- Testado no ambiente simulado (lista, semana e mês). Não testado com dados reais.
