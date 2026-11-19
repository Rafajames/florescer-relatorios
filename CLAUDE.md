# Potira (repositório florescer-relatorios)

Plataforma web de registro clínico, agenda e cobrança para profissionais de saúde. Site estático (JavaScript puro, sem build) no GitHub Pages, com Supabase (projeto `dadkcfhwtmuizcjywcpw`). Em fase de testes. O dono do projeto é o James (Rafajames); responda sempre em português do Brasil.

## Leia antes de qualquer mudança

1. `docs/DIRETRIZES.md` — regras que não podem ser quebradas (identidade, vocabulário, privacidade, regras de negócio, interface).
2. `docs/PENDENCIAS.md` — o que falta fazer, o que precisa de revisão e o que está aguardando decisão do James.
3. `docs/ATUALIZACOES.md` — o que já foi feito.
4. `docs/CLINICA.md` — desenho da conta de clínica (não implementado; uma pergunta em espera).
5. `docs/ESPECIFICACAO-EVOLUCAO-POTIRA.md` — plano técnico para autônomos e clínicas, cadastro completo, emissão fiscal e redesign integral (proposta, ainda não implementada).
6. `docs/CLAUDE-IMPLEMENTAR-REDESIGN-POTIRA.md` — roteiro aprovado para integrar os SVGs oficiais e implementar o redesign visual.
7. `docs/ASSISTENTE-IA.md` — Assistente de IA com ferramentas (primeira versão feita).
8. `docs/IMPORTACAO-PACIENTES.md` — cadastro completo (CPF, endereço) e importação por planilha (feitos).
9. `docs/CONTA-TESTES.md` — conta fictícia "Testes de IA" e roteiro de testes.

## Como entregar

- Fluxo: estruturar sem programar → perguntar o que fazer primeiro → programar só o necessário → testar no fim.
- Antes de cada commit: `python3 tools/stamp.py` e incluir `index.html`.
- Mudança de banco: bloco novo e idempotente no fim de `supabase/schema.sql`, aplicado como migração no Supabase.
- Publicar em `main` e terminar a resposta com o link: https://rafajames.github.io/florescer-relatorios/
- Atualizar `docs/ATUALIZACOES.md` e `docs/PENDENCIAS.md` na mesma entrega.
- Dizer com clareza o que foi testado e o que não foi.

## Mapa do código

- `js/main.js` rotas · `js/ui.js` moldura, janelas (`openModal`, `confirmBox`), avisos · `js/api.js` todo acesso ao banco
- `js/views-home.js` Início, Pacientes e ficha do paciente · `js/cadastro.js` formulário do cadastro completo · `js/importar.js` importação por planilha · `js/agente.js` Assistente de IA (ferramentas e painel) · `js/home-fin.js` dados e gráficos do Início · `js/views-session.js` nova sessão · `js/views-report.js` editor do relatório
- `js/views-administrativo.js` agenda, frequência, declarações, convênios · `js/views-financeiro.js` cobranças, valores, despesas, documentos, dados de pagamento
- `js/cobranca.js` PIX, WhatsApp, textos e regras de cobrança · `js/cobrar.js` janelas de cobrar, registrar pagamento e agendar cobrança
- `js/pasta.js` pasta dos documentos no computador do profissional
- `js/views-clinico.js` metas e escalas · `js/tour.js` tour de primeiro acesso · `js/views-landing.js` apresentação (tela principal de quem não está logado; `apresentacao.html` só redireciona)
- `js/export.js` PDF e Word de todos os documentos · `js/import-template.js` leitura de Word/PDF/foto para virar modelo
- `js/views-public.js` páginas públicas por link e página pública do profissional · `js/views-portal.js` portal do paciente · `js/brand.js` e `js/theme.js` marca e tema · `css/` estilos: `tokens.css`, `app.css`, `marca.css`, `shell.css`, `inicio.css`, `landing.css` (ver DIRETRIZES §7) · `js/marca.js` + `js/marca-svg.js` (gerado por `tools/gerar-marca.py`; SVGs desenhados por `tools/desenhar-marca.py`) marca Potira

## Não fazer

- Não adicionar framework, build ou serviço pago.
- Não implementar uso offline, instalar como aplicativo, clínicas, cobrança enviada sozinha nem correções de segurança do Supabase sem o James pedir (ver pendências).
- Não guardar arquivos de comprovante: só as informações do pagamento.
- Não recriar o cadastro de secretária(o), a aba Equipe nem a opção "Sou paciente" em Criar conta: o paciente entra pelo Portal do paciente (`#/paciente`); equipe só na futura conta de clínica.
- Não trocar "sessão" por "atendimento" nos textos (a única exceção é o item de menu "Atendimentos", pedido pelo James), não voltar o menu para branco, não recriar a cobrança em Word.

## Identidade visual Potira

- SVGs oficiais: `assets/brand/` (logo empilhada, horizontal e do menu, símbolos e ícones), redesenhados a partir da imagem do James. Logo do profissional só nos documentos.
- Para executar o redesign visual aprovado, seguir `docs/CLAUDE-IMPLEMENTAR-REDESIGN-POTIRA.md` integralmente.
