# Atualizações da Potira

Histórico do que foi feito, da mudança mais nova para a mais antiga. Cada entrega nova deve ganhar uma entrada no topo.

Sobre o que ainda falta, veja [PENDENCIAS.md](PENDENCIAS.md). Sobre as regras do projeto, veja [DIRETRIZES.md](DIRETRIZES.md).

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
