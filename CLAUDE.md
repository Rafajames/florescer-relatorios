# Potira (repositório florescer-relatorios)

Plataforma web de registro clínico, agenda e cobrança para profissionais de saúde. Site estático (JavaScript puro, sem build) no GitHub Pages, com Supabase (projeto `dadkcfhwtmuizcjywcpw`). Em fase de testes. O dono do projeto é o James (Rafajames); responda sempre em português do Brasil.

## Leia antes de qualquer mudança

1. `docs/DIRETRIZES.md` — regras que não podem ser quebradas (identidade, vocabulário, privacidade, regras de negócio, interface).
2. `docs/PENDENCIAS.md` — o que falta fazer, o que precisa de revisão e o que está aguardando decisão do James.
3. `docs/ATUALIZACOES.md` — o que já foi feito.

## Como entregar

- Fluxo: estruturar sem programar → perguntar o que fazer primeiro → programar só o necessário → testar no fim.
- Antes de cada commit: `python3 tools/stamp.py` e incluir `index.html`.
- Mudança de banco: bloco novo e idempotente no fim de `supabase/schema.sql`, aplicado como migração no Supabase.
- Publicar em `main` e terminar a resposta com o link: https://rafajames.github.io/florescer-relatorios/
- Atualizar `docs/ATUALIZACOES.md` e `docs/PENDENCIAS.md` na mesma entrega.
- Dizer com clareza o que foi testado e o que não foi.

## Mapa do código

- `js/main.js` rotas · `js/ui.js` moldura, janelas (`openModal`, `confirmBox`), avisos · `js/api.js` todo acesso ao banco
- `js/views-home.js` Início, Pacientes e ficha do paciente · `js/views-session.js` nova sessão · `js/views-report.js` editor do relatório
- `js/views-administrativo.js` agenda, frequência, declarações, convênios · `js/views-financeiro.js` cobranças, valores, despesas, documentos, dados de pagamento
- `js/cobranca.js` PIX, WhatsApp, textos e regras de cobrança · `js/cobrar.js` janelas de cobrar, registrar pagamento e agendar cobrança
- `js/pasta.js` pasta dos documentos no computador do profissional
- `js/views-clinico.js` metas e escalas · `js/tour.js` tour de primeiro acesso · `apresentacao.html` página de apresentação
- `js/export.js` PDF e Word de todos os documentos · `js/import-template.js` leitura de Word/PDF/foto para virar modelo
- `js/views-public.js` páginas públicas por link e página pública do profissional · `js/views-portal.js` portal do paciente · `js/brand.js` e `js/theme.js` marca e tema · `css/app.css` estilos

## Não fazer

- Não adicionar framework, build ou serviço pago.
- Não implementar uso offline, instalar como aplicativo, clínicas, cobrança enviada sozinha nem correções de segurança do Supabase sem o James pedir (ver pendências).
- Não guardar arquivos de comprovante: só as informações do pagamento.
- Não recriar o cadastro de secretária(o) nem a aba Equipe: conta é de profissional ou paciente; equipe só na futura conta de clínica.
- Não trocar "sessão" por "atendimento", não voltar o menu para branco, não recriar a cobrança em Word.
