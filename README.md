# Florescer Relatórios

Sistema web para profissionais de saúde (psicologia, fonoaudiologia, fisioterapia, nutrição, terapia ocupacional e outras) registrarem sessões e gerarem relatórios com apoio de IA.

- **Login para profissionais e pacientes** — cada profissional vê só os próprios pacientes e relatórios
- **Gravação ou envio de áudio** → transcrição (Whisper). O áudio nunca é guardado, só o texto (registro para auditoria)
- **Esboço do relatório com IA (Claude)**, sempre editável e marcado como rascunho até a revisão do profissional
- **Modelos por área** (Evolução clínica, SOAP, Fono, Fisio, Nutrição, TO, Acompanhamento) e modelos próprios
- **Relatório por período** de um paciente
- **Consentimento (LGPD)** registrado por paciente; gravação bloqueada sem consentimento
- **Portal do paciente**: o paciente vê somente os relatórios revisados e liberados (nunca a transcrição)
- **Exportação** em Word (.doc) e PDF com timbre do profissional
- **Trilha de auditoria** (quem criou/alterou/liberou), sem guardar conteúdo clínico no log

## Estrutura

```
index.html          site (GitHub Pages)
css/  js/           front-end em JavaScript puro (sem build)
supabase/schema.sql banco de dados + regras de segurança (PostgreSQL)
local/              versão antiga de arquivo único (dados só no navegador, sem login)
```

## Novidades da versão 3

- **IA opcional.** O sistema funciona sem nenhuma IA (você grava ou digita e escreve o relatório no editor). Com IA, escolha o provedor: **Google Gemini** e **Groq** têm plano gratuito; **Claude** e **OpenAI** são pagos. A conexão pode ser feita no cadastro, no primeiro acesso ou em Configurações → Chaves de IA, com botão de testar. Atenção à LGPD: em planos gratuitos o provedor pode usar o conteúdo enviado; o sistema nunca envia o nome do paciente.
- **Anamnese e Evolução.** Cada paciente tem anamnese (entrevista inicial, com modelos por área) e evoluções por sessão, além dos relatórios por período, que podem incluir a anamnese como contexto.
- **Edição a qualquer momento.** O relatório pode ser aberto durante a sessão (com bloco de anotações) e continua editável depois de revisado ou liberado. Alterações em relatório liberado pedem confirmação, e as versões anteriores ficam no Histórico, com botão de restaurar.
- **Modelos a partir dos seus documentos.** Envie .docx, PDF ou foto (foto exige IA com visão: Gemini, Claude ou OpenAI). O sistema monta um modelo de campos (texto, data, sim/não, escolha) que você ajusta. Ele reproduz a **estrutura** do documento, não o layout visual exato.
- **Marca própria.** Em Configurações → Aparência: logo, cores, nome, frase de login, rodapé e assinatura. A tela de login mostra a sua marca, pelo link próprio `…/#/c/seu-nome` ou pela última marca usada no navegador.
- **Áudio melhor.** Ganho ajustável com compressor, medidor de volume, escolha de microfone, teste de 5 segundos com reprodução e captação opcional do áudio da aba (teleconsulta).
- **Prontuário completo** em PDF ou Word, por paciente.

> Depois de atualizar, rode de novo `supabase/schema.sql` no SQL Editor (é seguro repetir).

## O que há de novo na versão 2 (interface redesenhada)

- **Início orientado à ação**: escolha o paciente e inicie a sessão; fila de "o que precisa da sua atenção" (rascunhos, relatórios revisados não liberados, pacientes sem consentimento) e checklist de configuração.
- **Busca rápida (Ctrl+K)** por páginas, pacientes e relatórios.
- **Nova sessão em 3 passos**: paciente e modelo, captação (gravar ou enviar áudio, transcrição editável), opções da IA (nível de detalhe, marcar trechos `[verificar]`, instruções extras).
- **Editor de relatório com controle por seção**: reordenar, ocultar do paciente (ícone de olho), reescrever uma seção com IA, remover; salvamento automático; fluxo Rascunho → Revisado → Liberado; prévia do portal; exportar só o que o paciente vê.
- **Lista de relatórios com filtros e ações em lote** (revisar, liberar, retirar, excluir).
- **Preferências**: detalhamento padrão da IA, instruções permanentes, modelo padrão, padrão de título, salvamento automático.
- **Dados**: backup completo em JSON, planilha CSV de pacientes e registro de atividades.

> **Atualizando de uma versão anterior?** Execute novamente `supabase/schema.sql` no SQL Editor (é seguro repetir). Ele adiciona a coluna `preferences` e atualiza o portal para respeitar a visibilidade por seção.

## Como colocar no ar

1. **Crie um projeto no [Supabase](https://supabase.com)** (plano gratuito serve para começar). Escolha a região **South America (São Paulo)**.
2. No projeto: **SQL Editor → New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. **Authentication → Providers → Email**: mantenha **Confirm email** ligado (é o que garante que o paciente é dono do e-mail que usa).
4. **Authentication → URL Configuration**: em *Site URL* coloque o endereço do site (ex.: `https://rafajames.github.io/florescer-relatorios/`) e adicione o mesmo em *Redirect URLs*.
5. **Project Settings → API**: copie a **Project URL** e a **anon public key** para `js/config.js`.
   A chave `anon` é pública por desenho; quem protege os dados são as regras RLS do `schema.sql`. **Nunca** coloque a `service_role` no site.
6. **GitHub → Settings → Pages**: Source = *Deploy from a branch*, branch `main`, pasta `/ (root)`.

## IA: chaves de cada profissional

Em **Configurações**, cada profissional cola:

- chave da **Anthropic** (gera os esboços) e
- chave da **OpenAI** (Whisper, transcreve áudio; limite de 25 MB por arquivo).

As chaves ficam só no navegador daquele computador (`localStorage`), nunca no banco. Sem as chaves o sistema funciona normalmente com digitação manual. Sem chave Whisper, a gravação usa a transcrição ao vivo do navegador (Chrome/Edge).

## Privacidade e responsabilidade

Dados de saúde são **dados pessoais sensíveis** (LGPD, art. 11). Este projeto traz boas práticas (isolamento por profissional, consentimento, auditoria, áudio descartado, IA só como rascunho), mas **não substitui** a avaliação jurídica, a política de privacidade e o cumprimento das normas do seu conselho profissional (CFP, COFFITO, CFFa, CFN, CREFITO etc.). Antes de usar com pacientes reais:

- revise o texto do termo de consentimento em Configurações;
- informe que o texto das sessões é enviado a provedores de IA (Anthropic/OpenAI) para gerar o esboço;
- considere contratar o plano pago do Supabase (backups diários) e ativar autenticação em dois fatores na sua conta do GitHub e do Supabase.

## Limitações conhecidas

- A exportação "Word" gera um `.doc` em HTML (abre e edita normalmente no Word); não é `.docx` nativo.
- O paciente é identificado pelo e-mail cadastrado pelo profissional: se o e-mail estiver errado, o paciente não vê nada (ou outra pessoa com aquele e-mail verá). Confira o e-mail antes de liberar.
- Não há recuperação de relatórios excluídos nem edição simultânea por vários dispositivos.

## Novidades da versão 4 (design)
- Tema claro, escuro ou automático; tamanho da letra (normal, grande, extra) e alto contraste, em Configurações → Aparência e marca (vale por aparelho).
- Carregamento com esqueletos, telas vazias com orientação, áreas de arrastar arquivo (logo, assinatura, áudio, documento-modelo).
- Início com números e últimos 7 dias; ficha do paciente com linha do tempo única.
- Editor: transcrição ao lado do texto; no celular, uma seção aberta por vez; botão de gravar fixo na sessão.
- Atalhos: Ctrl K, Ctrl S, Alt N, Alt H e `?` para ajuda.
- Estilo dos documentos (letra, margem, cabeçalho) e prévia do PDF antes de imprimir.
Não exige mudança no banco.

## Registro profissional e redes (versão 4.1)
Em Configurações → Perfil: conselho, número, UF, categoria e links (Instagram, site, outra rede). O paciente vê isso no portal. Não há verificação automática. **Rode o `supabase/schema.sql` de novo** (cria a coluna `credentials` e atualiza a função do portal).

## Texto com formatação (versão 4.2)
Campos longos do relatório têm barra de formatação (negrito, itálico, sublinhado, listas, título, alinhamento). Vale no editor, no portal e nas exportações. Sem mudança no banco.

## Documento livre (versão 4.3)
Na ficha do paciente, "Novo documento": página livre com formatação e tabelas. O paciente só vê depois de revisado e liberado. Exige a atualização do `reports_kind_check` (já em `supabase/schema.sql`).
