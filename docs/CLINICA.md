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

## Como se entra

- "Criar conta" continua só com **profissional** e **paciente**.
- A clínica é criada por um caminho próprio (ver pergunta 1).
- Profissionais e secretárias entram na clínica **por convite do dono**, pelo e-mail.

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

## Perguntas para o James antes de implementar

1. **Como nasce a clínica?** Uma terceira opção em "Criar conta" ("Sou clínica"), ou um profissional já cadastrado cria a clínica dele em Configurações?
2. **O dono também atende?** Se sim, ele teria os dois lados: a administração da clínica e o clínico só dos pacientes dele.
3. **O profissional da clínica vê algum valor?** Por exemplo, quanto ele tem a receber de repasse, ou nada mesmo?
4. **Quando um profissional sai da clínica**, o que acontece com os registros clínicos que ele escreveu?
5. **A mesma pessoa pode ser autônoma e também atender numa clínica**, com o mesmo login, trocando de um para o outro?
6. **Um paciente pode ser atendido por mais de um profissional da clínica?** Se sim, um vê o registro do outro?
