# Pendências da Potira

O que foi proposto e ainda não foi feito, e o que foi feito mas ainda precisa de revisão ou teste. Quem pegar um item deve seguir as [DIRETRIZES.md](DIRETRIZES.md) e, ao concluir, tirar o item daqui e registrar em [ATUALIZACOES.md](ATUALIZACOES.md).

Última revisão desta lista: 12/11/2026.

## 1. Feito, mas ainda não conferido com dados reais

Estes itens foram testados só no ambiente de teste (dados simulados). O que se espera de quem revisar: usar a plataforma publicada com uma conta real, confirmar o comportamento descrito e corrigir se divergir.

| Item | O que conferir |
| --- | --- |
| Sessão marcada como realizada automaticamente | Agendar uma sessão para hoje, registrar a evolução do mesmo paciente com a data de hoje e ver se a sessão vira "Realizado", com o valor gravado, e aparece em Financeiro. |
| Atualizar cadastro pela anamnese | Responder uma anamnese por link, abrir o rascunho, clicar em "Atualizar cadastro" e ver nascimento na ficha, responsável no Administrativo e diagnóstico nas Observações. |
| Leitura de comprovante | PDF de comprovante PIX de bancos diferentes (valor e data corretos). Foto ou print com IA conectada (Gemini, Claude ou OpenAI). |
| Timbre de modelo enviado em Word | Enviar um Word real da clínica com logo, marca d'água, cabeçalho e rodapé. Conferir a prévia do PDF. Documentos com imagem EMF/WMF não têm a imagem lida. |
| Cobrança agendada | Definir dia fixo e data avulsa; ver "Cobrar hoje" em Financeiro e o aviso no Início; enviar e ver o selo sair até o mês seguinte. |
| Cobrança em PDF e recibo | Abrir o PDF gerado e conferir chave PIX, total e código copia-e-cola pagando um valor baixo de teste. |
| Chave PIX de telefone | Gerar código com chave de telefone e testar no aplicativo do banco. |
| Página pública com a marca | Abrir um link de anamnese e um de relatório num celular sem login e ver logo, nome e cor do profissional. |
| Cobrar faltas | Ligar a opção, marcar uma falta e ver a cobrança aparecer. |
| Menu colorido | Trocar a paleta em Configurações → Aparência e marca e ver o menu mudar, no claro e no escuro. |
| Lembrete com confirmação | Enviar um lembrete para o próprio número, abrir o link, confirmar e pedir para remarcar; ver a resposta na agenda. |
| Mensalidade | Definir mensalidade para um paciente, abrir Financeiro → Cobranças no mês e ver a cobrança criada; realizar uma sessão e ver "Da mensalidade". |
| Pacote | Vender um pacote, realizar sessões e ver o saldo cair; voltar uma sessão para "Agendado" e ver o saldo voltar. |
| Convênio que paga | Marcar em Valores → Alterar e ver as sessões irem para o grupo do convênio. |
| Gastos fixos | Criar um gasto fixo num mês e ver se entra sozinho, como "a pagar", no mês seguinte. |
| Resumo e planilha | Conferir entradas e saídas com os lançamentos e abrir o CSV no Excel. |
| Metas, escalas e orientações | Criar meta, marcar na evolução, aplicar escala duas vezes (gráfico) e enviar orientações por link. |
| Bloqueio, série e reagendar | Bloquear um dia, tentar agendar por cima, excluir uma série e reagendar uma falta. |
| Pesquisa de satisfação | Responder pelo celular e ver a nota em Administrativo → Pesquisa. |
| Calendário (.ics) | Abrir o arquivo no celular (Android e iPhone) e conferir horários. |
| Página pública do profissional | Ligar em Aparência e marca, definir o link próprio e abrir `#/p/<link>` num celular sem login. |
| Portal do paciente | Entrar como paciente (mesmo e-mail do cadastro), ver as próximas sessões, confirmar e conferir na agenda do profissional. Emitir um recibo e ver na lista. |
| Pasta dos documentos | No Chrome ou Edge do computador: escolher a pasta, anexar um laudo, exportar um Word e conferir no Explorador de Arquivos. Fechar e reabrir o navegador e ver se a pasta continua lembrada (não foi possível testar o seletor de pastas nem a pasta lembrada fora de um computador real). |

- **Animações de 13/11/2026:** testadas no simulado (aviso com check, flor de comemoração, janela fechando). Conferir no site real: agenda trocando de semana, gráfico de escalas, números do resumo e excluir gasto. O teste antigo `run-fin.js` está desatualizado (procura um campo que não existe mais).
- **Tela principal de apresentação** (12/11/2026): testada só em ambiente simulado (computador e celular). Falta abrir o site publicado sem estar logado e conferir Entrar, Criar conta e Portal do paciente; conferir também o link antigo `apresentacao.html` e o botão "Página de apresentação" em Sobre.

## 2. Proposto e ainda não implementado

- **Animações: referências e ideias** (pesquisa de 13/11/2026). Feitas em 13/11: check no aviso de salvo, janelas abrindo e fechando, painéis em sequência, números do resumo contando, gráfico de escalas se desenhando, barras do resumo crescendo, agenda deslizando ao trocar de semana, chip "confirmado" com pulinho, gasto excluído encolhendo, flor no primeiro paciente e no primeiro relatório liberado, blocos em cinza ao carregar (já existia).
  Ainda dá para estender: encolher ao apagar em outras listas (pacientes, cobranças, modelos), linha da cobrança mudando de cor ao registrar pagamento, check desenhado no botão ao salvar a evolução.
  Referências: design systems [Univ. de Michigan](https://design-system.lib.umich.edu/visual-elements/motion), [Sprout Social](https://seeds.sproutsocial.com/visual/motion/), [Coloplast](https://designsystem.coloplast.com/latest/build/foundations/motion/overview-wa6mnzNW), [Toyota](https://dx-playbook.toyota-europe.com/cds/foundations/animations/); guias [Linearity](https://www.linearity.io/blog/ui-animation-guide/), [7 princípios (Funnel)](https://gunnel.funnel.io/18/01-guidelines/7_animation-principles); inspiração [Awwwards microinterações](https://www.awwwards.com/websites/microinteractions/), [Nervana Health](https://www.awwwards.com/inspiration/scrolling-to-expand-nervana-health); CSS puro [rolagem](https://dev.to/raxxostudios/css-scroll-driven-animations-6-patterns-i-ship-in-2026-4bm6), [microanimações](https://dev.to/imran_khan_a3cc224344dbcf/micro-animation-css-complete-guide-examples-2026-398b).
- **Confirmar com o James a história do nome:** o texto diz que Potira (tupi, "flor") manteve o sentido de Florescer. Se houver outro motivo ou curiosidade, acrescentar.

**Cobrança enviada sozinha (automática de verdade)**
Hoje a cobrança agendada fica pronta e o profissional envia. Enviar sem ninguém tocar exige um serviço externo:
- por e-mail: função agendada no Supabase mais um serviço de envio (há plano gratuito), usando o e-mail do paciente. É o caminho possível sem custo;
- por WhatsApp: só com a API oficial, que é paga.
O James perguntou se era possível; a resposta foi dada e ele ainda não decidiu. **Não implementar sem ele escolher o caminho.**

**Comprovante guardado**
Decidido pelo James em 12/11/2026: **não guardar o arquivo**. Guardam-se só as informações do pagamento (valor, data, forma e quem pagou).

**Uso sem internet (offline)**
O James pediu para deixar de fora. Não implementar sem novo pedido.

**Nota fiscal**
O James quer emissão de nota fiscal no futuro. Fica para depois.

## 3. Achados da revisão que ainda não foram tratados

**Financeiro**
- O número do recibo avança mesmo se o profissional cancelar a impressão (o recibo fica guardado, com segunda via).
- **Recibo em PDF no portal: código pronto em 13/11/2026, falta aplicar a migração v16** (fim de `supabase/schema.sql`, só troca a função `portal_overview`). Enquanto não for aplicada, o portal continua sem o botão PDF e mostra "peça ao(à) profissional". Recibos emitidos antes também têm o conteúdo guardado, então ganham o botão.
- A secretária não vê a aba Pesquisa nem Convênios, e não usa a pasta de documentos por paciente com dados clínicos (só os administrativos).
- Controle de convênio é simples: separa o que o convênio deve, sem guias nem faturamento por lote.
- O recibo considera as sessões pagas pelo mês da sessão, não pelo mês do pagamento.
- Editar um valor na tabela de sessões recarrega a tela inteira.
- Pagamento parcial de uma sessão não existe: a sessão é paga inteira ou fica em aberto.

**Administrativo**
- ~~Sem visão de mês~~ Feito em 13/11/2026 (Lista, Semana em grade e Mês). Visão de um dia só ainda não existe.
- A evolução é ligada à sessão só por paciente e data; duas sessões no mesmo dia confundem.

**Design**
- O campo de data da página pública segue o idioma do navegador de quem abre.

**Desempenho**
- A lista de modelos carrega as imagens do timbre de todos os modelos a cada tela que usa modelos. Com muitos modelos importados pode ficar lento.

## 3B. Conta de clínica (desenhada, não implementada)

O desenho completo, com papéis, permissões, layout e as perguntas em aberto, está em **[CLINICA.md](CLINICA.md)**. Resumo do que o James definiu em 12/11/2026:

- Duas contas separadas: **profissional autônomo** (como hoje) e **clínica** (com profissionais e secretárias).
- **Dono da clínica:** acesso total à administração; não vê relatórios nem nada clínico.
- **Secretária(o):** entra pela clínica e vê só o que o dono permitir.
- **Profissional da clínica:** só o clínico dos pacientes dele; não vê valores nem administração.
- Não existe cadastro de secretária avulso. "Criar conta" é só para profissional; o paciente entra pelo Portal do paciente.
- O gestor pode não ser profissional de saúde. Um mesmo e-mail pode ter vários perfis, com um botão de troca no estilo do botão de tema.
- O gestor cria o perfil da clínica e convida os profissionais.
- Respondido em 12/11/2026 (noite): o profissional da clínica conta as próprias sessões e só vê o valor da sessão se o gestor permitir; nenhum profissional vê registro de outro (só o paciente vê os seus, de todos); um dono principal, que pode habilitar outro administrador.
- **Em espera:** o que acontece com os registros quando um profissional sai da clínica (pergunta 4 do CLINICA.md).
- **Continua sem implementar: o James pediu só o mapeamento.** Programar apenas quando ele pedir.

## 3C. Ideias ainda não feitas

- **Instalar como aplicativo** (ícone na tela do celular). O James pediu para **não fazer ainda**.
- **PDF gravado direto na pasta.** Hoje o PDF sai pela janela de impressão do navegador, então a plataforma só prepara a pasta e avisa onde salvar. Gravar sozinho exigiria gerar o PDF dentro do site com uma biblioteca, com risco de perder qualidade. Não decidido.
- A tabela `attachments` e a pasta privada `anexos` do Supabase existem, vazias e sem uso: o James decidiu guardar laudos e exames **na pasta do computador**, não no servidor. Podem ser removidas numa limpeza.
- **Cobrança enviada sozinha** (por e-mail), ver seção 2.

## 3D. Melhorias propostas em 12/11/2026 (tarde), nenhuma aprovada ainda

**Confiabilidade**
1. ~~Backup incompleto~~ **Feito em 13/11/2026:** o backup agora leva todas as tabelas do profissional e o perfil (com marca e dados de pagamento). Falta baixar um com conta real e conferir.
2. **Teste com conta real.** Quase tudo desta rodada foi testado só com dados simulados. Esperado: percorrer o roteiro da seção 1 no site publicado, com uma conta de teste.
3. ~~Avisos para o profissional~~ **Feito em 13/11/2026:** bloco "Novidades" no Início (anamnese respondida, presença confirmada, pedido de remarcação, orientação e relatório abertos, pesquisa respondida, dos últimos 14 dias). O "visto" fica guardado no navegador. Testado só no simulado; conferir com um link real. Ainda não avisa por e-mail nem por notificação.

**Telas que ainda têm texto demais ou não foram revisadas**
4. ~~Ficha do paciente longa~~ **Feito em 13/11/2026:** abas Resumo, Clínico, Financeiro e Arquivos e links. Testado no simulado; conferir com um paciente real cheio de registros.
5. ~~Configurações com muito texto~~ **Feito em 13/11/2026:** página inicial em cartões (uma linha cada, com estado: registro completo, marca personalizada, IA conectada) e o detalhe ao abrir, com "voltar". Os textos dentro de cada seção ainda podem ser enxugados.
6. ~~Listas no formato antigo~~ **Feito em 13/11/2026:** Pacientes em cartões (iniciais coloridas, última sessão, avisos) e filtros em pílulas; Relatórios em cartões com faixa por tipo, pílulas de situação e "Mais filtros" (paciente, tipo, datas). Testado no simulado.
7. ~~Editor do relatório não revisado~~ **Feito em 13/11/2026:** barra fixa com o próximo passo, "Exportar" e "⋯" (excluir, voltar para rascunho, retirar do portal, levar ao cadastro); metas abaixo do texto. Testado no simulado; conferir com relatórios reais longos e no celular.

**Funcionalidades**
8. ~~Relatório por período com metas e escalas~~ **Feito em 13/11/2026:** seção "Progresso das metas e escalas" montada sem IA (situação de cada meta, em quantas sessões foi trabalhada, primeira e última pontuação das escalas no período). Não testado com dados reais.
9. ~~Busca sem sessões e cobranças~~ **Feito em 13/11/2026:** a busca acha sessões (60 dias para trás e para frente), cobranças em aberto por paciente e as páginas do Financeiro e da Agenda.
10. ~~Agenda em grade semanal~~ (feito em 13/11/2026); PDF gravado direto na pasta; cobrança automática por e-mail (ver seções acima).

## 4. Segurança (adiado pelo James por estar em fase de testes)

Avisos do Supabase que continuam abertos. **Tratar antes de abrir a plataforma para uso real.**
- Proteção contra senhas vazadas desligada.
- Funções internas (`SECURITY DEFINER`) que podem ser chamadas sem login: `brand_by_slug`, `guard_profile_flags`, `handle_new_user`, `keep_report_version`, `rls_auto_enable`, `write_audit`, funções `admin_*` e `portal_list_reports`. As funções `public_get_link` e `public_submit_anamnese` são públicas de propósito.
- `touch_updated_at` sem `search_path` fixo.

## 5. Perguntas em aberto para o James

1. Cobrança automática: quer a versão por e-mail?
2. Os dados de pagamento devem sair também do Word de orçamento e recibo? (Na cobrança, o Word já foi removido.)
3. A janela de cobrança ainda mostra a lista de sessões com data e horário para conferência do profissional. Deixar assim ou mostrar só quantidade e total?
4. Quais achados da seção 3 entram primeiro?
