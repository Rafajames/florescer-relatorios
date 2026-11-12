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

## 2. Proposto e ainda não implementado

**Cobrança enviada sozinha (automática de verdade)**
Hoje a cobrança agendada fica pronta e o profissional envia. Enviar sem ninguém tocar exige um serviço externo:
- por e-mail: função agendada no Supabase mais um serviço de envio (há plano gratuito), usando o e-mail do paciente. É o caminho possível sem custo;
- por WhatsApp: só com a API oficial, que é paga.
O James perguntou se era possível; a resposta foi dada e ele ainda não decidiu. **Não implementar sem ele escolher o caminho.**

**Comprovante guardado**
Hoje o comprovante é lido e descartado. Guardar o arquivo exige o armazenamento de arquivos do Supabase e regras de acesso. Não foi pedido; ficou como possibilidade.

**Agenda em grade semanal**
A agenda continua em lista (com dias vazios compactos). A grade com colunas por dia não coube bem com os controles de cada sessão. Esperado: uma visão de semana em colunas no computador, mantendo a lista no celular.

**Uso sem internet (offline)**
O James pediu para deixar de fora. Não implementar sem novo pedido.

**Nota fiscal**
O James quer emissão de nota fiscal no futuro. Fica para depois.

## 3. Achados da revisão que ainda não foram tratados

**Financeiro**
- O número do recibo avança mesmo se o profissional cancelar a impressão, e o recibo emitido não fica guardado (reemitir gera outro número).
- Despesas não têm edição nem repetição mensal (aluguel, por exemplo).
- Pacientes de convênio são cobrados como particulares; não há controle do que o convênio deve.
- Não há resumo mensal para o contador (recebido, despesas, por forma de pagamento) nem exportação em planilha.
- O recibo considera as sessões pagas pelo mês da sessão, não pelo mês do pagamento.
- Editar um valor na tabela de sessões recarrega a tela inteira.
- Pagamento parcial de uma sessão não existe: a sessão é paga inteira ou fica em aberto.

**Administrativo**
- Excluir uma série de sessões repetidas é uma por uma.
- Ao marcar "Falta", o sistema não oferece reagendar.
- Não há visão de mês nem de dia.
- A evolução é ligada à sessão só por paciente e data; duas sessões no mesmo dia confundem.

**Design**
- O painel do Início não foi revisado nesta rodada.
- Uma cor de tema muito clara deixa links e botões principais com pouco contraste fora do menu (o menu já se ajusta).
- O campo de data da página pública segue o idioma do navegador de quem abre.

**Desempenho**
- A lista de modelos carrega as imagens do timbre de todos os modelos a cada tela que usa modelos. Com muitos modelos importados pode ficar lento.

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
