# Importação de pacientes e cadastro completo (planejado)

Situação: **planejado, ainda não implementado** (19/11/2026). Complementa a seção 4 de [ESPECIFICACAO-EVOLUCAO-POTIRA.md](ESPECIFICACAO-EVOLUCAO-POTIRA.md).

## Por que é prioridade

Profissionais e **clínicas** que chegam de outro sistema já têm seus pacientes numa planilha (Excel/CSV). Sem importação, teriam de cadastrar um por um — barreira de entrada, principalmente para clínicas com centenas de pacientes. Hoje a Potira só **exporta** a lista em CSV (Configurações); não importa.

## Parte 1 — Cadastro completo (feito em 19/11/2026, ver ATUALIZACOES)

Hoje `patients` tem só nome, e-mail, telefone, nascimento e observações (responsável e convênio em `patient_admin`). **Faltam CPF e endereço**, necessários para recibo, cobrança, nota fiscal, declarações e convênio. Decisão do James (19/11/2026): esses campos **têm que existir** na plataforma.

Campos a acrescentar:

- **Identificação:** CPF (validação dos dígitos — já existe `cpfValido` em `js/cobranca.js`), nome social, RG + órgão + UF, sexo cadastral (só se houver finalidade).
- **Contato:** WhatsApp, telefone alternativo.
- **Endereço:** CEP, logradouro, número, complemento, bairro, cidade, UF (preenchimento manual sempre disponível; endereço parcial permitido).
- **Responsável financeiro:** nome, CPF, parentesco, telefone, e-mail. Importante para nota fiscal de criança: quem recebe a nota é o responsável, não o paciente.
- **Convênio:** número da carteirinha (o nome do convênio já existe em `patient_admin`).
- **Administrativo:** data de entrada e origem do cadastro (ex.: "importado").

Regras:
- Campos sempre disponíveis na ficha e no cadastro, organizados em seções (não tudo de uma vez).
- O CPF é exigido no momento em que for necessário (ex.: emissão fiscal); pacientes antigos continuam válidos sem ele.
- CPF mascarado em listas; nunca em logs ou na auditoria.
- Migração aditiva no fim de `supabase/schema.sql`; acesso só por `js/api.js`; ficha em `js/views-home.js`; exportação CSV passa a incluir os campos novos.
- Atualizar a anamnese ("Atualizar cadastro") para preencher CPF/endereço quando vierem na resposta.

## Parte 2 — Importação

Fluxo na tela de Pacientes, botão **"Importar pacientes"**:

1. **Escolher arquivo** `.xlsx` ou `.csv`. Excel lido com SheetJS carregado por CDN só nesse momento (sem npm/build). Leitura feita no navegador; o arquivo não é enviado nem guardado.
2. **Ligar colunas automaticamente** por sinônimos ("Nome"/"Paciente", "Celular"/"Fone"/"Telefone", "Data de nasc."/"Nascimento", "CPF", "Endereço"/"Rua", "Responsável", "Convênio"…). O que não for reconhecido aparece com menu para escolher o campo ou ignorar.
3. **Prévia** em tabela antes de salvar, marcando:
   - telefone, data (vira dd/mm/aaaa) e CPF inválidos;
   - possível paciente repetido (mesmo CPF, ou mesmo nome + nascimento, ou mesmo telefone) — opção de pular ou atualizar;
   - linhas sem nome (ignoradas).
4. **Confirmar** → resultado: "13 importados, 2 ignorados" com motivo de cada um.
5. **Desfazer importação**: cada importação recebe um identificador de lote; dá para remover o lote inteiro se algo deu errado.
6. **Planilha modelo** para baixar e preencher (quem vem de papel ou de sistema sem exportação).

Para clínicas (quando a conta de clínica existir, ver [CLINICA.md](CLINICA.md)): coluna opcional "Profissional responsável" para distribuir os pacientes; volumes de centenas/milhares de linhas, gravados em blocos com barra de progresso.

Registrar a importação na auditoria (quantidade e data, sem dados pessoais).

### Ajuda da IA (opcional, depois)
Quando os cabeçalhos forem muito diferentes, a IA sugere o mapeamento recebendo **apenas os nomes das colunas**, nunca os dados. O Assistente também explica o passo a passo da importação (ver [ASSISTENTE-IA.md](ASSISTENTE-IA.md)).

## Ordem sugerida
1. Campos de cadastro completo (banco + ficha + exportação).
2. Importação com prévia, duplicados e planilha modelo.
3. Desfazer importação.
4. Mapeamento com IA.
