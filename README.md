# Florescer Relatórios

Sistema simples, em um único arquivo HTML, para terapeutas registrarem sessões e gerarem relatórios.

- Cadastro de pacientes e relatórios por sessão
- Gravação com transcrição ao vivo (Chrome/Edge) ou envio de áudio (o áudio nunca é salvo, só o texto)
- Esboço de relatório com IA, sempre editável e com a transcrição guardada para conferência
- Relatório geral por período
- Exportação para Word (.doc) e PDF

## Como usar

Abra o `index.html` no navegador (ou o site publicado pelo GitHub Pages).

Os dados ficam salvos **apenas no navegador do computador em que você usa** (localStorage). Não há login nem sincronização entre dispositivos. Evite nomes completos de pacientes; use iniciais ou codinomes.

## Observação sobre a IA

A geração de esboço por IA funciona dentro do Claude. Fora dele (neste site), o restante do sistema funciona normalmente e o relatório pode ser escrito manualmente.
