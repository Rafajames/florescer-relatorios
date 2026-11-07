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
