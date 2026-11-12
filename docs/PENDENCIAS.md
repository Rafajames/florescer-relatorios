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
| Acesso de secretária | **Ainda não testado com uma conta real.** Liberar um e-mail em Equipe, criar a conta como "Sou secretária(o)", confirmar o e-mail e entrar. Conferir: vê agenda e financeiro; agenda, cobra, registra pagamento e emite recibo; cadastra paciente básico; **não** abre relatórios nem a ficha. Suspender o acesso e ver que ela perde a entrada. |
| Página pública do profissional | Ligar em Aparência e marca, definir o link próprio e abrir `#/p/<link>` num celular sem login. |
| Portal do paciente | Entrar como paciente (mesmo e-mail do cadastro), ver as próximas sessões, confirmar e conferir na agenda do profissional. Emitir um recibo e ver na lista. |
| Pasta dos documentos | No Chrome ou Edge do computador: escolher a pasta, anexar um laudo, exportar um Word e conferir no Explorador de Arquivos. Fechar e reabrir o navegador e ver se a pasta continua lembrada (não foi possível testar o seletor de pastas nem a pasta lembrada fora de um computador real). |

## 2. Proposto e ainda não implementado

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
- No portal, o paciente vê a lista de recibos mas não baixa o PDF.
- A secretária não vê a aba Pesquisa nem Convênios, e não usa a pasta de documentos por paciente com dados clínicos (só os administrativos).
- Controle de convênio é simples: separa o que o convênio deve, sem guias nem faturamento por lote.
- O recibo considera as sessões pagas pelo mês da sessão, não pelo mês do pagamento.
- Editar um valor na tabela de sessões recarrega a tela inteira.
- Pagamento parcial de uma sessão não existe: a sessão é paga inteira ou fica em aberto.

**Administrativo**
- Não há visão de mês nem de dia.
- A evolução é ligada à sessão só por paciente e data; duas sessões no mesmo dia confundem.

**Design**
- O campo de data da página pública segue o idioma do navegador de quem abre.

**Desempenho**
- A lista de modelos carrega as imagens do timbre de todos os modelos a cada tela que usa modelos. Com muitos modelos importados pode ficar lento.

## 3B. Clínicas (só mapeado; o James pediu para NÃO implementar ainda)

Ideias para quando ele decidir:
- **Conta da clínica** com várias profissionais. Cada profissional continua dona dos próprios registros clínicos; a clínica não lê prontuário.
- **Papéis:** dono(a) da clínica, profissional, secretária(o) da clínica (agenda e financeiro de todas), financeiro.
- **Agenda única** com filtro por profissional e por sala; bloqueio de sala.
- **Financeiro da clínica:** repasse por profissional (percentual ou valor fixo por sessão), fechamento mensal, gastos da clínica separados dos gastos de cada profissional.
- **Marca da clínica** nos documentos, com o nome e o registro de quem assina.
- **Paciente da clínica** atendido por mais de uma profissional, com compartilhamento de registro só com consentimento.
- **Lista de espera e pesquisa de satisfação** da clínica.
- **Convênios da clínica**, com guias e faturamento por lote.
- **Impacto técnico:** hoje tudo é por `professional_id`. Clínica exige uma tabela de organização, vínculo profissional–clínica e revisão de todas as regras de acesso. O acesso de secretária já existe por profissional (tabela `staff`, funções `staff_of()` e `can_manage()`); na clínica ele precisa valer para várias profissionais.

## 3C. Ideias ainda não feitas

- **Instalar como aplicativo** (ícone na tela do celular). O James pediu para **não fazer ainda**.
- **PDF gravado direto na pasta.** Hoje o PDF sai pela janela de impressão do navegador, então a plataforma só prepara a pasta e avisa onde salvar. Gravar sozinho exigiria gerar o PDF dentro do site com uma biblioteca, com risco de perder qualidade. Não decidido.
- A tabela `attachments` e a pasta privada `anexos` do Supabase existem, vazias e sem uso: o James decidiu guardar laudos e exames **na pasta do computador**, não no servidor. Podem ser removidas numa limpeza.
- **Relatório por período com o progresso das metas.** Hoje as metas aparecem na ficha e na evolução, não no relatório por período.
- **Agenda em grade semanal.**
- **Cobrança enviada sozinha** (por e-mail), ver seção 2.

## 3D. Melhorias propostas em 12/11/2026 (tarde), nenhuma aprovada ainda

**Confiabilidade**
1. **Backup incompleto.** "Baixar backup completo" só leva pacientes, consentimentos, relatórios, modelos e sessões. Ficam de fora: valores e forma de cobrança, gastos, cobranças avulsas, recibos, metas, escalas, lista de espera, bloqueios e equipe. O arquivo ainda sai com o nome "florescer-backup". Esperado: incluir tudo e renomear.
2. **Teste com conta real.** Quase tudo desta rodada foi testado só com dados simulados. Esperado: percorrer o roteiro da seção 1 no site publicado, com uma conta de teste.
3. **Avisos para o profissional.** Quando o paciente responde uma anamnese, pede para remarcar ou abre as orientações, o profissional só descobre ao abrir a tela certa. Esperado: um bloco "Novidades" no Início.

**Telas que ainda têm texto demais ou não foram revisadas**
4. **Ficha do paciente** ficou longa (próximas sessões, metas, linha do tempo, financeiro, escalas, arquivos, links). Esperado: abas dentro da ficha (Resumo, Clínico, Financeiro, Arquivos e links).
5. **Configurações:** muitas abas e muito texto explicativo. Mesmo tratamento dos Modelos: cartões curtos, detalhe ao abrir.
6. **Relatórios e Pacientes:** listas ainda no formato antigo.
7. **Editor do relatório:** é a tela mais usada e não foi revisada.

**Funcionalidades**
8. Relatório por período trazer o progresso das metas e das escalas.
9. Busca (Ctrl K) achar também sessões e cobranças.
10. Agenda em grade semanal; PDF gravado direto na pasta; cobrança automática por e-mail (ver seções acima).

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
