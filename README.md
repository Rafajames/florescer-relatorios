# Potira — relatórios clínicos

> Antes chamada **Florescer Relatórios**. O repositório e o endereço do site mantêm o nome antigo.

**Site:** https://rafajames.github.io/florescer-relatorios/

## Sobre

A Potira é uma plataforma web para profissionais de saúde (terapia ocupacional, psicologia, fonoaudiologia, fisioterapia, nutrição e outras áreas) cuidarem do registro clínico e da rotina do consultório em um só lugar:

- **Registro clínico:** anamnese, evolução de cada sessão, relatório por período e documento livre, com modelos por área e modelos próprios.
- **IA opcional:** o sistema funciona sem IA. Com IA conectada (cada profissional usa a própria chave), ela transcreve o áudio e escreve um rascunho, que o profissional sempre revisa.
- **Paciente:** portal do paciente (só vê o que foi revisado e liberado), anamnese por link para responder no celular e relatório por link com validade e senha.
- **Administrativo:** agenda semanal, folha de frequência, declarações e convênios.
- **Financeiro:** cobranças por sessão, PIX copia-e-cola, cobrança agendada, registro de pagamento com leitura do comprovante, despesas, orçamento e recibo.
- **Marca própria:** logo, cores, timbre, rodapé e assinatura; o menu e os documentos seguem o tema do profissional.
- **LGPD:** consentimento por paciente, áudio nunca guardado, trilha de auditoria e isolamento por profissional.

A plataforma está em **fase de testes** com profissionais convidados. Usa apenas planos gratuitos (GitHub Pages e Supabase).

## Documentação

| Arquivo | Para que serve |
| --- | --- |
| [docs/DIRETRIZES.md](docs/DIRETRIZES.md) | Regras que toda mudança deve seguir para não descaracterizar o projeto. **Leia antes de alterar qualquer coisa.** |
| [docs/ATUALIZACOES.md](docs/ATUALIZACOES.md) | Histórico do que já foi feito, da versão mais nova para a mais antiga. |
| [docs/PENDENCIAS.md](docs/PENDENCIAS.md) | O que foi proposto e ainda não foi feito, e o que foi feito mas ainda precisa de revisão ou teste. |
| [CLAUDE.md](CLAUDE.md) | Resumo para uma nova conversa com o Claude começar já sabendo o que se espera. |
| [tutoriais/](tutoriais/) | Passo a passo para conectar as chaves de IA (Gemini, Groq, Claude, OpenAI). |

## Estrutura

```
index.html            site (GitHub Pages)
css/app.css           estilos (um arquivo só)
js/                   front-end em JavaScript puro, em módulos, sem build
supabase/schema.sql   banco de dados e regras de segurança (PostgreSQL); pode ser rodado de novo sem risco
tools/stamp.py        carimba a versão no index.html (rodar antes de cada commit)
docs/                 documentação do projeto
tutoriais/            tutoriais das chaves de IA
local/                versão antiga de arquivo único (sem login); não é mais mantida
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

## Limitações conhecidas

- A exportação "Word" gera um `.doc` em HTML (abre e edita no Word); não é `.docx` nativo, e não leva a marca d'água.
- O paciente do portal é identificado pelo e-mail cadastrado pelo profissional. Confira o e-mail antes de liberar.
- Não há recuperação de relatórios excluídos nem edição simultânea em vários aparelhos.
- A cobrança não é enviada sozinha: o sistema deixa a mensagem pronta e o profissional envia.
- Não funciona sem internet.
