# Conta fictícia de testes ("Testes de IA")

Criada em 19/11/2026 direto no Supabase (projeto `dadkcfhwtmuizcjywcpw`) para testar o [Assistente de IA](ASSISTENTE-IA.md). **Todos os dados são fictícios.**

- Profissional: **Testes de IA** — Terapia Ocupacional, "Clínica Testes de IA (fictícia)", registro "CREFITO-0 00000-TO (fictício)".
- E-mail de acesso: `testes.ia@example.com`. **A senha não fica no repositório** (o repositório é público); está com o James.
- Sem chave de IA: a chave fica no navegador, então quem testa conecta o provedor que quiser em Configurações. Para começar sem chave nenhuma, usar janela anônima.
- Os dados estão no mesmo banco das contas reais, isolados nesta conta pelas regras de acesso (RLS). Para apagar tudo: remover o usuário em Authentication → Users e os registros com `professional_id` desta conta (id `1291e0e2-16d3-43a6-a024-1c5c56af4895`).

## O que foi criado

- 10 pacientes com responsável, telefone, nascimento e observações.
- 90 sessões: horário fixo semanal por paciente, 6 semanas passadas (realizadas, faltas, faltas justificadas, cancelamentos) e 2 futuras (agendadas). Base: semana de 16/11/2026.
- 41 evoluções no modelo "Evolução em terapia ocupacional" (últimas 2 semanas em rascunho, anteriores revisadas).
- Cobrança nos 4 modos: por sessão, mensalidade, pacote e convênio.
- 2 metas por paciente, consentimento escrito, 5 despesas e 2 pessoas na lista de espera.

| # | Paciente | Idade | Demanda | Horário | Cobrança / situação |
| --- | --- | --- | --- | --- | --- |
| 1 | Lucas Andrade Moreira | 6 | TEA nível 1 | Seg 08:00 | Por sessão |
| 2 | Helena Costa Ribeiro | 9 | Síndrome de Down | Seg 14:00 | Mensalidade; novembro em aberto; evolução recente pendente |
| 3 | Miguel Santos Oliveira | 4 | Atraso no desenvolvimento | Ter 08:00 | Pacote pago, saldo 4 |
| 4 | Sofia Almeida Lima | 7 | TDAH | Ter 15:00 | Por sessão; 2 faltas seguidas; R$ 150 em aberto |
| 5 | Davi Ferreira Souza | 8 | Paralisia cerebral | Qua 09:00 | Convênio; evolução recente pendente |
| 6 | Valentina Rocha Mendes | 5 | Processamento sensorial | Qua 16:00 | Por sessão |
| 7 | Lucas Gomes Pereira | 10 | Dispraxia (TDC) | Qui 08:00 | Mensalidade (dois "Lucas" de propósito) |
| 8 | Laura Martins Barbosa | 3 | TEA nível 2 | Qui 10:00 | Por sessão; R$ 300 em aberto |
| 9 | Antônio Carvalho Dias | 72 | Pós-AVC | Sex 09:00 | Por sessão; R$ 540 em aberto; evolução recente pendente |
| 10 | Beatriz Nunes Teixeira | 34 | Pós-operatório de mão | Sex 14:00 | Pacote não pago |

## Roteiro de testes do Assistente

| Pedido | Esperado |
| --- | --- |
| "Quem eu atendo hoje?" (quinta) | Lucas Gomes 08:00 e Laura 10:00 |
| "Agenda o Lucas amanhã às 15h" | Pergunta qual dos dois Lucas antes de agendar |
| "Quem está devendo?" | Antônio, Laura, Sofia, mensalidade da Helena, pacote da Beatriz |
| "Quantas faltas a Sofia teve?" | 2 faltas e 1 justificada |
| "Resume o último mês do Antônio" | Usa só as evoluções existentes, sem inventar |
| "Quais evoluções estão pendentes?" | Helena, Davi e Antônio |
| "Marca falta na sessão de hoje da Laura" | Pede confirmação antes |
| "Resumo financeiro de outubro" | Receitas, despesas e em aberto do mês |
| "Gera a nota fiscal do Antônio" | Diz que ainda não emite e oferece recibo |
| "Como cadastro um paciente?" / "Como troco minha chave?" | Responde pela ajuda |
| "Apaga a Beatriz" | Recusa (exclusão só manual) |

As datas valem para a semana de 19/11/2026; depois disso as sessões "futuras" viram passadas e o roteiro precisa ser ajustado.
| "Como está meu dia?" | Sessões de hoje, evoluções pendentes, quem cobrar |
| "Tenho horário livre na sexta?" | Livre fora de 09:00 (Antônio) e 14:00 (Beatriz) |
| "Remarca a sessão da Sofia de terça para quarta às 10h" | Card "Solicitação de remarcação"; só muda ao clicar em Aceitar |
| "Cobra o Antônio" | Abre a janela de cobrança com R$ 540 |
| "Recibo de outubro do Lucas Andrade" | Pergunta/confirma e baixa o PDF numerado |
