---
id: "007-suggest-ceiling"
change: 2026-07-fatia-4
req: [REQ-ANC-011]
status: pending
evidence:
  commits: []
---

## Objetivo

Teto de frequência no suggest

## Escopo

Termo que casa mais arquivos que `TERM_FILE_CEILING` é descartado e contado no relatório.

## Restrições

- Termo casando 119 arquivos é namespace, não símbolo
- Teto generoso de propósito: matar o termo do namespace, não adivinhar símbolo legítimo
