# Assistente de IA da Potira (planejado)

Situação: **planejado, ainda não implementado** (19/11/2026). Ao implementar, seguir [DIRETRIZES.md](DIRETRIZES.md) e o fluxo do James: estruturar → perguntar prioridade → programar → testar.

## Objetivo

Hoje a IA da Potira só redige texto (evoluções, relatórios). O Assistente é um chat dentro da plataforma onde o profissional pede em português comum e a IA **responde, consulta e executa ações** usando ferramentas (function calling).

## Regras que não podem ser quebradas

1. **IA continua opcional.** Sem chave configurada o Assistente não aparece; o resto funciona normalmente.
2. **Confirmação humana** para tudo que altera dados. A IA propõe → mostra um resumo claro → o profissional clica em Confirmar.
3. **Privacidade (LGPD):** a busca de pacientes por nome roda na própria Potira; a IA recebe id interno, não o nome completo. Evoluções só vão para a IA quando o profissional pede um resumo. Chaves de IA continuam só no navegador.
4. **Sem framework, sem build, sem npm.** Módulo novo `js/agente.js`, reaproveitando `js/ai.js` (provedores e chaves) e `js/api.js` (todo acesso ao banco).
5. Vocabulário: "sessão", datas dd/mm/aaaa, valores em R$.

## Os 6 tipos de pedido

| # | Tipo | Exemplos | Altera dados? |
| --- | --- | --- | --- |
| 1 | **Ajuda e tutoriais** | "Como cadastro um paciente?", "Como troco minha chave de API?", "Dá para ter duas chaves?" | Não |
| 2 | **Consultas** | "Quem atendi essa semana?", "Quem está devendo?", "Quantas faltas o João teve?", "Horário livre na sexta?" | Não |
| 3 | **Ações** | Agendar, remarcar, cancelar, marcar falta, gerar recibo/cobrança PIX, cadastrar paciente, lançar despesa | **Sim — sempre com confirmação** |
| 4 | **Escrita** | Resumir sessões por período, rascunhar evolução a partir de anotações, mensagem de lembrete, declaração de comparecimento | Não (gera rascunho) |
| 5 | **Atalhos e navegação** | "Abre a agenda de amanhã", "Mostra o financeiro de outubro", "Abre a ficha da Maria" | Não |
| 6 | **Visão do dia** | "Como está meu dia?" → sessões de hoje, evoluções pendentes, cobranças vencidas | Não |

Primeira versão sugerida: tipos **1, 2 e 3**.

### Ajuda (tipo 1)
- Conteúdo num arquivo único de ajuda (ex.: `docs/AJUDA.md` ou `js/ajuda-conteudo.js`) com o passo a passo de cada tela.
- O mesmo conteúdo alimenta uma **página de Ajuda comum, sem IA** — necessária porque, sem chave, o Assistente não existe (o tutorial "como configurar a chave" precisa funcionar sem IA).
- O Assistente responde **só com base nesse conteúdo**; se a função não existir, diz que ainda não existe.
- Resposta pode terminar com botão "Me leva lá".
- Manter a ajuda atualizada a cada entrega que mude uma tela.

### O que o Assistente não faz
- Apagar paciente ou sessão (só manual).
- Ver ou alterar chaves de API (só explica e abre Configurações).
- Diagnóstico ou conduta clínica.
- Emitir nota fiscal oficial (ainda não existe; oferece recibo).

## Ferramentas (tools) previstas

| Tool | Tipo | Confirmação |
| --- | --- | --- |
| consultar_ajuda | Leitura | Não |
| buscar_pacientes | Leitura | Não |
| listar_sessoes | Leitura | Não |
| listar_proximos_compromissos | Leitura | Não |
| resumo_financeiro | Leitura | Não |
| listar_pendencias (evoluções, cobranças) | Leitura | Não |
| resumir_periodo | Leitura + IA | Não |
| agendar_sessao | Mutação | Sim |
| atualizar_situacao_sessao | Mutação | Sim |
| gerar_recibo / gerar_cobranca | Mutação | Sim |
| cadastrar_paciente | Mutação | Sim |
| lancar_despesa | Mutação | Sim |
| abrir_tela | Navegação | Não |
| gerar_nota_fiscal | Stub: informa que não está disponível | — |

## Interface
- Botão flutuante (canto inferior direito), só para profissional logado com IA configurada.
- Painel com histórico, campo de texto, indicador "pensando…/executando…" e card de confirmação para ações.
- Funcionar em 390 px. Histórico só em memória, limpo ao fechar; enviar à IA só as últimas 8–10 mensagens.

## Provedores
Gemini (functionDeclarations), Anthropic e OpenAI têm tools nativas. Groq depende do modelo; se não suportar, avisar ou cair para modo JSON simples.

## Testes
Usar a conta fictícia descrita em [CONTA-TESTES.md](CONTA-TESTES.md), que traz um roteiro de pedidos e respostas esperadas.
