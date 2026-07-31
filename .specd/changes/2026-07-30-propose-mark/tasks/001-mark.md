---
id: "001-mark"
change: 2026-07-30-propose-mark
req: [REQ-SKL-008, REQ-SKL-009]
status: done
evidence:
  commits:
    - "7524882120b68df2e81037227ecbbfe48d077f1d"
    - "3ac3a58d60dfc8adf00907d60a4a54a6195341c0"
---

## Objetivo

Escrever o registro no propose e o recorte lido no archive.

## Escopo

`skills/specd-propose/SKILL.md` ganha o passo que grava o registro depois de o
delta estar escrito e o gate ter rodado — o estado de âncora só existe depois do
gate.

`skills/specd-archive-change/SKILL.md` troca o recorte deduzido pelo recorte
lido, com o caso sem registro declarado.

`test/skills/content.test.ts` ganha os testes de conteúdo dos dois.

## Restrições

- O registro é cópia do que `specd spec --json` e o relatório do gate produziram.
  A skill não calcula hash nem resume
- Nada de verificação de enunciado no CLI, e nada de comando novo
- Sem registro, recorte largo dito em voz alta — nunca recorte vazio
- Achado 3, saída A do achado 1 e a lista em três lugares continuam fora

## Critérios

Os de REQ-SKL-008 e REQ-SKL-009, verificados sobre o texto de cada `SKILL.md`.
