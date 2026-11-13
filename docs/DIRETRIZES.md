# Diretrizes do projeto Potira

Regras que valem para qualquer mudança, feita por pessoa ou por IA. O objetivo é evoluir a plataforma sem mudar o que ela é.

## 1. Como trabalhar

1. **Estruturar antes de programar.** Primeiro descrever o que será feito, sem código.
2. **Perguntar a prioridade.** Quando houver várias melhorias, perguntar ao James quais fazer primeiro. Se ele disser "faça tudo", seguir sem perguntar de novo.
3. **Programar alterando só o necessário.** Não reescrever arquivos inteiros sem motivo, não "aproveitar" para refatorar.
4. **Testar no fim** e dizer com clareza o que foi testado e o que não foi.
5. **Publicar no Git** (branch `main`), para a mudança aparecer ao recarregar o site.
6. **Terminar a resposta com o link de teste:** https://rafajames.github.io/florescer-relatorios/
7. **Atualizar a documentação** na mesma entrega: `docs/ATUALIZACOES.md` (o que mudou) e `docs/PENDENCIAS.md` (o que ficou para depois).
8. Economizar: respostas diretas, sem repetir o que já foi dito.

## 2. O que não pode mudar

- **Nome e identidade:** a plataforma se chama **Potira**. Cores padrão petróleo (`#134B5F`) e amora (`#B83D6F`). Fontes Bricolage Grotesque (títulos) e Instrument Sans (texto). Visual em cartões.
- **Sem custo:** só planos gratuitos (GitHub Pages, Supabase). Nada que exija pagamento sem o James aprovar antes.
- **Sem build:** HTML, CSS e JavaScript puro em módulos. Não adicionar framework, bundler, TypeScript nem `npm install` no site.
- **IA é opcional.** Tudo precisa funcionar sem IA. Cada profissional usa a própria chave, guardada só no navegador dele. A IA só produz rascunho; o profissional revisa.
- **Sem verificação de conselho** (CRM, CREFITO etc.): o profissional só preenche os dados.
- **Autenticador (2FA) opcional e desligado por padrão** nesta fase.
- **Conteúdo é de clínica.** Nada de finanças pessoais, cartão de crédito ou temas fora do consultório.
- **Tudo em português do Brasil**, inclusive mensagens de erro, tutoriais e documentação.
- **Público:** profissionais de saúde sem conhecimento técnico. Textos simples, sem jargão de sistema.

## 3. Vocabulário

- Usar sempre **"sessão"**. Não usar "atendimento" nem "encontro".
- **Anamnese** (entrevista inicial), **Evolução** (registro de uma sessão), **Relatório por período**, **Documento** (texto livre).
- Situações da sessão: Agendado, Realizado, Falta, Falta justificada, Cancelado.
- Estados do relatório: Rascunho → Revisado → Liberado ao paciente.
- Datas no formato dd/mm/aaaa. Valores em R$ com vírgula.

## 4. Regras de dados e privacidade (LGPD)

- Cada profissional vê **só os próprios dados**. Toda tabela nova precisa de RLS com a regra do dono (`professional_id = auth.uid()` e `public.is_professional()`).
- **O áudio nunca é guardado.** Só o texto.
- **Dados administrativos e financeiros ficam separados dos clínicos** (tabelas `appointments`, `patient_admin`, `expenses`). Não colocar informação clínica na agenda.
- O paciente só vê o que foi **revisado e liberado**, e só as seções marcadas como visíveis.
- **"Criar conta" é só para profissional.** O paciente não se cadastra ali: ele entra pelo **Portal do paciente** (`#/paciente`), uma página só dele, com "Primeiro acesso". Não há cadastro de secretária(o); equipe só dentro da futura conta de clínica, por convite do gestor.
- Quando existir, **secretária(o) nunca vê nada clínico.** Só agenda e financeiro do profissional que liberou o e-mail dela (`staff`). As regras de acesso das tabelas administrativas usam `public.can_manage(professional_id)`; as clínicas (`reports`, `patients`, `goals`, `scales`…) continuam só do profissional. Paciente, para a secretária, é nome, telefone e e-mail.
- Ao salvar `profiles.branding`, **sempre preservar o que já existe** (`{ ...branding, novoCampo }`). Ali ficam também pagamento, convênios, sequência de recibos e a página pública.
- O log de auditoria não guarda conteúdo clínico.
- Páginas públicas por link (`#/l/<token>`) só acessam o banco pelas funções `public_get_link` e `public_submit_anamnese`. Não abrir tabelas para acesso anônimo.
- Nunca colocar a chave `service_role` do Supabase no site.
- Arquivos enviados para leitura (comprovante, documento-modelo) não são guardados; só o resultado da leitura.

## 5. Regras de negócio que já estão decididas

**Sessões e cobrança**
- Registrar a evolução de uma sessão marca a sessão agendada daquele dia como **Realizado**. Para desfazer, o profissional muda a situação na agenda.
- Sessão **realizada vira cobrança**. O valor é **gravado no momento em que a sessão é realizada**; mudar o preço do paciente não altera sessões antigas.
- Faltas sem justificativa só são cobradas se o profissional ligar a opção em Financeiro → Valores.
- "Em aberto" considera **todos os meses**. "Recebido no mês" usa a **data do pagamento**.
- A cobrança enviada ao paciente mostra **só a quantidade de sessões e o total**. Não mostra datas, horários nem valor unitário.
- **Não existe cobrança em Word.** A cobrança sai como mensagem (copiar, baixar .txt, WhatsApp) e PDF. O Word, nos outros documentos, serve só para o profissional editar; não é o formato de envio ao paciente.
- A mensagem de cobrança mostra a **chave PIX como foi cadastrada** e o código copia-e-cola. O profissional pode ter várias chaves e escolher ou editar na hora; a edição vale só para aquela cobrança.
- Pagamento por comprovante: o sistema lê e propõe; **nada é marcado como pago sem o profissional confirmar**.
- Cobrança agendada (dia fixo ou data avulsa) **não envia sozinha**: deixa pronta e avisa.
- **Arquivos do paciente (laudos, exames, documentos exportados) ficam na pasta que o profissional escolhe no próprio computador** (`js/pasta.js`). A plataforma não guarda cópia no servidor. Sem pasta escolhida ou em navegador sem suporte, o arquivo é baixado.
- **Não se guardam arquivos de comprovante.** Guardam-se só as informações do pagamento: valor, data, forma e quem pagou.
- Formas de cobrança por paciente: **por sessão**, **mensalidade** (cobrança do mês criada sozinha, sessões entram quitadas) ou **pacote** (saldo de sessões que diminui a cada sessão realizada e volta se a sessão deixar de ser realizada).
- O que não é sessão (mensalidade, pacote, avulsa) fica na tabela `charges` e aparece junto em "Em aberto".
- Convênio que paga é separado do paciente; não se envia cobrança de convênio ao paciente.
- Gastos: "pago" entra no saldo; "a pagar" não. Gasto fixo é copiado para o mês seguinte como "a pagar".
- Lembrete de sessão leva o link de confirmação. A resposta do paciente não muda a situação da sessão; só informa o profissional.

**Documentos**
- Modelo enviado em Word preserva logo, marca d'água, cabeçalho e rodapé do documento, e vira o modelo padrão ao salvar.
- Recibo tem número sequencial e valor por extenso.
- Declarações usam datas por extenso e o termo "sessão".

**Anamnese por link**
- Começa com Nome completo, Nomes dos pais ou responsáveis, Data de nascimento, Diagnóstico e Queixa principal; o profissional edita, remove e acrescenta perguntas.
- A resposta entra como **rascunho**. Só vai para o cadastro do paciente quando o profissional clica em "Atualizar cadastro".

## 6. Regras de interface

- Toda janela tem **X no canto superior direito**. Clicar fora fecha **só se nada foi digitado**.
- Menus suspensos fecham ao clicar fora ou apertar Esc.
- Existe botão **Voltar** na barra superior em todas as telas.
- O **menu é colorido** com a cor do tema do profissional (`--petrol`), no computador e no celular, com versão para tema escuro. Não voltar ao menu branco.
- Animações são discretas e respeitam `prefers-reduced-motion`. Animação de entrada usa `backwards` (nunca `both`/`forwards`), para não cobrir os menus suspensos.
- Toda tela precisa funcionar no **celular (390 px)** sem rolagem horizontal.
- **Pouco texto nas telas de lista.** Mostrar o essencial em cartões curtos e deixar o detalhe para quando a pessoa abre o item (como em Modelos de documento).
- Ações destrutivas pedem confirmação. Não usar `alert()`/`confirm()` do navegador; usar `openModal` e `confirmBox`.
- Depois de salvar, mostrar aviso curto (`toast`).
- **Animações de entrada só na primeira visita do dia** (classe `ja-viu` no `<html>`); as de resposta (check, janelas, flor, item que some) valem sempre.
- **Ações perigosas** (excluir, arquivar) ficam dentro de menus "Mais"/"⋯", nunca soltas na primeira tela.
- **Animações onde couber:** toda tela nova ou revisada deve ganhar animação discreta onde fizer sentido (entrada de página e de blocos, cartões que sobem ao passar o mouse, aberturas de janela, gráficos que crescem). Regras: curtas (até ~0,6 s), sem atrapalhar o clique (usar `backwards`, nunca `both`, em animações de entrada), e desligadas para quem pede menos movimento (`prefers-reduced-motion`).
- **O nome Potira** (tupi, "flor") e a história do nome aparecem na apresentação (seção "Por que Potira?") e em Sobre. Manter os dois textos coerentes.
- **A tela principal de quem não está logado é a apresentação** (`js/views-landing.js`), com Entrar e Portal do paciente no topo. Não voltar a abrir direto no login. Os links com a marca do profissional (`#/c/nome`, `#/paciente/nome`) continuam indo direto para a entrada.

## 7. Regras técnicas

- Rodar `python3 tools/stamp.py` **antes de cada commit** e incluir o `index.html`. Sem isso o navegador mostra a versão antiga.
- Mudança de banco entra em `supabase/schema.sql` como bloco novo (`-- vNN: ...`), **idempotente** (`if not exists`, `create or replace`, `drop constraint if exists`), e é aplicada no Supabase como migração. Projeto Supabase: `dadkcfhwtmuizcjywcpw`.
- Função `SECURITY DEFINER` nova: definir `search_path` e revogar de `public`/`anon` o que não for público.
- Rotas ficam em `js/main.js`. Cada tela é um arquivo `js/views-*.js`. Acesso ao banco só por `js/api.js`.
- Bibliotecas externas só por CDN e carregadas sob demanda (como mammoth, pdf.js e JSZip na importação de modelos).
- Estilos novos vão para o fim de `css/app.css`, usando as variáveis existentes (`--petrol`, `--bloom`, `--paper`, `--ink`, `--line`).
- Commits em português, dizendo o que mudou para o usuário.
