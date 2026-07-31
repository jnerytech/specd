---
id: "001-archive-demands"
change: 2026-07-31-mark-enforced
req: [REQ-ARC-016]
status: pending
evidence:
  commits: []
---

## Objetivo

Fazer o archive cobrar o marco.

## Escopo

`assertProposalRecord` em `src/archive/index.ts`, chamada junto das outras
pré-condições, antes de qualquer escrita: sem `propose.json`, ou com arquivo que
não parseia ou traz `version` desconhecida, sai 2 nomeando o comando que grava.

Reusa `RECORD_FILE` e `RECORD_VERSION` de `src/spec/record.ts`; um segundo nome
de arquivo seria a assimetria pela qual o furo volta.

## Restrições

- Registro com `requirements: []` arquiva. Vazio é marco, não ausência
- Nenhuma flag de dispensa
- Nada escrito quando aborta, por REQ-ARC-009

## Critérios

Os de REQ-ARC-016, cada um como teste.
