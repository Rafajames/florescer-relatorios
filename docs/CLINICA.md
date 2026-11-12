# Conta de clínica: desenho proposto (ainda não implementado)

Registrado em 12/11/2026, a partir do que o James definiu. **Nada disto existe na plataforma ainda.** Antes de implementar, confirmar com ele as perguntas do fim.

## Dois tipos de conta, separados

| | Profissional autônomo (como é hoje) | Clínica |
| --- | --- | --- |
| Quem usa | Uma pessoa só | Várias pessoas, cada uma com o seu papel |
| Registro clínico | Dela | De cada profissional da clínica |
| Agenda e financeiro | Dela | Da clínica |
| Layout | O atual | Próprio de clínica, diferente por papel |

Uma conta não vira a outra sem querer: o autônomo continua exatamente como está.

## Papéis dentro da clínica

**Dono(a) ou administrador(a) da clínica**
- Acesso total à **administração**: agenda de todos, cadastro de pacientes, cobranças, valores, gastos, resumo, recibos, equipe, permissões e marca da clínica.
- **Não vê nada clínico:** anamneses, evoluções, relatórios, metas e escalas ficam fora.

**Secretária(o)**
- Entra **pela clínica**, convidada pelo dono. Não existe cadastro de secretária avulso.
- Vê **só o que o dono permitir**, por módulo. Nunca tem acesso total.
- Nunca vê nada clínico.

**Profissional da clínica**
- Cuida do **clínico dos próprios pacientes**: anamnese, evolução, relatórios, metas, escalas, modelos e a própria agenda.
- **Não vê a administração:** valores, cobranças, gastos, resumo financeiro, equipe e permissões.

## Permissões da secretária (o dono liga ou desliga cada uma)

- Agenda: ver, agendar, reagendar, bloquear dias
- Lembretes e confirmação de presença
- Cadastro de pacientes (nome, telefone, e-mail, responsável)
- Lista de espera
- Cobranças e registro de pagamento
- Valores e forma de cobrança de cada paciente
- Gastos
- Resumo financeiro e planilha
- Recibos, declarações e folha de frequência

## De quem é cada dado

- **Cadastro do paciente** (nome, contato, responsável): da clínica.
- **Registro clínico** (anamnese, evolução, relatório, metas, escalas): do profissional que escreveu. A clínica não lê.
- **Agenda e financeiro:** da clínica.
- **Marca nos documentos:** a da clínica, com o nome e o registro do profissional que assina.

## Layout por papel

- **Dono:** Início da clínica (o dia de todos os profissionais), Agenda (com filtro por profissional), Pacientes (cadastro), Financeiro, Equipe e permissões, Configurações da clínica.
- **Secretária:** as mesmas telas administrativas, só com os módulos liberados.
- **Profissional da clínica:** Início, Meus pacientes, Relatórios, Modelos de documento, Minha agenda. Sem Financeiro.

## Como se entra (definido pelo James em 12/11/2026)

- **Profissional autônomo:** "Criar conta" (só para profissionais).
- **Paciente:** Portal do paciente, página própria. Já implementado.
- **Gestor da clínica:** página própria "Para clínicas", que cria o **perfil da clínica**. Durante os testes, com código entregue pelo administrador da Potira. O gestor **pode não ser profissional de saúde**: o cadastro não pede conselho nem especialidade.
- **Profissionais e secretárias:** por **convite do gestor**, pelo e-mail. Quem não tem conta faz um cadastro rápido pelo link do convite e cai direto na clínica.

## Um e-mail, vários perfis

- A mesma pessoa pode ter mais de um perfil **com o mesmo e-mail**: por exemplo, gestor da clínica e profissional que atende, ou profissional autônomo e profissional de uma clínica.
- Quem tem mais de um perfil vê um **botão de troca** na moldura, no estilo do botão de tema (claro/escuro): "Gestor | Profissional". Para quem tem um perfil só, o botão não aparece.
- Trocar de perfil troca o layout e os dados. Os dados **nunca se misturam**: no perfil de gestor não aparece nada clínico; no perfil de profissional não aparece a administração da clínica.
- O gestor que também atende marca isso no perfil ("Também atendo pacientes"), informa conselho e registro, e passa a ter o perfil de profissional da clínica, com o clínico só dos pacientes dele.

## O que já existe e dá para reaproveitar

- Base de equipe no banco (schema v15): tabela `staff`, funções `staff_of()` e `can_manage()`, e a regra de que agenda e financeiro aceitam "dono ou equipe autorizada".
- Modo secretária no código (`js/api.js`, `js/main.js`, `js/ui.js`), hoje desligado e sem entrada pela tela.
- Separação que já vale: registros clínicos nunca passam pelas regras da equipe.

## O que precisa ser construído

1. Banco: tabela de clínicas, tabela de membros com papel e permissões, e o vínculo de pacientes, agenda e financeiro com a clínica. Revisão das regras de acesso de todas as tabelas.
2. Telas do dono: equipe, convites e permissões.
3. Agenda e financeiro da clínica, com filtro por profissional.
4. Visão do profissional da clínica (sem administração).
5. Layout de clínica por papel.

É a maior mudança do projeto até aqui. Sugestão: fazer em etapas, nessa ordem, testando cada uma com contas reais antes da seguinte.

## Como outras plataformas fazem (pesquisa de 12/11/2026, pelas páginas de ajuda públicas)

- **Mais Terapias:** planos individuais (um terapeuta) e plano Clínicas. Só o plano Clínicas convida colaboradores. O administrador convida por e-mail e escolhe a função (Administrador, Secretária ou Terapeuta); o link vale 30 dias. Quem já tem conta aceita o convite; quem não tem faz um cadastro rápido e entra na equipe, sem plano próprio. A secretária não vê conteúdo clínico. O acesso financeiro é liberado pessoa por pessoa. Diferente do que o James quer: lá o administrador vê todos os registros.
- **iClinic:** o administrador cadastra os usuários direto (nome, e-mail e senha), como "profissional de saúde" ou "recepcionista". A recepcionista só vê a agenda dos profissionais marcados para ela. Uma conta pode ter mais de uma clínica.
- **Clínica nas Nuvens:** todo cadastro começa como usuário; marca-se "profissional" para quem atende. Permissões por módulo e por clínica. Cada profissional pode ocultar os próprios prontuários dos colegas.

## Opções para a pergunta 1 (como nasce a clínica)

- **A.** Terceira opção "Sou clínica" em Criar conta.
- **B.** O profissional já cadastrado cria a clínica em Configurações.
- **C.** Só o administrador da Potira cria clínicas.
- **D.** Pergunta no primeiro acesso: "Você atende sozinho ou tem uma clínica?". O cadastro continua com duas opções.
- **E.** Página própria "Para clínicas", com cadastro de clínica separado, aberta por um link na tela de entrada e na página de apresentação.
- **F.** Código de clínica: a criação da clínica só funciona com um código que o administrador da Potira entrega.
- **G.** Toda conta é uma clínica de uma pessoa só; vira clínica de verdade quando o dono convida alguém.

Recomendação registrada: **E com F** durante os testes. Em qualquer opção, profissionais e secretárias entram por convite do dono.

## Perguntas

**Já respondidas**
1. Como nasce a clínica: página própria "Para clínicas"; o gestor cria o perfil da clínica e convida os profissionais.
2. O dono também atende: é opcional. O gestor pode não ser profissional; se atender, ganha também o perfil de profissional.
5. Autônomo e clínica com o mesmo login: sim, com botão de troca de perfil.

**Ainda em aberto**
3. **O profissional da clínica vê algum valor?** Recomendação: só a contagem de sessões; repasse numa segunda etapa.
4. **Quando um profissional sai da clínica**, o que acontece com os registros que ele escreveu? Recomendação: ficam trancados na clínica, transferíveis para quem assumir o paciente, e ele leva uma cópia. Confirmar com uma clínica real.
6. **Paciente atendido por mais de um profissional:** um vê o registro do outro? Recomendação: só com consentimento registrado do paciente.
7. **A clínica pode ter mais de um gestor?** Recomendação: um dono principal que nomeia outros administradores.
