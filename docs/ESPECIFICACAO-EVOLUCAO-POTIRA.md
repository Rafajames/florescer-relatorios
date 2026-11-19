# Especificação técnica — Evolução do Potira

**Status:** proposta documentada; ainda não implementada.  
**Decisões confirmadas:** público = profissionais autônomos e clínicas; cadastro = completo; redesign = toda a plataforma.  
**Fontes internas consultadas:** README.md, docs/DIRETRIZES.md, docs/PENDENCIAS.md, docs/CLINICA.md, docs/ATUALIZACOES.md, CLAUDE.md, supabase/schema.sql e módulos atuais do frontend.

## 1. Objetivo e limites

Evoluir o Potira para atender profissionais autônomos e clínicas, ampliar a ficha de pacientes, incorporar emissão de NFS-e e reformular a experiência visual integralmente, sem substituir a arquitetura atual nem alterar regras de negócio já aprovadas.

Esta entrega é **somente documentação**. Não altera código, banco, configurações do Supabase ou publicação.

Regras obrigatórias:
- Nome do produto: Potira. O repositório e a URL ainda conservam florescer-relatorios.
- Manter as contas autônoma e clínica separadas. O uso autônomo atual não pode mudar por causa da conta de clínica.
- Manter português do Brasil, linguagem simples e o termo “sessão”.
- Preservar HTML, CSS e JavaScript puro em módulos, sem framework, build, TypeScript ou npm install.
- Preservar a paleta petróleo (#134B5F) e amora (#B83D6F), as fontes e os cartões definidos nas diretrizes.
- IA continua opcional; todo conteúdo clínico gerado por IA é rascunho sujeito à revisão profissional.
- Não contratar serviço pago sem aprovação.
- A integração fiscal deve aceitar, em arquitetura, emissor nacional direto ou provedor, mas a escolha ainda não foi feita.
- Esta especificação complementa DIRETRIZES.md e CLINICA.md; não os substitui.

## 2. Diagnóstico técnico de partida

O projeto é um site estático no GitHub Pages, com JavaScript puro em módulos e Supabase/PostgreSQL. O acesso ao banco é centralizado em js/api.js; as rotas ficam em js/main.js; os estilos em css/app.css; o esquema e as políticas ficam em supabase/schema.sql.

Arquivos centrais:
- js/main.js: rotas e contexto de sessão/perfil.
- js/ui.js: moldura, componentes, modais, avisos e estados.
- js/api.js: leitura e gravação no Supabase.
- js/views-home.js: Início, pacientes e ficha.
- js/views-administrativo.js: agenda, frequência, declarações e convênios.
- js/views-financeiro.js: cobranças, despesas, resumo, valores, documentos e dados de pagamento.
- js/views-portal.js: Portal do paciente.
- css/app.css: identidade visual e componentes.
- supabase/schema.sql: tabelas, funções, gatilhos e RLS.

Hoje, patients armazena nome, e-mail, telefone, data de nascimento, observações e arquivamento. A ficha já possui áreas Resumo, Clínico, Financeiro e Arquivos/links. A anamnese por link recebe respostas como rascunho, que só entram no cadastro após ação do profissional. O Financeiro já oferece cobranças, mensalidades, pacotes, PIX, pagamentos, despesas, orçamento e recibos. Recibo não é nota fiscal.

A conta de clínica está desenhada em docs/CLINICA.md, mas não implementada. A tabela staff e o modo secretária atual não equivalem ao futuro sistema de membros e papéis de uma clínica.

## 3. Público e modelo de contas

### 3.1 Profissional autônomo
- Continua sendo uma conta individual, com dados e pacientes próprios.
- Mantém agenda, clínico e financeiro próprios.
- A propriedade atual baseada em professional_id = auth.uid() deve continuar válida para os registros existentes.
- O novo cadastro e o redesign não podem obrigar a migração para uma clínica.

### 3.2 Clínica
Seguir o desenho já registrado em docs/CLINICA.md:
- Conta própria de clínica, com dono/administrador, secretária(o) e profissionais convidados.
- Dono administra cadastro administrativo, agenda, financeiro, equipe, permissões e marca, mas não acessa conteúdo clínico.
- Secretária(o) acessa somente módulos administrativos liberados e nunca acessa conteúdo clínico.
- Profissional acessa os dados clínicos dos próprios pacientes e sua agenda; não acessa administração nem financeiro, salvo visualização do valor da sessão se o gestor permitir, conforme decisão já registrada.
- O paciente poderá consultar documentos liberados por seus profissionais, respeitando revisão, visibilidade e autenticação.
- Um mesmo e-mail poderá ter mais de um perfil, com troca explícita e isolamento entre contextos.

**Bloqueio já conhecido:** ainda falta decidir o destino e a titularidade dos registros quando um profissional sair da clínica. Não implementar transferência, exclusão ou retenção automática antes dessa decisão.

### 3.3 Entidades e propriedade conceitual
A futura arquitetura deve distinguir:
- Clínica: entidade organizacional.
- Membro da clínica: usuário, papel, permissões e estado do convite.
- Paciente administrativo: cadastro compartilhado pela clínica.
- Registro clínico: pertence ao profissional que o criou/assina.
- Agenda e financeiro: pertencem à clínica.
- Documento liberado ao paciente: acessível no Portal conforme regra explícita de compartilhamento.

Nomes finais das tabelas podem variar após revisão do esquema. A implementação deve usar RLS como fronteira de segurança; filtros do frontend não são controle de acesso.

## 4. Cadastro completo do paciente

### 4.1 Princípios
- Manter o cadastro inicial simples e permitir completar a ficha posteriormente.
- Organizar os dados em seções/abas; não exibir todos os campos de uma vez.
- CPF, RG, endereço e responsável não são obrigatórios para todo paciente por padrão. A obrigatoriedade deve depender de finalidade legítima e requisito aplicável.
- Diferenciar paciente, responsável legal, responsável financeiro e contato de emergência.
- Suportar mais de um responsável e mais de um paciente por responsável.
- Não conceder acesso ao Portal apenas porque alguém foi cadastrado como responsável.
- Não misturar dados clínicos com administrativos.
- Dados antigos continuam válidos mesmo sem os novos campos.

### 4.2 Seções e campos

**A. Identificação**
- Nome completo (obrigatório).
- Nome social (opcional).
- CPF (opcional; normalizado e com validação dos dígitos).
- RG, órgão expedidor e UF (opcionais; incluir apenas se houver finalidade).
- Data de nascimento.
- Sexo cadastral somente se necessário para finalidade definida; não inferir identidade de gênero.

**B. Contato**
- E-mail do paciente, usado atualmente para vincular o Portal.
- Telefone principal e WhatsApp.
- Telefone alternativo, se necessário.
- Preferência de contato e autorização de comunicação em registro separado do consentimento clínico.
- Antes de liberar o Portal, o profissional deve conferir se o e-mail pertence ao paciente.

**C. Endereço**
- CEP, logradouro, número, complemento, bairro, município, UF e país.
- Permitir endereço parcial quando não houver necessidade de endereço completo.
- Não depender de serviço pago de consulta de CEP; preenchimento manual sempre disponível.

**D. Responsáveis e vínculos**
- Nome, CPF opcional, vínculo/parentesco, telefone, e-mail e endereço alternativo.
- Tipo: responsável legal, financeiro, contato de emergência ou outro contato autorizado.
- Indicador de responsável principal.
- Suportar múltiplos vínculos e datas de validade.
- Acesso ao Portal exige autenticação e autorização próprias, não apenas CPF ou vínculo declarado.

**E. Administrativo**
- Situação ativo/arquivado.
- Profissional responsável, no contexto de clínica.
- Data de entrada e origem do cadastro, se úteis.
- Convênio, valores, cobrança e responsável financeiro continuam na área administrativa existente.
- Não expor dados financeiros a papéis clínicos sem permissão.

**F. Clínico**
- Anamnese, queixa, histórico, diagnóstico/hipótese quando pertinente, alergias, medicamentos, metas, escalas, evoluções, relatórios e documentos permanecem na área Clínica.
- Campos específicos por profissão devem ser configurados por anamnese/modelo, não impostos a todos.

### 4.3 Modelo de dados conceitual
Após mapear todas as referências atuais no schema e nas RPCs, avaliar:
- patients: acrescentar apenas atributos estáveis de identificação/contato.
- patient_addresses: se for necessário suportar histórico ou múltiplos endereços.
- patient_relationships: vínculos com responsáveis e contatos, incluindo tipo e permissões.
- patient_admin: manter informações administrativas já existentes.
- consents: manter consentimento clínico; autorizações de comunicação/compartilhamento devem ter finalidade e registro próprios quando aplicável.

Não duplicar dados que já estejam em patient_admin ou que sejam respostas da anamnese. Não criar campos/tabelas sem mapear primeiro os usos existentes.

### 4.4 Migração e compatibilidade
- Migração aditiva, idempotente, em novo bloco versionado no fim de supabase/schema.sql.
- Não remover nem renomear colunas existentes.
- Atualizar acesso ao banco somente por js/api.js.
- Atualizar criação/edição da ficha em js/views-home.js e integração da anamnese apenas onde necessário.
- Não exigir preenchimento retroativo para registros antigos.
- Índices somente para consultas necessárias.
- Não impor unicidade global de CPF entre profissionais ou clínicas. A regra de duplicidade deve respeitar o escopo de propriedade e ser definida antes da migração.
- Fazer backup e testar em ambiente de teste antes de aplicar no projeto ativo.

## 5. Financeiro e emissão fiscal

### 5.1 Preservar o Financeiro existente
Manter as regras de cobrança, mensalidade, pacote, PIX, pagamento, despesas, recibo, convênio e resumo registradas em docs/DIRETRIZES.md. A emissão fiscal não deve alterar cálculos ou criar lançamentos duplicados. Pagamento parcial continua fora do escopo, conforme pendência atual.

### 5.2 Nova área “Notas fiscais”
Adicionar aba própria em Financeiro, separada de Recibos:
- Indicadores por período: emitidas, pendentes, rejeitadas, canceladas e total.
- Lista com tomador, número, competência, valor, situação e data.
- Ação “Emitir nota” com revisão e confirmação explícita.
- Detalhe com histórico, protocolo, identificador externo e documento fiscal quando disponível.
- Consulta, download/abertura e solicitação de cancelamento conforme estado e regras do emissor.
- Nota rejeitada nunca aparece como emitida.
- Nunca repetir emissão automaticamente sem consulta/idempotência.

### 5.3 Dados fiscais do prestador
Criar seção própria em Configurações:
- Tipo: pessoa física ou jurídica.
- CPF/CNPJ, nome/razão social e nome fantasia, quando aplicável.
- Inscrição municipal.
- Endereço fiscal e município emissor.
- Regime tributário e enquadramento.
- Código de serviço/tributação e demais parâmetros exigidos.
- Credenciamento, ambiente de homologação/produção e status.
- Certificado/credencial somente quando exigido pelo modelo escolhido.

Regras, campos, retenções, códigos e disponibilidade variam por município e enquadramento. O Potira não deve presumir um único fluxo fiscal para todos os profissionais; validar com contador, município e documentação oficial.

### 5.4 Dados fiscais do tomador
Na emissão, revisar nome/razão social, CPF/CNPJ quando aplicável, endereço/município quando exigidos e e-mail. Salvar um snapshot fiscal na nota. Alterações futuras no cadastro do paciente não podem modificar nota já emitida.

### 5.5 Fluxo de emissão
1. Usuário autorizado abre Financeiro → Notas fiscais.
2. Seleciona cobrança/pagamento ou emissão avulsa, se essa opção for aprovada.
3. Sistema carrega os dados fiscais do prestador e do tomador.
4. Usuário informa competência, descrição do serviço, valor e parâmetros fiscais.
5. Sistema alerta para não inserir diagnóstico, evolução, anamnese ou detalhes clínicos.
6. Usuário revisa e confirma.
7. Backend seguro envia a solicitação ao emissor.
8. Sistema grava idempotência, solicitação, retorno e estado.
9. Em caso de timeout, consulta a solicitação antes de qualquer reenvio.
10. Documento fica disponível ao prestador e, se aprovado/configurado, ao paciente no Portal.

### 5.6 Arquitetura da integração
A aplicação atual é estática e não pode guardar credenciais fiscais no navegador. Portanto:
- Criar camada fiscal desacoplada do frontend e do Financeiro.
- Definir contrato interno para validar dados, emitir, consultar, cancelar e obter documento.
- Implementar adaptadores separados para emissor nacional direto e provedor externo.
- Credenciais, certificados e tokens ficam somente em backend/função segura; nunca em js/config.js, HTML, JavaScript público, Git ou localStorage.
- Toda operação valida usuário, papel, escopo e permissão.
- Webhooks precisam validar autenticidade e impedir repetição.
- Usar idempotência por solicitação.
- Enviar ao emissor somente dados estritamente necessários.
- Não contratar provedor pago sem aprovação explícita.

### 5.7 Modelo fiscal conceitual
Avaliar tabelas com escopo de prestador ou clínica:
- fiscal_profiles: dados de configuração fiscal e status, sem segredo acessível ao cliente.
- fiscal_documents: snapshots de prestador/tomador, valor, competência, descrição, estado, identificadores externos e referência à cobrança/pagamento.
- fiscal_events: histórico imutável de solicitações e retornos, sem segredos.
- fiscal_integrations: adaptador, ambiente e referência segura à credencial.

Toda tabela terá RLS. Operações privilegiadas serão realizadas por backend/função segura. Retenção de XML/PDF deve ser definida após verificar exigências legais e capacidade segura de armazenamento.

### 5.8 Estados propostos
Rascunho → aguardando envio → processando → emitida.  
Estados alternativos: rejeitada, falha temporária, cancelamento solicitado e cancelada.

A nomenclatura final seguirá os estados reais do emissor. Nota emitida não pode ser editada silenciosamente; correções seguem o fluxo fiscal válido.

## 6. Redesign integral

### 6.1 Direção visual
Usar a referência Notyza para hierarquia, organização e clareza, sem copiar a marca:
- Fundo claro, cartões brancos, cantos arredondados e bom espaçamento.
- Indicadores em cartões, gráficos discretos e tabelas legíveis.
- Menu consistente, navegação previsível e uma ação principal clara por tela.
- Manter petróleo e amora como identidade; o verde-limão da referência não substitui a paleta Potira.
- Usar cores de estado com contraste acessível.
- Preservar as fontes definidas nas diretrizes; conferir CSS antes de qualquer troca.

### 6.2 Estrutura global
**Desktop:** navegação lateral em petróleo, marca Potira, módulos e perfil; barra superior com busca, contexto de conta, novidades e preferências; conteúdo com largura confortável e cartões.

**Celular (390 px):** adaptar a navegação existente; cartões empilhados; tabelas viram listas ou rolagem interna controlada; formulários em uma coluna; modais compatíveis com teclado virtual; nenhuma ação depende de hover; sem rolagem horizontal.

### 6.3 Painéis por perfil
**Autônomo:** sessões de hoje/semana, pacientes ativos, pendências de revisão, resumo financeiro (recebido, em aberto e despesas pagas), atividade recente e alertas.

**Gestor da clínica:** sessões por dia/profissional, ocupação da agenda, pacientes ativos, pendências administrativas, resumo financeiro, notas fiscais, equipe e permissões. Não exibir conteúdo de prontuário.

**Profissional da clínica:** próximas sessões, pacientes sob sua responsabilidade e tarefas clínicas próprias. Sem valores, despesas ou cobranças.

**Secretária(o):** agenda e tarefas dos módulos liberados. Sem dados clínicos em listas, busca, notificações, exportações ou detalhes.

### 6.4 Telas incluídas no redesign
- Apresentação, login, criação de conta e recuperação de senha.
- Início por perfil.
- Lista, cadastro e ficha do paciente.
- Anamnese, evolução, editor de relatório e documentos.
- Agenda, frequência, declarações, convênios e lista de espera.
- Financeiro, cobranças, gastos, valores, resumo, recibos e notas fiscais.
- Portal do paciente e páginas públicas por link.
- Configurações, marca, consentimento, equipe, convites e administração.
- Ajuda, Sobre, modais, estados vazios, carregamento, erros e confirmações.

Redesign não autoriza alterar comportamento ou remover rotas. Primeiro mapear telas, estados e ações existentes; depois aplicar padrões visuais compartilhados.

### 6.5 Componentes e consistência
Reutilizar padrões em js/ui.js e css/app.css:
- Cabeçalho, retorno e ação principal.
- Cartões de indicador e de item.
- Filtros, status e listas compactas.
- Tabelas responsivas.
- Campos, validação e ajuda contextual.
- Modal com X, regras de fechamento e confirmação.
- Estados vazios, skeleton, erro recuperável e toast.
- Gráficos com legenda e alternativa textual.

Estilos novos seguem as variáveis existentes e são adicionados ao fim de css/app.css. Respeitar prefers-reduced-motion, as regras de modal e demais requisitos de interface de DIRETRIZES.md.

## 7. Segurança e LGPD

- Dados de saúde são dados pessoais sensíveis. Definir finalidade, base legal, transparência, retenção e direitos do titular antes de uso real.
- CPF/endereço só devem ser coletados com finalidade clara; mascarar CPF em listas e telas sem necessidade operacional.
- RLS obrigatório em todas as tabelas novas; esconder botão no frontend não é autorização.
- Em clínica, cada consulta, RPC, exportação e link deve verificar associação ativa e permissão.
- Gestor/secretária não podem obter dados clínicos por joins, busca, notificações, logs ou endpoints auxiliares.
- Profissional não acessa prontuário de outro profissional.
- Auditoria registra ator, ação, entidade, data e resultado, sem conteúdo clínico, CPF completo ou credenciais.
- Portal continua mostrando somente documentos revisados/liberados e seções autorizadas.
- Ser responsável no cadastro não concede automaticamente acesso ao Portal.
- Nunca expor service_role, certificados ou segredos no frontend.
- Resolver as pendências de segurança já listadas em PENDENCIAS.md antes de abrir a plataforma para uso real.

## 8. Fases de implementação e aceite

### Fase 0 — Decisões e preparação
- Resolver a saída de profissional da clínica, conforme pergunta pendente em CLINICA.md.
- Definir titularidade fiscal: autônomo, clínica ou ambos; quem emite e em nome de quem.
- Escolher emissor nacional direto ou provedor; definir municípios, credenciamento, custo e homologação.
- Validar exigências com contador e documentação oficial.
**Aceite:** decisões registradas; nenhum serviço pago contratado sem aprovação.

### Fase 1 — Redesign
- Inventariar rotas, telas, componentes e estados.
- Aprovar protótipos das telas-chave.
- Definir tokens e padrões compartilhados.
- Redesenhar em grupos, preservando comportamento.
**Aceite:** todas as telas contempladas; rotas e ações preservadas; sem rolagem horizontal em 390 px; tema claro/escuro e movimento reduzido conferidos.

### Fase 2 — Cadastro completo
- Aprovar dicionário de dados e obrigatoriedade.
- Criar migração aditiva e RLS.
- Atualizar ficha, criação/edição e integração com anamnese/responsáveis.
- Preservar registros antigos sem preenchimento retroativo.
**Aceite:** adulto sem responsável; criança com múltiplos responsáveis; CPF ausente ou preenchido; edição sem perda; deduplicação no escopo correto; nenhum acesso indevido ao Portal.

### Fase 3 — Conta de clínica
- Implementar entidade clínica, membros, convites, papéis e permissões.
- Separar cadastro administrativo e prontuário por profissional.
- Implementar painéis e troca de perfil.
- Revisar RLS ponta a ponta.
**Aceite:** gestor/secretária não leem dados clínicos; profissional não vê financeiro; autônomo continua funcionando.

### Fase 4 — Fundação fiscal
- Criar camada/backend seguro e adaptador.
- Configurar dados fiscais e homologação.
- Persistir snapshots, eventos, idempotência e estados.
- Implementar emissão, consulta, rejeição e cancelamento.
**Aceite:** emissão de homologação sem duplicidade; segredo ausente do navegador/Git/log; timeout não duplica nota.

### Fase 5 — Integração e Portal
- Vincular nota a cobrança/pagamento sem alterar cálculos.
- Compartilhar documento no Portal somente se autorizado.
- Criar conciliação e auditoria.
**Aceite:** recibo e nota claramente distintos; paciente só vê documentos liberados; valores não são duplicados.

### Fase 6 — Testes e publicação
- Testar contas autônomo, gestor, profissional, secretária e paciente.
- Executar testes de RLS, regressão, responsividade e falhas.
- Atualizar ATUALIZACOES.md e PENDENCIAS.md.
- Para commits de código, rodar tools/stamp.py e incluir index.html.
**Aceite:** roteiro registrado, limitações informadas e site publicado conferido.

## 9. Matriz mínima de testes

| Cenário | Resultado esperado |
| --- | --- |
| Adulto sem CPF | Cadastro salva sem bloqueio |
| Criança com dois responsáveis | Vínculos separados e identificados |
| Resposta de anamnese por link | Fica como rascunho até ação do profissional |
| Alteração de e-mail do Portal | Não transfere acesso silenciosamente |
| Gestor pesquisa paciente | Somente dados administrativos autorizados |
| Gestor tenta abrir evolução | Banco/RPC negam acesso |
| Secretária tenta ler relatório por URL/API | Banco/RPC negam acesso |
| Profissional A tenta ler clínico de B | Acesso negado |
| Profissional da clínica abre Financeiro | Acesso negado |
| Autônomo após migração | Fluxos atuais continuam funcionando |
| Emissão fiscal com timeout | Consulta idempotente antes de novo envio |
| Nota rejeitada | Não aparece como emitida |
| Paciente abre Portal | Só vê documentos revisados/liberados |
| Tela em 390 px | Sem rolagem horizontal |
| Tema escuro/redução de movimento | Contraste e acessibilidade preservados |

## 10. Decisões ainda necessárias

1. Conta de clínica: destino e titularidade dos registros quando um profissional sair (pergunta pendente em CLINICA.md).
2. Fiscal: emissor nacional direto ou provedor; municípios iniciais, credenciamento e custo aceito.
3. Titularidade fiscal: clínica emite com seu CNPJ, profissional emite individualmente ou ambos.
4. Portal: confirmar o modelo de portal do paciente para documentos liberados por diferentes profissionais.
5. Cadastro: confirmar necessidade de RG e sexo cadastral; proposta é manter ambos opcionais/condicionais.
6. Design: aprovar protótipos das telas-chave antes da implementação.

## 11. Ordem recomendada

1. Resolver decisões bloqueadoras e aprovar protótipos.
2. Redesenhar componentes e telas sem alterar regras de negócio.
3. Implementar cadastro completo e vínculos.
4. Construir contas de clínica e permissões.
5. Construir camada fiscal e integrar ao emissor escolhido.
6. Testar com contas reais e publicar gradualmente.

**Regra final:** em caso de conflito com DIRETRIZES.md, CLINICA.md ou regras de negócio já registradas, interromper e pedir decisão. Não reinterpretar silenciosamente decisões anteriores.
